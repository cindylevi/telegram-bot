import type { Game } from "./types";

// "Size It Up\nOverall Score 185"; desde el 3 de noviembre de 2026 viene con la fecha y sobre 500:
// "Magnitudle — Size It Up\n2026-11-11\n\nScore: 368/500".
const SCORE =
  /^\s*(?:Magnitudle\s*[—–-]\s*)?Size It Up\s*\n\s*(?:(\d{4}-\d{2}-\d{2})\s*\n\s*)?(?:Overall\s+)?Score\s*:?\s*(\d+)(?:\s*\/\s*\d+)?/im;
// Cada ronda: los cuadraditos y su puntaje ("🟥🟥⬜️⬜️⬜️ 43"). Son el detalle del MEGA matchi matchi.
const ROUND = /^[^\p{L}\p{N}\s]+\s+\d+$/u;

export const sizeItUp: Game = {
  id: "size-it-up",
  name: "Size It Up",
  emoji: "📐",
  url: "https://magnitudle.com/size-it-up",
  direction: "higher",
  streakPauses: [{ from: "2026-11-03", to: "2026-11-10" }],
  parse(text) {
    const score = text.match(SCORE);
    if (!score) return null;
    const lines = text
      .slice((score.index ?? 0) + score[0].length)
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "");
    const end = lines.findIndex((line) => !ROUND.test(line));
    const pattern = (end === -1 ? lines : lines.slice(0, end)).join("\n");
    const [, date, points] = score;
    return { puzzle: date ?? null, score: Number(points), display: points, pattern };
  },
};
