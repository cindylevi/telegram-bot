import { isoDate, monthNumber } from "../date";
import type { Game } from "./types";

// La fecha sale en inglés ("September 24, 2026") o en español ("24 de septiembre de 2026")
// según el idioma de quien juega, y la línea siguiente trae los puntos o "Out of guesses".
const RESULT =
  /(?:\b([a-z]+)\s+(\d{1,2}),\s*(\d{4})|\b(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4}))\s*\n\s*(?:(\d+)\s+points?\b|(out of guesses))/i;

export const fourByThree: Game = {
  id: "4x3",
  name: "4x3",
  emoji: "🟦",
  direction: "higher",
  parse(text) {
    if (!/4x3\.fun/i.test(text)) return null;
    const match = text.match(RESULT);
    if (!match) return null;
    const [, monthEn, dayEn, yearEn, dayEs, monthEs, yearEs, points] = match;
    const month = monthNumber(monthEn ?? monthEs);
    const puzzle = month ? isoDate(Number(yearEn ?? yearEs), month, Number(dayEn ?? dayEs)) : null;
    if (points === undefined) return { puzzle, score: null, display: "X" };
    return { puzzle, score: Number(points), display: points };
  },
};
