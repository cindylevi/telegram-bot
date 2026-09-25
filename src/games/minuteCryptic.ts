import { isoDate, monthNumber } from "../date";
import type { Game } from "./types";

const RESULT =
  /Minute Cryptic\s*-\s*(\d{1,2})\s+([a-z]+),?\s*(\d{4})[\s\S]*?\b(\d+)\s+hints?\b([^\n]*)/i;
const TIME = /Time:\s*((?:\d+h\s*)?(?:\d+m\s*)?(?:\d+s)?)/i;

function seconds(time: string): number {
  const part = (unit: string) => Number(time.match(new RegExp(`(\\d+)${unit}`))?.[1] ?? 0);
  return part("h") * 3600 + part("m") * 60 + part("s");
}

export const minuteCryptic: Game = {
  id: "minute-cryptic",
  name: "Minute Cryptic",
  emoji: "🧩",
  url: "https://www.minutecryptic.com",
  direction: "lower",
  parse(text) {
    if (!/minutecryptic\.com/i.test(text)) return null;
    const match = text.match(RESULT);
    if (!match) return null;
    const [, dayOfMonth, monthName, year, hints, rest] = match;
    const month = monthNumber(monthName);
    const puzzle = month ? isoDate(Number(year), month, Number(dayOfMonth)) : null;
    const hintsText = hints === "1" ? "1 pista" : `${hints} pistas`;
    const time = rest.match(TIME)?.[1].trim();
    if (!time) return { puzzle, score: Number(hints), display: hintsText, tiebreak: null };
    return { puzzle, score: Number(hints), display: `${hintsText} · ${time}`, tiebreak: seconds(time) };
  },
};
