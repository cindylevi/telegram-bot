import type { ParsedResult } from "../../src/games/types";

export interface Fixture {
  id: string;
  text: string;
  expected: ParsedResult;
}

export const FIXTURES: Fixture[] = [
  {
    id: "4x3",
    text: `September 24, 2026
161 points • No mistakes
🌟🟦🟦
🌟🟪🟪
🌟🟨🟨
🌟🟩🟩
https://4x3.fun`,
    expected: { puzzle: "2026-09-24", score: 161, display: "161" },
  },
  {
    id: "magnitudle",
    text: `Magnitudle — Daily Question S20 · Q02

Score: 70/100
🟥🟥🟥🟥🟥🟥🟥◻️◻️◻️ https://magnitudle.com/daily`,
    expected: { puzzle: "S20-Q02", score: 70, display: "70/100" },
  },
  {
    id: "size-it-up",
    text: `Size It Up
Overall Score 185

🟥🟥⬜️⬜️⬜️ 43
🟥🟥🟥🟥⬜️ 74
🟥🟥⬜️⬜️⬜️ 30
🟥🟥⬜️⬜️⬜️ 30
⬜️⬜️⬜️⬜️⬜️ 8
https://magnitudle.com/size-it-up`,
    expected: { puzzle: null, score: 185, display: "185" },
  },
  {
    id: "krillion",
    text: `Krillion #70 🦐
385

🐟🦑🏮🦑🦑🦑🐟`,
    expected: { puzzle: "70", score: 385, display: "385" },
  },
  {
    id: "foximax",
    text: `🦊#FoxiMax #1488 6/8 (18 letters)
https://foximax.com/

🟩🟩🟩🟩🟩
🟩🟩🟩🟩🟩
🟩🟩🟩🟩🟩
🟩🟩🟩🟩🟩
⬜🟩🟩⬜🟩
🟩⬜🟩🟩🟩`,
    expected: { puzzle: "1488", score: 6, display: "6/8" },
  },
  {
    id: "foximax",
    text: `🦊#FoxiMax #1489 X/8 (18 letters)
https://foximax.com/`,
    expected: { puzzle: "1489", score: null, display: "X/8" },
  },
  {
    id: "trivia",
    text: `🎓 https://latriviadeldia.com/
23 de septiembre de 2026
🟩🟩🟩🟩🟥🟩🟥
5/7`,
    expected: { puzzle: "2026-09-23", score: 5, display: "5/7" },
  },
];
