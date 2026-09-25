import { parseAttempts } from "./attempts";
import type { Game } from "./types";

export const boludle: Game = {
  id: "boludle",
  name: "Boludle",
  emoji: "🧉",
  url: "https://boludle.com",
  direction: "lower",
  parse: (text) => parseAttempts(text, /boludle\.com\s+#(\d+)\s+(\d+|X)\s*\/\s*(\d+)/i),
};
