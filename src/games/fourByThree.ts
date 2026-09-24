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
    const match = text.match(/\b([a-z]+)\s+(\d{1,2}),\s*(\d{4})\s*\n\s*(\d+)\s+points?\b/i);
    if (!match) return null;
    const month = MONTHS.indexOf(match[1].toLowerCase());
    const puzzle = month >= 0 ? isoDate(Number(match[3]), month + 1, Number(match[2])) : null;
    return { puzzle, score: Number(match[4]), display: match[4] };
  },
};
