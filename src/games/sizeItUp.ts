import type { Game } from "./types";

export const sizeItUp: Game = {
  id: "size-it-up",
  name: "Size It Up",
  emoji: "📐",
  direction: "higher",
  parse(text) {
    if (!/Size It Up/i.test(text)) return null;
    const score = text.match(/Overall Score\s*:?\s*(\d+)/i);
    if (!score) return null;
    return { puzzle: null, score: Number(score[1]), display: score[1] };
  },
};
