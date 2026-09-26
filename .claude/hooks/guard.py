#!/usr/bin/env python3
"""Hard limits on what Claude Code may do on this machine (2026-09-19).

A PreToolUse hook: Claude Code pipes the pending tool call in as JSON; exit 2
BLOCKS it (stderr goes back to Claude as the reason), exit 0 lets the normal
permission flow decide. Hooks run in every permission mode, including auto and
bypass, so this holds even when prompts are switched off. No jq on this Mac,
so it is Python.

Rules, in plain words:
  1. Never disable the Bash sandbox.
  2. Never run the destructive shell commands listed below, anywhere.
  3. Never delete outside the project (rm on any path that is not under the
     project or Claude's own scratch/memory folders is refused).
  4. Never touch credentials, keychains, shell startup files or system config.
  5. Never edit these limits: anything under .claude/ is read-only to Claude.
  6. Files may only be created or edited inside the project, Claude's
     scratchpad, or its memory folder.
"""
import json
import os
import re
import sys

PROJECT = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
HOME = os.path.expanduser("~")
ALLOWED_WRITE_ROOTS = [
    os.path.realpath(PROJECT),
    "/private/tmp/claude-501/",                     # Claude's session scratchpad
    os.path.join(HOME, ".claude", "projects"),      # its memory files
]

# Shell commands that are never acceptable here, as regexes on the command text.
FORBIDDEN = [
    (r"\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r)\b", "recursive force delete"),
    (r"\brm\s+-[a-zA-Z]*r\b.*\s(/|~|\$HOME|/Users)\b", "recursive delete of a top-level path"),
    (r"\bsudo\b", "sudo"),
    (r"\bsu\s", "su"),
    (r"\bgit\s+push\b.*(--force|-f\b|--force-with-lease)", "force push"),
    (r"\bgit\s+reset\s+--hard", "git reset --hard"),
    (r"\bgit\s+clean\b", "git clean"),
    (r"\bgit\s+checkout\s+--\s", "discarding working-tree changes"),
    (r"\bgit\s+restore\b", "discarding working-tree changes"),
    (r"\bgit\s+branch\s+-D", "force branch delete"),
    (r"\bgit\s+remote\s+(set-url|remove|rm)\b", "changing the git remote"),
    (r"\bgit\s+config\s+--global", "global git config"),
    (r"\bmkfs\b|\bdiskutil\b|\bdd\s+if=", "disk tools"),
    (r"\blaunchctl\b|\bdefaults\s+write\b|\bcsrutil\b|\bspctl\b|\bsystemsetup\b", "system settings"),
    (r"\bsecurity\s+(find|dump|export|delete|add)", "keychain access"),
    (r"\bchmod\s+(-R|777)|\bchown\b|\bchflags\b", "permission changes"),
    (r"\bkill(all)?\s+-9\b|\bpkill\s+-9\b|\bkill\s+-1\b|\bpkill\s+-f\s+['\"]?\.?\s*['\"]?\s*$", "indiscriminate kill"),
    (r"\bshutdown\b|\breboot\b|\bhalt\b", "power commands"),
    (r"\bcrontab\b|\bat\s+now\b", "scheduling"),
    (r"\bssh\b|\bscp\b|\bsftp\b|\brsync\b.*:", "remote shell / copy"),
    (r"(curl|wget)\b[^|]*\|\s*(ba|z)?sh\b", "piping a download into a shell"),
    (r":\(\)\s*\{", "fork bomb"),
    (r"\.ssh\b|\.aws\b|\.gnupg\b|gcloud\b.*credentials|Keychains|\.netrc\b|\.zsh_history|\.bash_history", "credentials or history"),
    (r"\b(\.zshrc|\.zprofile|\.bashrc|\.bash_profile|\.profile)\b", "shell startup files"),
    (r"(^|[;&|]\s*)(open|osascript)\b(?!.*Godot)", "open/osascript for anything but Godot"),
    (r">\s*/dev/(sd|disk|rdisk)", "writing to a device"),
]

def block(reason: str) -> None:
    sys.stderr.write("BLOCKED by .claude/hooks/guard.py: %s. This limit is deliberate; ask Gareth.\n" % reason)
    sys.exit(2)

def under(path: str, roots) -> bool:
    real = os.path.realpath(os.path.expanduser(path))
    return any(real == r.rstrip("/") or real.startswith(r.rstrip("/") + "/") for r in roots)

def check_bash(tool_input: dict) -> None:
    if tool_input.get("dangerouslyDisableSandbox"):
        block("disabling the Bash sandbox")
    cmd = tool_input.get("command", "") or ""
    for pattern, why in FORBIDDEN:
        if re.search(pattern, cmd):
            block(why + " (`%s`)" % pattern)
    # rm is allowed only on paths inside the project or Claude's own folders.
    for m in re.finditer(r"(^|[;&|]\s*)rm\s+(.*?)(?=$|[;&|])", cmd):
        args = [a for a in m.group(2).split() if not a.startswith("-")]
        for a in args:
            a = a.strip("'\"")
            if a.startswith("$") or "*" in a and a.startswith("/"):
                block("rm with a variable or wildcard absolute path")
            path = a if a.startswith(("/", "~")) else os.path.join(os.getcwd(), a)
            if not under(path, ALLOWED_WRITE_ROOTS):
                block("rm outside the project (%s)" % a)
    # Writing into .claude/ from the shell would rewrite these limits.
    if re.search(r"\.claude/(settings|hooks)", cmd) and re.search(r">|\bcp\b|\bmv\b|\bsed\s+-i|\btee\b|\bpython3?\b", cmd):
        block("changing Claude's own limits from the shell")

def check_file_tool(tool_name: str, tool_input: dict) -> None:
    path = tool_input.get("file_path") or tool_input.get("path") or ""
    if not path:
        return
    if under(path, [os.path.join(os.path.realpath(PROJECT), ".claude")]):
        block("editing Claude's own limits (%s)" % path)
    if not under(path, ALLOWED_WRITE_ROOTS):
        block("%s outside the project (%s)" % (tool_name, path))
    if re.search(r"/\.(ssh|aws|gnupg)/|/Keychains/|/\.(zshrc|zprofile|bashrc|bash_profile)$", os.path.expanduser(path)):
        block("credentials or shell startup file")

def main() -> None:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        sys.exit(0)
    tool = payload.get("tool_name", "")
    tool_input = payload.get("tool_input", {}) or {}
    if tool == "Bash":
        check_bash(tool_input)
    elif tool in ("Write", "Edit", "MultiEdit", "NotebookEdit"):
        check_file_tool(tool, tool_input)
    sys.exit(0)

if __name__ == "__main__":
    main()
