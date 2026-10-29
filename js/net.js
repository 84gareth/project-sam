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

  const listeners = new Map();   // name -> Set of callbacks
  // Tell listeners a moment later, always with the newest room, like a real
  // network: telling them straight away, from inside another listener, could
  // hand some of them an older copy after a newer one (a stuck test, 2026-10-29).
  const tell = (name) => queueMicrotask(() => {
    for (const cb of [...(listeners.get(name) ?? [])]) cb(readRoom(name));
  });
  // Other tabs hear about a change through the browser's own "storage"
  // event, which only fires once the change has landed there. (A separate
  // message could arrive first, read old data, and leave a tab stuck.)
  if (typeof window !== "undefined") {
    window.addEventListener("storage", (e) => {
      const m = e.key && /^project-sam-room:([^:]+)/.exec(e.key);
      if (m && listeners.has(m[1])) tell(m[1]);
    });
  }
  // Like Firebase, each player's seat is stored on its own, apart from the
  // rest of the room (which only the host writes). Saving the whole room as
  // one block let two devices saving at once wipe out each other's change
  // (flaky multiplayer tests, 2026-10-29).
  const seatKey = (name, uid) => `${key(name)}:seat:${uid}`;
  function readRoom(name) {
    try {
      const main = JSON.parse(store.getItem(key(name)));
      if (!main) return null;
      const seats = {};
      const prefix = `${key(name)}:seat:`;
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (k && k.startsWith(prefix)) seats[k.slice(prefix.length)] = JSON.parse(store.getItem(k));
      }
      return { ...main, seats };
    } catch { return null; }
  }
  function write(name, room) {
    const { seats = {}, ...main } = room;
    store.setItem(key(name), JSON.stringify(main));
    for (const [uid, seat] of Object.entries(seats)) writeSeat(name, uid, seat);
  }
  function writeSeat(name, uid, seat) {
    const k = seatKey(name, uid);
    const text = JSON.stringify(seat);
    if (store.getItem(k) !== text) store.setItem(k, text);
  }
  const told = (name) => tell(name);
  // `change(room)` returns the new room (or null to leave it alone). For
  // tests and one-writer changes only: it rewrites every seat it's given.
  function updateRoom(name, change) {
    const next = change(readRoom(name));
    if (!next) return readRoom(name);
    write(name, next);
    told(name);
    return next;
  }
  // Change only the host's part of the room.
  function updateMain(name, change) {
    let main;
    try { main = JSON.parse(store.getItem(key(name))); } catch { main = null; }
    if (!main) return null;
    const next = change(main);
    store.setItem(key(name), JSON.stringify(next));
    told(name);
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
    setSeat: async (name, uid, seat) => { writeSeat(name, uid, seat); told(name); },
    // Keys may be paths ("log/3"), like Firebase's. The host's part only.
    setRoom: async (name, patch) => updateMain(name, (r) => {
      const next = structuredClone(r);
      for (const [path, value] of Object.entries(patch)) {
        const parts = path.split("/");
        let at = next;
        for (const p of parts.slice(0, -1)) at = at[p] ??= {};
        at[parts[parts.length - 1]] = value;
      }
      return next;
    }),
    setAct: async (name, uid, act) => {
      const k = seatKey(name, uid);
      let seat;
      try { seat = JSON.parse(store.getItem(k)) ?? {}; } catch { seat = {}; }
      writeSeat(name, uid, { ...seat, act });
      told(name);
    },
  };
  return net;
}
