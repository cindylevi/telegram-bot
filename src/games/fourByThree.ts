import { isoDate } from "../date";
import type { Game } from "./types";

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

export const fourByThree: Game = {
  id: "4x3",
  name: "4x3",
  emoji: "🟦",
  direction: "higher",
  parse(text) {
    if (!/4x3\.fun/i.test(text)) return null;
    const score = text.match(/(\d+)\s+points?\b/i);
    if (!score) return null;
    const date = text.match(/\b([a-z]+)\s+(\d{1,2}),\s*(\d{4})\b/i);
    const month = date ? MONTHS.indexOf(date[1].toLowerCase()) : -1;
    const puzzle = date && month >= 0 ? isoDate(Number(date[3]), month + 1, Number(date[2])) : null;
    return { puzzle, score: Number(score[1]), display: score[1] };
  },
};
