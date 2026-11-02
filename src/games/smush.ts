import { monthNumber } from "../date";
import type { Game } from "./types";

// "hankgreen.com/smush · 25 oct\n441 pts · ★★ pangram first · 5-day streak": la fecha viene sin año,
// así que el puzzle es "MM-DD". En inglés el mes va primero ("Oct 30").
const RESULT =
  /hankgreen\.com\/smush\s*·\s*(?:(\d{1,2})\s+([a-z]+)|([a-z]+)\s+(\d{1,2}))\s*\n\s*([\d,]+)\s*pts\b\s*(?:·\s*(★+))?/iu;

export const smush: Game = {
  id: "smush",
  name: "Smush",
  emoji: "🥞",
  url: "https://hankgreen.com/smush",
  direction: "higher",
  parse(text) {
    const match = text.match(RESULT);
    if (!match) return null;
    const [, dayFirst, monthSecond, monthFirst, daySecond, points, stars] = match;
    const day = dayFirst ?? daySecond;
    const monthName = monthSecond ?? monthFirst;
    const month = monthNumber(monthName);
    const puzzle = month ? `${String(month).padStart(2, "0")}-${day.padStart(2, "0")}` : null;
    return { puzzle, score: Number(points.replace(/,/g, "")), display: stars ? `${points} · ${stars}` : points };
  },
};
