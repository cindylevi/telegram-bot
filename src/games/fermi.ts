import type { Game } from "./types";

// "Fermi · No. 95\n01 1.23×\n02 12.0×\n03 87.5×\n─────────\n10.9× score · top 84%": el puntaje es por cuánto
// le erraste (1× es exacto), así que gana el menor.
const RESULT = /Fermi\s*·\s*No\.\s*(\d+)\s*\n([\s\S]*?)\n\s*([\d.]+)×\s*score\b/iu;
const ROUND = /^\d+\s+([\d.]+×)$/u;

export const fermi: Game = {
  id: "fermi",
  name: "Fermi",
  emoji: "🧮",
  url: "https://fermi.gg/s/daily",
  direction: "lower",
  parse(text) {
    const match = text.match(RESULT);
    if (!match) return null;
    const [, puzzle, body, score] = match;
    // Lo que erró en cada pregunta ("1.23× 12.0× 87.5×"): el detalle del MEGA matchi matchi.
    const pattern = body
      .split("\n")
      .map((line) => line.trim().match(ROUND)?.[1])
      .filter((round): round is string => round !== undefined)
      .join(" ");
    return { puzzle, score: Number(score), display: `${score}×`, pattern };
  },
};
