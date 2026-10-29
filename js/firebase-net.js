// The Firebase version of the room transport (docs/multiplayer-spec.md),
// for Gareth's project "project-sam". Talks to Firebase over its plain web
// address (no library): anonymous sign-in, reads and writes, and a live
// stream of changes. Same face as localNet in net.js.

// Gareth's web config (2026-10-29). Public by design: the database rules
// are what keep things safe.
export const FIREBASE = {
  apiKey: "AIzaSyBRPZgESoFpIrDzE50Jiav6hdtLWFOoWWM",
  databaseURL: "https://project-sam-ae8b8-default-rtdb.europe-west1.firebasedatabase.app",
};

// Merge one live-stream event into our copy of the room. Pure (tested).
// Firebase sends { path, data }: "put" replaces what's at `path`, "patch"
// merges `data`'s keys into it. A null deletes.
export function applyEvent(state, kind, path, data) {
  const parts = path.split("/").filter(Boolean);
  const set = (obj, i) => {
    if (i === parts.length) {
      if (kind === "patch") {
        const base = obj && typeof obj === "object" ? { ...obj } : {};
        for (const [k, v] of Object.entries(data ?? {})) {
          if (v === null) delete base[k]; else base[k] = v;
        }
        return base;
      }
      return data;
    }
    const base = obj && typeof obj === "object" ? { ...obj } : {};
    const next = set(base[parts[i]], i + 1);
    if (next === null || next === undefined) delete base[parts[i]]; else base[parts[i]] = next;
    return base;
  };
  return set(state, 0);
}

export function firebaseNet(config = FIREBASE, store = window.sessionStorage) {
  let auth = null;   // { uid, token, refresh, expires }
  const KEY = "project-sam-firebase";

  async function signIn() {
    try { auth = JSON.parse(store.getItem(KEY)); } catch { auth = null; }
    if (auth && auth.expires > Date.now() + 60000) return auth;
    const url = auth?.refresh
      ? `https://securetoken.googleapis.com/v1/token?key=${config.apiKey}`
      : `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${config.apiKey}`;
    const body = auth?.refresh
      ? new URLSearchParams({ grant_type: "refresh_token", refresh_token: auth.refresh })
      : JSON.stringify({ returnSecureToken: true });
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": auth?.refresh ? "application/x-www-form-urlencoded" : "application/json" },
      body,
    });
    const j = await res.json();
    if (!res.ok) throw new Error(`sign-in failed: ${j.error?.message ?? res.status}`);
    auth = {
      uid: j.localId ?? j.user_id,
      token: j.idToken ?? j.id_token,
      refresh: j.refreshToken ?? j.refresh_token,
      expires: Date.now() + Number(j.expiresIn ?? j.expires_in) * 1000,
    };
    try { store.setItem(KEY, JSON.stringify(auth)); } catch { /* fine */ }
    return auth;
  }
  const url = async (path) => `${config.databaseURL}/${path}.json?auth=${(await signIn()).token}`;
  async function call(method, path, value) {
    const res = await fetch(await url(path), { method, body: value === undefined ? undefined : JSON.stringify(value) });
    if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
    return res.json();
  }

  const net = {
    kind: "firebase",
    uid: null,
    async ready() { net.uid = (await signIn()).uid; return net; },
    readRoom: (name) => call("GET", `rooms/${name}`),
    createRoom: (name, room) => call("PUT", `rooms/${name}`, room),
    setSeat: (name, uid, seat) => call("PUT", `rooms/${name}/seats/${uid}`, seat),
    setRoom: (name, patch) => call("PATCH", `rooms/${name}`, patch),
    // Live changes: our copy of the room, kept up to date. Reconnects with a
    // fresh sign-in before the hour-long token runs out.
    watchRoom(name, onChange) {
      let room = null, source = null, stopped = false, timer = null;
      const open = async () => {
        if (stopped) return;
        source?.close();
        source = new EventSource(await url(`rooms/${name}`));
        const handle = (kind) => (e) => {
          const { path, data } = JSON.parse(e.data);
          room = applyEvent(room, kind, path, data);
          onChange(room);
        };
        source.addEventListener("put", handle("put"));
        source.addEventListener("patch", handle("patch"));
        source.addEventListener("auth_revoked", open);
        clearTimeout(timer);
        timer = setTimeout(open, Math.max(60000, auth.expires - Date.now() - 120000));
      };
      open();
      return () => { stopped = true; clearTimeout(timer); source?.close(); };
    },
  };
  return net;
}
