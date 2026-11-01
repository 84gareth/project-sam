// The multiplayer engine (Phase 8, docs/multiplayer-spec.md). Same face as
// soloEngine: `await decide(type, data)`. Each device writes its player's
// part to its own seat ({ k, t, data }: the k-th decision); the host, once
// every real player still in has sent part k, writes decision k to the
// room's log; every device (the host too) applies the log in order with
// the same rules, so all devices have the same game.

import { applyDecision, needed } from "./engine.js";

// Firebase quietly drops empty places: [null, "shield", null] comes back
// as { 1: "shield" }, and a null field vanishes. A missed catapult stone
// is a null, so the result broke on every device, and rejoining too
// (Gareth, 2026-10-29). So each player's part, and each decision's parts,
// travel as text, which Firebase keeps exactly.
export const pack = (value) => JSON.stringify(value ?? null);
export const unpack = (text) => (typeof text === "string" ? JSON.parse(text) : text ?? null);

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
    parts[who] = unpack(act.data);
  }
  return type ? { t: type, parts } : null;
}
// Who hasn't answered decision k yet (characters).
export const waitingFor = (game, room, k) =>
  needed(game).filter((who) => room.seats?.[room.play.uids[who]]?.act?.k !== k);

// Where in the day a player rejoins, from the decisions made so far (their
// types, in order). Pure. Each day goes: (mission from day 2), go to the
// table, says, votes, go on from the reveal, night, go from breakfast. After
// day 12's vote comes the final: final, then votes again if not ended.
// `ended`: is the game over (the final ended, or someone won)?
// A draw adds "pleas", "revote" and maybe "chests" after the votes; whether
// a vote was a draw shows in the next decision, so the screens decide what
// "voted" and "revoted" mean from the last result.
export function resumePoint(types, ended, days = 12) {
  let pos = "dayStart", day = 1;
  for (const t of types) {
    if (pos === "voted") {
      if (t === "pleas") { pos = "pleaded"; continue; }
      pos = "reveal"; day += 1;
    } else if (pos === "revoted") {
      if (t === "chests") { pos = "reveal"; day += 1; continue; }
      pos = "reveal"; day += 1;
    }
    if (pos === "pleaded") { pos = "revoted"; continue; }
    if (pos === "dayStart") pos = t === "mission" ? "castle" : "talk";
    else if (pos === "castle") pos = "talk";
    else if (pos === "talk") pos = "table";
    else if (pos === "table") pos = "voted";
    else if (pos === "reveal") pos = day > days ? "final" : "night";
    else if (pos === "night") pos = "breakfast";
    else if (pos === "breakfast") pos = "dayStart";
    else if (pos === "final") pos = "table";
  }
  if (ended) return "ending";
  if (pos === "dayStart" && day === 1) return "castle";
  return pos;
}

// At night only the Traitors have choices to make, so naming who's slow
// would give them away (Gareth, 2026-10-29): no names then.
export const waitingLine = (names, type) =>
  (type === "night" ? "Waiting for the night to end..." : `Waiting for ${names.join(", ")}...`);

export const CHECK_EVERY = 3000;   // ms

export function netEngine(net, roomName, game, isHost, onWaiting = () => {}) {
  let next = 0;                  // the next decision this device will ask for
  let applied = 0;               // decisions applied from the log
  const results = [];
  const waiting = new Map();     // k -> resolve
  const types = new Map();       // k -> what kind of decision (for the sign)
  let writing = -1;              // the host's last decision written

  let lastRoom = null;
  let skip = -1;                 // the host said not to wait, for this decision
  function onRoom(room) {
    if (!room || !room.play) return;
    lastRoom = room;
    const log = logList(room.log);
    while (applied < log.length && log[applied]) {
      const e = log[applied];
      results[applied] = applyDecision(game, e.t, unpack(e.parts) ?? {});
      waiting.get(applied)?.(results[applied]);
      waiting.delete(applied);
      applied += 1;
    }
    // The host: once everyone's part for the next decision is in, decide.
    // Who we're still waiting for, while this device waits (for the sign).
    onWaiting(waiting.has(applied) ? waitingFor(game, room, applied) : [], types.get(applied));
    if (isHost && applied === log.length && writing < applied) {
      const d = readyToDecide(game, room, applied, skip === applied);
      if (d) {
        writing = applied;
        net.setRoom(roomName, { [`log/${applied}`]: { t: d.t, parts: pack(d.parts) } }).catch((err) => { writing = -1; console.error(err); });
      }
    }
  }
  const stopWatch = net.watchRoom(roomName, onRoom);
  // While this device waits for a decision, check the room itself every few
  // seconds too, and when the page wakes up: a live stream that's gone quiet
  // (a sleepy iPad, a dropped connection) left everyone waiting (Gareth, a
  // long wait at breakfast, 2026-10-29). Applying the log is safe to repeat.
  let checking = false;
  async function check() {
    if (checking || (!waiting.size && !isHost)) return;
    checking = true;
    try { onRoom(await net.readRoom(roomName)); } catch (err) { console.error(err); }
    checking = false;
  }
  const timer = setInterval(check, CHECK_EVERY);
  const onWake = () => { if (document.visibilityState === "visible") check(); };
  document.addEventListener("visibilitychange", onWake);
  const stop = () => { stopWatch(); clearInterval(timer); document.removeEventListener("visibilitychange", onWake); };

  return {
    kind: "net",
    get game() { return game; },
    stop,
    isHost,
    // Rejoining: wait until the decisions made so far are applied, then carry
    // on from there. Returns { types, results } of what's been decided.
    catchUp() {
      return new Promise((resolve) => {
        const check = () => {
          if (!lastRoom) return setTimeout(check, 50);
          const log = logList(lastRoom.log);
          if (applied < log.length) return setTimeout(check, 50);
          next = applied;
          resolve({ types: log.map((e) => e.t), results: [...results] });
        };
        check();
      });
    },
    // The host: stop waiting for whoever hasn't answered this decision.
    dontWait() {
      skip = applied;
      if (lastRoom) onRoom(lastRoom);
    },
    decide(type, data) {
      const k = next++;
      if (k < applied) return Promise.resolve(results[k]);
      types.set(k, type);
      const done = new Promise((resolve) => waiting.set(k, resolve));
      net.setAct(roomName, net.uid, { k, t: type, data: pack(data) }).catch((err) => console.error(err));
      return done;
    },
  };
}
