import type { Game } from "./types";

export const catfishing: Game = {
  id: "catfishing",
  name: "Catfishing",
  emoji: "🐈",
  direction: "higher",
  parse(text) {
    const match = text.match(/catfishing\.net\s*\n\s*#(\d+)\s*-\s*(\d+(?:\.\d+)?)\s*\/\s*10\b/i);
    if (!match) return null;
    return { puzzle: match[1], score: Number(match[2]), display: `${match[2]}/10` };
  },
};
