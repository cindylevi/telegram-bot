import { parseAttempts } from "./attempts";
import type { Game } from "./types";

export const poople: Game = {
  id: "poople",
  name: "Poople",
  emoji: "🟫",
  url: "https://poople.io",
  direction: "lower",
  parse: (text) => parseAttempts(text, /Poople\s+#(\d+)\s+(\d+|X)\s*\/\s*(\d+)/i),
};
