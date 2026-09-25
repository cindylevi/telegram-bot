import type { Game } from "./types";

export const metazooa: Game = {
  id: "metazooa",
  name: "Metazooa",
  emoji: "🦫",
  url: "https://metazooa.com",
  direction: "lower",
  parse(text) {
    if (!/metazooa/i.test(text)) return null;
    const match = text.match(/Animal\s+#(\d+)[^\n]*\n\s*I figured it out in\s+(\d+)\s+guess(?:es)?\b/i);
    if (!match) return null;
    return { puzzle: match[1], score: Number(match[2]), display: match[2] };
  },
};
