import type { Game } from "./types";

export const pedantle: Game = {
  id: "pedantle",
  name: "Pedantle",
  emoji: "📖",
  direction: "lower",
  parse(text) {
    const match = text.match(/#pedantle\s+#(\d+)\s+in\s+(\d+)\s+guess(?:es)?/i);
    if (!match) return null;
    return { puzzle: match[1], score: Number(match[2]), display: match[2] };
  },
};
