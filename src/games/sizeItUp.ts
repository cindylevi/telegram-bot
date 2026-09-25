import type { Game } from "./types";

export const sizeItUp: Game = {
  id: "size-it-up",
  name: "Size It Up",
  emoji: "📐",
  url: "https://magnitudle.com/size-it-up",
  direction: "higher",
  parse(text) {
    const score = text.match(/^\s*Size It Up\s*\n\s*Overall Score\s*:?\s*(\d+)/im);
    if (!score) return null;
    return { puzzle: null, score: Number(score[1]), display: score[1] };
  },
};
