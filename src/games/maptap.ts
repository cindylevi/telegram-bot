import { monthNumber } from "../date";
import type { Game } from "./types";

// La fecha viene sin año ("September 29"), así que el puzzle es "MM-DD".
const RESULT = /maptap\.gg\s+([a-z]+)\s+(\d{1,2})\b[\s\S]*?Final score:\s*([\d,]+)/i;

export const maptap: Game = {
  id: "maptap",
  name: "MapTap",
  emoji: "🗺️",
  url: "https://www.maptap.gg",
  direction: "higher",
  parse(text) {
    const match = text.match(RESULT);
    if (!match) return null;
    const month = monthNumber(match[1]);
    const puzzle = month ? `${String(month).padStart(2, "0")}-${match[2].padStart(2, "0")}` : null;
    const score = match[3].replace(/,/g, "");
    return { puzzle, score: Number(score), display: score };
  },
};
