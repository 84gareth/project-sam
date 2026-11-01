// The paper puppet castle: who is in which room and where, walking, doors,
// and people stopping to chat. Pure: positions are fractions of the room
// picture (x 0..1 across, y 0..1 down), `step` moves everyone on by `dt`
// seconds, and all chance comes from the `random` passed in, so tests can
// run it fast and repeatably. (Sam and Gareth, 2026-10-24: tap where to go;
// rooms are the great hall, library, garden and kitchen; the others walk
// around and sometimes chat to each other.)

// The rooms in a row, joined by doors on the left and right.
export const ROOMS = [
  { id: "kitchen", name: "Kitchen", picture: "assets/rooms/kitchen.jpg" },
  { id: "hall", name: "Great hall", picture: "assets/rooms/hall.jpg" },
  { id: "library", name: "Library", picture: "assets/rooms/library.jpg" },
  { id: "garden", name: "Garden", picture: "assets/rooms/garden.jpg" },
];

// The floor: where feet can go. Doors are at the far left and right.
export const FLOOR = { left: 0.1, right: 0.9, top: 0.72, bottom: 0.94 };
export const DOOR_LEFT = 0.04;
export const DOOR_RIGHT = 0.96;
export const SPEED = 0.16;          // room widths per second
export const PLAYER_SPEED = 0.28;
const CHAT_CHANCE = 0.25;           // when someone stops, chance they chat
const DOOR_CHANCE = 0.45;           // ...or leave the room (Gareth: more room to room)
const NEAR = 0.012;

const roomIndex = (id) => ROOMS.findIndex((r) => r.id === id);
export const neighbour = (room, side) => ROOMS[roomIndex(room) + (side === "left" ? -1 : 1)]?.id ?? null;

function spot(random) {
  return {
    x: FLOOR.left + random() * (FLOOR.right - FLOOR.left),
    y: FLOOR.top + random() * (FLOOR.bottom - FLOOR.top),
  };
}

// Everyone spread round the rooms; Sam starts in the middle of the great hall.
export function createWorld(game, random) {
  const people = {};
  game.players.filter((p) => p.id !== game.playerId).forEach((p, i) => {
    const at = spot(random);
    people[p.id] = { room: ROOMS[i % ROOMS.length].id, ...at, tx: at.x, ty: at.y,
      mode: "idle", timer: random() * 3, door: null, with: null };
  });
  const me = { room: "hall", x: 0.5, y: 0.84, tx: 0.5, ty: 0.84, door: null, walking: false };
  return { people, me };
}

// Move `who` towards its target. Returns true when it has arrived.
function walk(who, speed, dt) {
  const dx = who.tx - who.x;
  const dy = who.ty - who.y;
  const dist = Math.hypot(dx, dy);
  const stepLen = speed * dt;
  if (dist <= Math.max(stepLen, NEAR)) {
    who.x = who.tx;
    who.y = who.ty;
    return true;
  }
  who.x += (dx / dist) * stepLen;
  who.y += (dy / dist) * stepLen;
  who.facing = dx < 0 ? "left" : "right";
  return false;
}

// Through a door: appear just inside the next room's opposite door.
function goThrough(who, random) {
  const next = neighbour(who.room, who.door);
  if (next) {
    const fromLeft = who.door === "right";
    who.room = next;
    who.x = fromLeft ? FLOOR.left : FLOOR.right;
    who.y = FLOOR.top + random() * (FLOOR.bottom - FLOOR.top);
  }
  who.door = null;
}

// Sam taps somewhere: walk there (kept on the floor), or out of a door.
export function tapTo(world, x, y) {
  const me = world.me;
  me.door = null;
  if (x <= FLOOR.left - 0.02 && neighbour(me.room, "left")) {
    me.door = "left"; me.tx = DOOR_LEFT; me.ty = Math.min(Math.max(y, FLOOR.top), FLOOR.bottom);
  } else if (x >= FLOOR.right + 0.02 && neighbour(me.room, "right")) {
    me.door = "right"; me.tx = DOOR_RIGHT; me.ty = Math.min(Math.max(y, FLOOR.top), FLOOR.bottom);
  } else {
    me.tx = Math.min(Math.max(x, FLOOR.left), FLOOR.right);
    me.ty = Math.min(Math.max(y, FLOOR.top), FLOOR.bottom);
  }
  me.walking = true;
}

// Walk up to someone: stand just beside them.
export function walkUpTo(world, id) {
  const them = world.people[id];
  const side = them.x > world.me.x ? -0.07 : 0.07;
  tapTo(world, them.x + side, them.y);
}

export const nextTo = (world, id) => {
  const them = world.people[id];
  return them && them.room === world.me.room && Math.hypot(them.x - world.me.x, them.y - world.me.y) < 0.1;
};

// Move the world on by dt seconds. `stillIn`: ids still in the game.
export function step(world, stillIn, dt, random) {
  const me = world.me;
  if (me.walking && walk(me, PLAYER_SPEED, dt)) {
    me.walking = false;
    if (me.door) goThrough(me, random);
  }
  for (const [id, p] of Object.entries(world.people)) {
    if (!stillIn.includes(id)) continue;
    if (p.mode === "walk") {
      if (walk(p, SPEED, dt)) {
        if (p.door) goThrough(p, random);
        p.mode = "idle";
        p.timer = 1 + random() * 2;
      }
    } else if (p.mode === "chat") {
      p.timer -= dt;
      if (p.timer <= 0) { p.mode = "idle"; p.timer = 1 + random() * 2; p.with = null; }
    } else {
      p.timer -= dt;
      if (p.timer > 0) continue;
      const roll = random();
      const friend = Object.entries(world.people).find(([o, q]) =>
        o !== id && stillIn.includes(o) && q.room === p.room && q.mode === "idle");
      if (roll < CHAT_CHANCE && friend) {
        // Stop and chat: stand facing each other for a few seconds.
        const [fid, f] = friend;
        const t = 3 + random() * 3;
        p.mode = f.mode = "chat";
        p.timer = f.timer = t;
        p.with = fid; f.with = id;
        p.tx = p.x = Math.min(Math.max(f.x + (f.x > 0.5 ? -0.08 : 0.08), FLOOR.left), FLOOR.right);
        p.ty = p.y = f.y;
        p.facing = f.x > p.x ? "right" : "left";
        f.facing = f.x > p.x ? "left" : "right";
      } else if (roll < CHAT_CHANCE + DOOR_CHANCE) {
        const side = random() < 0.5 ? "left" : "right";
        if (neighbour(p.room, side)) {
          p.door = side;
          p.tx = side === "left" ? DOOR_LEFT : DOOR_RIGHT;
          p.ty = p.y;
          p.mode = "walk";
        } else {
          p.timer = 1;
        }
      } else {
        const at = spot(random);
        p.tx = at.x; p.ty = at.y; p.mode = "walk";
      }
    }
  }
}

// Who is in a room right now (ids still in the game, Sam not included).
export const peopleIn = (world, room, stillIn) =>
  Object.entries(world.people).filter(([id, p]) => p.room === room && stillIn.includes(id)).map(([id]) => id);
