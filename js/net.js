// How devices share a multiplayer room (docs/multiplayer-spec.md). One
// face, two versions behind it:
// - local: between browser tabs on one device (for building and tests);
// - Firebase: between devices (coming once Gareth's project exists).
// Every version gives: uid, readRoom(name), updateRoom(name, change),
// watchRoom(name, onChange) -> stop.

// Who this tab is: a random id, kept for this tab only (two tabs on one
// computer are two players).
function tabUid() {
  try {
    let id = sessionStorage.getItem("project-sam-uid");
    if (!id) { id = Math.random().toString(36).slice(2, 10); sessionStorage.setItem("project-sam-uid", id); }
    return id;
  } catch {
    return Math.random().toString(36).slice(2, 10);
  }
}

// Rooms kept in this browser's storage; other tabs hear about changes.
export function localNet(store = window.localStorage) {
  const key = (name) => `project-sam-room:${name}`;
  const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("project-sam-net") : null;
  const listeners = new Map();   // name -> Set of callbacks
  const tell = (name) => {
    const room = readRoom(name);
    for (const cb of listeners.get(name) ?? []) cb(room);
  };
  if (channel) channel.onmessage = (e) => tell(e.data);
  function readRoom(name) {
    try { return JSON.parse(store.getItem(key(name))); } catch { return null; }
  }
  // `change(room)` returns the new room (or null to leave it alone).
  function updateRoom(name, change) {
    const next = change(readRoom(name));
    if (!next) return readRoom(name);
    store.setItem(key(name), JSON.stringify(next));
    channel?.postMessage(name);
    tell(name);
    return next;
  }
  function watchRoom(name, onChange) {
    if (!listeners.has(name)) listeners.set(name, new Set());
    listeners.get(name).add(onChange);
    onChange(readRoom(name));
    return () => listeners.get(name).delete(onChange);
  }
  return { kind: "local", uid: tabUid(), readRoom, updateRoom, watchRoom };
}
