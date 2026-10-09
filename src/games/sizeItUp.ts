import type { Game } from "./types";

const SCORE = /^\s*Size It Up\s*\n\s*Overall Score\s*:?\s*(\d+)/im;
// Cada ronda: los cuadraditos y su puntaje ("🟥🟥⬜️⬜️⬜️ 43"). Son el detalle del MEGA matchi matchi.
const ROUND = /^[^\p{L}\p{N}\s]+\s+\d+$/u;

export const sizeItUp: Game = {
  id: "size-it-up",
  name: "Size It Up",
  emoji: "📐",
  url: "https://magnitudle.com/size-it-up",
  direction: "higher",
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
    return { puzzle: null, score: Number(score[1]), display: score[1], pattern };
  },
};
