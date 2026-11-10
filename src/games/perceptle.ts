import type { Game } from "./types";

// "Perceptle #116 - D (47)\n🔢 9 🎯 0 📐 70 🥁 56 ✂️ 100": el puntaje es el promedio de las cinco pruebas
// (0 a 100) y la letra es su nota.
const RESULT = /Perceptle\s*#(\d+)\s*[-–—]\s*([A-Z][+-]?)\s*\((\d+)\)[^\S\n]*\n([^\n]*)/u;

export const perceptle: Game = {
  id: "perceptle",
  name: "Perceptle",
  emoji: "👁️",
  url: "https://perceptle.com",
  direction: "higher",
  parse(text) {
    const match = text.match(RESULT);
    if (!match) return null;
    const [, puzzle, grade, score, rounds] = match;
    // Lo que sacó en cada prueba ("🔢 9 🎯 0 📐 70 🥁 56 ✂️ 100"): el detalle del MEGA matchi matchi.
    return { puzzle, score: Number(score), display: `${grade} · ${score}`, pattern: rounds.trim() };
  },
};
