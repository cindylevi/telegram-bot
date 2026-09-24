import type { Game } from "./types";

export const magnitudleDaily: Game = {
  id: "magnitudle",
  name: "Magnitudle Daily",
  emoji: "📏",
  direction: "higher",
  parse(text) {
    const match = text.match(
      /Magnitudle\s*[—–-]\s*Daily Question\s+(S\d+)\s*[·.•]\s*(Q\d+)\s*Score:\s*(\d+)\s*\/\s*100/i,
    );
    if (!match) return null;
    return {
      puzzle: `${match[1].toUpperCase()}-${match[2].toUpperCase()}`,
      score: Number(match[3]),
      display: `${match[3]}/100`,
    };
  },
};
