import type { Game } from "./types";

// "Magnitudle — Daily Question S20 · Q02\n\nScore: 70/100"; desde noviembre de 2026 la temporada y la
// pregunta vienen en su propio renglón, después de la fecha: "2026-11-03 · S24 · Q02".
export const magnitudleDaily: Game = {
  id: "magnitudle",
  name: "Magnitudle Daily",
  emoji: "📏",
  url: "https://magnitudle.com/daily",
  direction: "higher",
  grid: false,
  parse(text) {
    const match = text.match(
      /Magnitudle\s*[—–-]\s*Daily Question\s+(?:\d{4}-\d{2}-\d{2}\s*[·.•]\s*)?(S\d+)\s*[·.•]\s*(Q\d+)\s*Score:\s*(\d+)\s*\/\s*100/i,
    );
    if (!match) return null;
    return {
      puzzle: `${match[1].toUpperCase()}-${match[2].toUpperCase()}`,
      score: Number(match[3]),
      display: `${match[3]}/100`,
    };
  },
};
