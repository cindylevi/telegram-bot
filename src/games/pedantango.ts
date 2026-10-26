import type { Game } from "./types";

// "pedantango #1 · lo saqué en 12 intentos": el Pedantle argentino.
const RESULT = /pedantango\s+#(\d+)\s*·\s*lo\s+saqu[eé]\s+en\s+(\d+)\s+intentos?\b/iu;

export const pedantango: Game = {
  id: "pedantango",
  name: "Pedantango",
  emoji: "🧉",
  url: "https://pedantango.compil.ar",
  direction: "lower",
  parse(text) {
    const match = text.match(RESULT);
    if (!match) return null;
    return { puzzle: match[1], score: Number(match[2]), display: match[2] };
  },
};
