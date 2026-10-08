import type { Game } from "./types";

// "Originle #4 · 1,470\n🟥🟥🟩 · 8/8 clues": puntos sobre 10.000 y, abajo, los intentos (🏳️ si se rindió)
// con las pistas que tenía abiertas.
const RESULT = /Originle\s+#(\d+)\s*·\s*([\d,]+)\s*\n\s*([🟥🟩]*)((?:🏳️)?)\s*·\s*(\d+)\s*\/\s*(\d+)\s+clues?\b/iu;

export const originle: Game = {
  id: "originle",
  name: "Originle",
  emoji: "🧭",
  url: "https://originle.io",
  direction: "higher",
  parse(text) {
    const match = text.match(RESULT);
    if (!match) return null;
    const [, puzzle, points, , gaveUp, hints, total] = match;
    return { puzzle, score: Number(points.replace(/,/g, "")), display: `${points} · ${hints}/${total} pistas${gaveUp ? " 🏳️" : ""}` };
  },
};
