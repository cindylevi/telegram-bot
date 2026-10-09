import { monthNumber } from "../date";
import type { Game } from "./types";

// La fecha viene sin año ("September 29"), así que el puzzle es "MM-DD".
const RESULT = /maptap\.gg\s+([a-z]+)\s+(\d{1,2})\b[\s\S]*?Final score:\s*([\d,]+)/i;
const ROUNDS = /^(?:\d+[^\s\d]+\s*)+$/u;

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
    // "87🎓 92🏆 92🏆 82🌟 88🎉": el puntaje de cada ronda, el detalle del MEGA matchi matchi.
    const pattern = match[0].split("\n").map((line) => line.trim()).find((line) => ROUNDS.test(line)) ?? "";
    return { puzzle, score: Number(score), display: score, pattern };
  },
};
