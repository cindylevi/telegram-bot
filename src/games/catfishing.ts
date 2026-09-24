import type { Game } from "./types";

export const catfishing: Game = {
  id: "catfishing",
  name: "Catfishing",
  emoji: "🐈",
  direction: "higher",
  parse(text) {
    if (!/catfishing\.net/i.test(text)) return null;
    const match = text.match(/#(\d+)\s*-\s*(\d+(?:\.\d+)?)\s*\/\s*10\b/);
    if (!match) return null;
    return { puzzle: match[1], score: Number(match[2]), display: `${match[2]}/10` };
  },
};
