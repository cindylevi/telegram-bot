import type { Game } from "./types";

export const magnitudleDaily: Game = {
  id: "magnitudle",
  name: "Magnitudle Daily",
  emoji: "📏",
  direction: "higher",
  parse(text) {
    const header = text.match(/Magnitudle\s*[—–-]\s*Daily Question\s+(S\d+)\s*[·.•]\s*(Q\d+)/i);
    if (!header) return null;
    const score = text.match(/Score:\s*(\d+)\s*\/\s*100/i);
    if (!score) return null;
    return {
      puzzle: `${header[1].toUpperCase()}-${header[2].toUpperCase()}`,
      score: Number(score[1]),
      display: `${score[1]}/100`,
    };
  },
};
