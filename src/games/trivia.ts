import { isoDate, monthNumber } from "../date";
import type { Game } from "./types";

export const trivia: Game = {
  id: "trivia",
  name: "La Trivia del Día",
  emoji: "🎓",
  direction: "higher",
  parse(text) {
    const match = text.match(
      /latriviadeldia\.com[^\n]*\n\s*(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})\s*\n(?:[^\n]*\n){0,2}?\s*(\d+)\s*\/\s*(\d+)[ \t]*(?:\n|$)/i,
    );
    if (!match) return null;
    const month = monthNumber(match[2]);
    const puzzle = month ? isoDate(Number(match[3]), month, Number(match[1])) : null;
    return { puzzle, score: Number(match[4]), display: `${match[4]}/${match[5]}` };
  },
};
