// How devices share a multiplayer room (docs/multiplayer-spec.md). One
// face, two versions behind it:
// - local: between browser tabs on one device (for building and tests);
// - Firebase: between devices (firebase-net.js, Gareth's project).
// Every version gives: uid, ready(), readRoom(name), createRoom(name, room)
// (host), setSeat(name, uid, seat) (your own seat), setRoom(name, patch)
// (host), and watchRoom(name, onChange) -> stop. All but watchRoom return
// promises. The Firebase version is in firebase-net.js.

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
  const net = {
    kind: "local", uid: tabUid(), updateRoom, watchRoom,
    ready: async () => net,
    readRoom: async (name) => readRoom(name),
    createRoom: async (name, room) => updateRoom(name, () => room),
    setSeat: async (name, uid, seat) => updateRoom(name, (r) => (r ? { ...r, seats: { ...r.seats, [uid]: seat } } : null)),
    // Keys may be paths ("log/3"), like Firebase's.
    setRoom: async (name, patch) => updateRoom(name, (r) => {
      if (!r) return null;
      const next = structuredClone(r);
      for (const [path, value] of Object.entries(patch)) {
        const parts = path.split("/");
        let at = next;
        for (const p of parts.slice(0, -1)) at = at[p] ??= {};
        at[parts[parts.length - 1]] = value;
      }
      return next;
    }),
    setAct: async (name, uid, act) => updateRoom(name, (r) => (r ? { ...r, seats: { ...r.seats, [uid]: { ...r.seats[uid], act } } } : null)),
  };
  return net;
}
