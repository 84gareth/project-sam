// The game engine: every change to the game is a numbered decision (Phase
// 8, docs/multiplayer-spec.md). Each real player sends their part (a vote,
// a mission score, a night pick, or just "ready"); once everyone still in
// has, the decision is made, in order, with the same rules on every
// device, so every device has the same game. Single player is the same
// with one player, decided at once.
//
// applyDecision is pure (tested): the game plus one decision -> the change
// it makes, and what happened (for the screens to show).

import { DAYS } from "./game.js";
import {
  humansOf, isTraitor, stillIn, playerSays, firstVote, tiePleas, revote, chests, nightKind, recruit, night, quietNight,
  computerChoice, canMurderTonight, isDaggerNight, giveDagger, finalRound, DAGGER_AT,
} from "./castle.js";
import {
  todaysMission, finishMission, finishCatapults, MISSIONS,
} from "./missions.js";

// Who must answer a decision: the real players still in.
export const needed = (game) => humansOf(game).filter((id) => stillIn(game).includes(id));

// Most-picked (ties: the earliest real player's pick). Ignores blanks.
function mostPicked(picks) {
  const counts = new Map();
  for (const p of picks) if (p != null) counts.set(p, (counts.get(p) ?? 0) + 1);
  let best = null, n = 0;
  for (const p of picks) if (p != null && counts.get(p) > n) { best = p; n = counts.get(p); }
  return best;
}

// Will the dagger be given out tonight (after tonight's murder, if any)?
export const daggerTonight = (game, murder) =>
  !game.dagger && game.day <= DAYS && stillIn(game).length - (murder ? 1 : 0) <= DAGGER_AT;

// Make decision `type` with each real player's part (`parts`: { id: data }).
export function applyDecision(game, type, parts) {
  const humans = humansOf(game);
  const inOrder = humans.filter((id) => id in parts).map((id) => [id, parts[id]]);
  switch (type) {
    case "go":
      return {};
    case "mission": {
      const mission = MISSIONS.find((m) => m.id === inOrder[0]?.[1]?.mission) ?? todaysMission(game);
      const left = stillIn(game);
      if (mission.id === "catapults") {
        return finishCatapults(game, Object.fromEntries(inOrder.map(([id, d]) => [id, d.hits ?? []])), left, mission);
      }
      if (mission.id === "cooking") {
        const finders = inOrder.filter(([, d]) => d.found).map(([id]) => id);
        const scores = Object.fromEntries(inOrder.map(([id, d]) => [id, d.score]));
        const r = finishMission(game, scores, left, mission, finders[0]);
        return { ...r, found: finders.includes(game.playerId), finders };
      }
      return finishMission(game, Object.fromEntries(inOrder.map(([id, d]) => [id, d.score])), left, mission);
    }
    case "says": {
      const lines = [];
      for (const [id, option] of inOrder) lines.push({ id, option, reply: playerSays(game, option, id) });
      return { lines };
    }
    case "votes":
      return firstVote(game, Object.fromEntries(inOrder.map(([id, d]) => [id, d])));
    // A draw (Gareth): the tied people speak, everyone else votes again,
    // and if it's still a draw, chests.
    case "pleas":
      return tiePleas(game, Object.fromEntries(inOrder.filter(([, d]) => d)));
    case "revote":
      return revote(game, Object.fromEntries(inOrder.filter(([, d]) => d)));
    case "chests":
      return chests(game, Object.fromEntries(inOrder.filter(([, d]) => d != null)));
    case "night": {
      const kind = nightKind(game);
      const traitors = inOrder.filter(([id]) => isTraitor(game, id));
      const picks = traitors.map(([, d]) => d ?? {});
      let result = { kind };
      if (kind === "quiet") {
        quietNight(game);
      } else {
        let doing = kind;
        if (kind === "choose") {
          const choice = traitors.length ? mostPicked(picks.map((p) => p.choice)) : computerChoice(game);
          doing = choice === "recruit" ? "recruit" : choice === "murder" && canMurderTonight(game) ? "murder" : "none";
        }
        const pick = mostPicked(picks.map((p) => p.pick));
        if (doing === "recruit") result.recruited = recruit(game, pick);
        else if (doing === "murder") result.victim = night(game, pick);
        else quietNight(game);
        result.doing = doing;
      }
      if (isDaggerNight(game)) result.dagger = giveDagger(game, mostPicked(picks.map((p) => p.dagger)));
      return result;
    }
    case "final":
      return finalRound(game, Object.fromEntries(inOrder));
    default:
      throw new Error(`no decision "${type}"`);
  }
}

// ─── Single player: decided at once ─────────────────────────────────────────
export function soloEngine(game) {
  let k = 0;
  return {
    kind: "solo",
    get game() { return game; },
    async decide(type, data) {
      k += 1;
      return applyDecision(game, type, { [game.playerId]: data });
    },
  };
}
