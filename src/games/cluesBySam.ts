import { isoDate, monthNumber } from "../date";
import type { Game } from "./types";

const TITLE = /#CluesBySam,\s*([a-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})[^\n]*?\bin\s+([^\n]+)/i;
const CLOCK = /^(?:(\d+):)?(\d{1,2}):(\d{2})$/;
const UNDER = /less than\s+(\d+)\s+minutes?/i;
const TILE = /🟩|🟨|🟧|🟥|🟦|🟪|🟫|⬛|⬜/gu;

// Errores = casilleros que no son 🟩. Con "in less than 10 minutes" el desempate es la cota (600 s):
// queda adelante de cualquiera que tardó más y detrás de los tiempos exactos menores.
function time(rest: string): { text: string; seconds: number } | null {
  const clock = rest.trim().match(CLOCK);
  if (clock) {
    const [, hours, minutes, secs] = clock;
    return { text: clock[0], seconds: Number(hours ?? 0) * 3600 + Number(minutes) * 60 + Number(secs) };
  }
  const under = rest.match(UNDER);
  if (under) return { text: `<${under[1]} min`, seconds: Number(under[1]) * 60 };
  return null;
}

export const cluesBySam: Game = {
  id: "cluesbysam",
  name: "Clues by Sam",
  emoji: "🕵️",
  url: "https://cluesbysam.com",
  direction: "lower",
  parse(text) {
    const match = text.match(TITLE);
    if (!match) return null;
    const [, monthName, dayOfMonth, year, rest] = match;
    const month = monthNumber(monthName);
    const puzzle = month ? isoDate(Number(year), month, Number(dayOfMonth)) : null;
    const after = text.slice((match.index ?? 0) + match[0].length).split("\n").slice(1);
    const end = after.findIndex((line) => line.trim().replace(TILE, "").trim() !== "");
    const tiles = (end === -1 ? after : after.slice(0, end)).join("").match(TILE) ?? [];
    const errors = tiles.filter((tile) => tile !== "🟩").length;
    const errorsText = errors === 1 ? "1 error" : `${errors} errores`;
    const solved = time(rest);
    if (!solved) return { puzzle, score: errors, display: errorsText, tiebreak: null };
    return { puzzle, score: errors, display: `${errorsText} · ${solved.text}`, tiebreak: solved.seconds };
  },
};
