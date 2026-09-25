import type { Game } from "./types";

export const krillion: Game = {
  id: "krillion",
  name: "Krillion",
  emoji: "🦐",
  url: "https://krillion.io",
  direction: "higher",
  parse(text) {
    const match = text.match(/Krillion\s+#(\d+)[^\n]*\n\s*(\d+)\s*(?:\n|$)/i);
    if (!match) return null;
    return { puzzle: match[1], score: Number(match[2]), display: match[2] };
  },
};
