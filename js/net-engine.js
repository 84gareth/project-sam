// The multiplayer engine (Phase 8, docs/multiplayer-spec.md). Same face as
// soloEngine: `await decide(type, data)`. Each device writes its player's
// part to its own seat ({ k, t, data }: the k-th decision); the host, once
// every real player still in has sent part k, writes decision k to the
// room's log; every device (the host too) applies the log in order with
// the same rules, so all devices have the same game.

import { applyDecision, needed } from "./engine.js";

// The log as a list (Firebase may hand it back as { "0": ..., "1": ... }).
export const logList = (log) => (Array.isArray(log) ? log : Object.keys(log ?? {})
  .map(Number).sort((a, b) => a - b).map((i) => log[i]));

// Has everyone needed sent part k? If so, the decision to write. Pure.
// `uids`: { character: uid }.
// `skip`: the host said not to wait for players who haven't answered.
export function readyToDecide(game, room, k, skip = false) {
  const parts = {};
  let type = null;
  for (const who of needed(game)) {
    const act = room.seats?.[room.play.uids[who]]?.act;
    if (!act || act.k !== k) {
      if (skip) continue;
      return null;
    }
    type = type ?? act.t;
    parts[who] = act.data ?? null;
  }
  return type ? { t: type, parts } : null;
}
// Who hasn't answered decision k yet (characters).
export const waitingFor = (game, room, k) =>
  needed(game).filter((who) => room.seats?.[room.play.uids[who]]?.act?.k !== k);

export function netEngine(net, roomName, game, isHost, onWaiting = () => {}) {
  let next = 0;                  // the next decision this device will ask for
  let applied = 0;               // decisions applied from the log
  const results = [];
  const waiting = new Map();     // k -> resolve
  let writing = -1;              // the host's last decision written

  let lastRoom = null;
  let skip = -1;                 // the host said not to wait, for this decision
  function onRoom(room) {
    if (!room || !room.play) return;
    lastRoom = room;
    const log = logList(room.log);
    while (applied < log.length && log[applied]) {
      const e = log[applied];
      results[applied] = applyDecision(game, e.t, e.parts ?? {});
      waiting.get(applied)?.(results[applied]);
      waiting.delete(applied);
      applied += 1;
    }
    // The host: once everyone's part for the next decision is in, decide.
    // Who we're still waiting for, while this device waits (for the sign).
    onWaiting(waiting.has(applied) ? waitingFor(game, room, applied) : []);
    if (isHost && applied === log.length && writing < applied) {
      const d = readyToDecide(game, room, applied, skip === applied);
      if (d) {
        writing = applied;
        net.setRoom(roomName, { [`log/${applied}`]: d }).catch((err) => { writing = -1; console.error(err); });
      }
    }
  }
  const stop = net.watchRoom(roomName, onRoom);

  return {
    kind: "net",
    get game() { return game; },
    stop,
    isHost,
    // The host: stop waiting for whoever hasn't answered this decision.
    dontWait() {
      skip = applied;
      if (lastRoom) onRoom(lastRoom);
    },
    decide(type, data) {
      const k = next++;
      if (k < applied) return Promise.resolve(results[k]);
      const done = new Promise((resolve) => waiting.set(k, resolve));
      net.setAct(roomName, net.uid, { k, t: type, data: data ?? null }).catch((err) => console.error(err));
      return done;
    },
  };
}
