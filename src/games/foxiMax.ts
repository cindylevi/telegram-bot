import { parseAttempts } from "./attempts";
import type { Game } from "./types";

export const foxiMax: Game = {
  id: "foximax",
  name: "FoxiMax",
  emoji: "🦊",
  url: "https://foximax.com",
  direction: "lower",
  parse: (text) => parseAttempts(text, /#FoxiMax\s+#(\d+)\s+(\d+|X)\s*\/\s*(\d+)/i),
};
