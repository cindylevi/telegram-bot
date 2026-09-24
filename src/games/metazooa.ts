import type { Game } from "./types";

export const metazooa: Game = {
  id: "metazooa",
  name: "Metazooa",
  emoji: "🦫",
  direction: "lower",
  parse(text) {
    if (!/metazooa/i.test(text)) return null;
    const puzzle = text.match(/Animal\s+#(\d+)/i);
    const guesses = text.match(/\bin\s+(\d+)\s+guess(?:es)?\b/i);
    if (!puzzle || !guesses) return null;
    return { puzzle: puzzle[1], score: Number(guesses[1]), display: guesses[1] };
  },
};
