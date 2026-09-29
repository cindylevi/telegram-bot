import type { Game } from "./types";

export const chainle: Game = {
  id: "chainle",
  name: "Chainle",
  emoji: "🔗",
  url: "https://chainle.io",
  direction: "higher",
  parse(text) {
    const match = text.match(/Chainle\s+#(\d+)\s*\n\s*([\d,]+)\s*\/\s*([\d,]+)/i);
    if (!match) return null;
    return { puzzle: match[1], score: Number(match[2].replace(/,/g, "")), display: `${match[2]}/${match[3]}` };
  },
};
