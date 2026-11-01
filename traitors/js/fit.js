// Fit the game to the screen. It's designed at iPad size; on smaller
// screens (phones) the whole thing shrinks evenly, so it looks the same,
// just smaller (Gareth, 2026-10-24: "bordering on unplayable on iPhone").
// Phones held upright are asked to turn sideways.

// The smallest space the game is laid out for, before it shrinks.
export const DESIGN_W = 760;
export const DESIGN_H = 680;

// How much to shrink for a screen of w x h (1 = not at all).
export const fitScale = (w, h) => Math.min(1, w / DESIGN_W, h / DESIGN_H);
// A phone held upright: taller than wide, and narrow.
export const turnSideways = (w, h) => h > w && w < 600;

export function fit() {
  const w = window.innerWidth, h = window.innerHeight;
  const s = fitScale(w, h);
  const app = document.getElementById("app");
  if (!app) return;   // not the game page (the tests import the rules)
  app.style.setProperty("--fit", s);
  app.style.width = `${w / s}px`;
  app.style.height = `${h / s}px`;
  document.getElementById("turn").hidden = !turnSideways(w, h);
}

fit();
window.addEventListener("resize", fit);
window.addEventListener("orientationchange", fit);
