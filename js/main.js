// Placeholder start: shows the game's name and version so there is
// something to open on the iPad from day one. Replaced once Sam's game
// exists.
import { GAME_NAME, VERSION } from "./version.js";

document.title = GAME_NAME;
document.getElementById("title").textContent = GAME_NAME;
document.getElementById("version").textContent = "v" + VERSION;
