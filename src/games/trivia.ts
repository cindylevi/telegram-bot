import { isoDate } from "../date";
import type { Game } from "./types";

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function monthIndex(name: string): number {
  const normalized = name.toLowerCase();
  return normalized === "setiembre" ? 8 : MONTHS.indexOf(normalized);
}

export const trivia: Game = {
  id: "trivia",
  name: "La Trivia del Día",
  emoji: "🎓",
  direction: "higher",
  parse(text) {
    if (!/latriviadeldia\.com/i.test(text)) return null;
    const score = text.match(/^\s*(\d+)\s*\/\s*(\d+)\s*$/m);
    if (!score) return null;
    const date = text.match(/(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})/i);
    const month = date ? monthIndex(date[2]) : -1;
    const puzzle = date && month >= 0 ? isoDate(Number(date[3]), month + 1, Number(date[1])) : null;
    return { puzzle, score: Number(score[1]), display: `${score[1]}/${score[2]}` };
  },
};
