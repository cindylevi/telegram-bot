import type { Game } from "./types";

export const chainle: Game = {
  id: "chainle",
  name: "Chainle",
  emoji: "🔗",
  url: "https://chainle.io",
  direction: "higher",
  // Dos formatos: "Chainle #41\n3,595/5,000" y "Chainle #42 · 2,421 🔗" (sin el máximo).
  parse(text) {
    const withMax = text.match(/Chainle\s+#(\d+)\s*\n\s*([\d,]+)\s*\/\s*([\d,]+)/i);
    if (withMax) return { puzzle: withMax[1], score: toNumber(withMax[2]), display: `${withMax[2]}/${withMax[3]}` };
    const inline = text.match(/Chainle\s+#(\d+)\s*·\s*([\d,]+)/i);
    if (inline) return { puzzle: inline[1], score: toNumber(inline[2]), display: inline[2] };
    return null;
  },
};

function toNumber(value: string): number {
  return Number(value.replace(/,/g, ""));
}
