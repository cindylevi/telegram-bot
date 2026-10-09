import { isoDate, monthNumber } from "../date";
import type { Game } from "./types";

const RESULT =
  /Minute Cryptic\s*-\s*(\d{1,2})\s+([a-z]+),?\s*(\d{4})[\s\S]*?\b(\d+)\s+hints?\b([^\n]*)/i;
const TIME = /Time:\s*((?:\d+h\s*)?(?:\d+m\s*)?(?:\d+s)?)/i;
const GRID = /^[^\p{L}\p{N}]+$/u;

export const minuteCryptic: Game = {
  id: "minute-cryptic",
  name: "Minute Cryptic",
  emoji: "🧩",
  url: "https://www.minutecryptic.com",
  direction: "lower",
  common: false,
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
    // El tiempo no cuenta para el ranking: solo para el MEGA matchi matchi, junto con la grilla.
    const grid = match[0].split("\n").map((line) => line.trim()).filter((line) => GRID.test(line));
    return { puzzle, score: Number(hints), display: hintsText, tiebreak: null, pattern: [...grid, time].join("\n") };
  },
};
