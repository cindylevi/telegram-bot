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
    id: "4x3",
    text: `24 de septiembre de 2026
171 points • No mistakes
🌟🟪🟪
🌟🟦🟦
🌟🟨🟨
🌟🟩🟩
https://4x3.fun221:33`,
    expected: { puzzle: "2026-09-24", score: 171, display: "171" },
  },
  {
    id: "4x3",
    text: `September 24, 2026
Out of guesses • 3 mistakes
🟨🌟🟨
🟦🌟🟩
🟦🌟🟪
🟦🌟🟩
https://4x3.fun`,
    expected: { puzzle: "2026-09-24", score: null, display: "X" },
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
  {
    id: "poople",
    text: `Poople #405 6/5
⬜⬜⬜⬜
⬜⬜⬜⬜
⬜🟫⬜⬜
⬜🟫🟫⬜
⬜🟫🟫⬜
⬜🟫🟫🟫
🟫🟫🟫🟫

https://poople.io/`,
    expected: { puzzle: "405", score: 6, display: "6/5" },
  },
  {
    id: "metazooa",
    text: `🦫 Animal #1151 🦖
I figured it out in 6 guesses!
🟧🟧🟧🟧🟧🟩
🔥 1 | Avg. Guesses: 5.5

https://metazooa.com
#metazooa`,
    expected: { puzzle: "1151", score: 6, display: "6" },
  },
  {
    id: "boludle",
    text: `boludle.com #1683 4/6

⬜🟨⬜⬜🟨
⬜🟨⬜⬜🟩
⬜🟨🟩⬜🟩
🟩🟩🟩🟩🟩

#boludle`,
    expected: { puzzle: "1683", score: 4, display: "4/6" },
  },
  {
    id: "boludle",
    text: `boludle.com #1684 X/6

⬜🟨⬜⬜🟨

#boludle`,
    expected: { puzzle: "1684", score: null, display: "X/6" },
  },
  {
    id: "pedantle",
    text: `I found #pedantle #1585 in 89 guesses!
🟩🟩🟩🟩🟩🟧🟧🟧🟧🟧🟧🟥🟥🟥🟥🟥🟥🟥🟥🟥
https://pedantle.certitudes.org/`,
    expected: { puzzle: "1585", score: 89, display: "89" },
  },
  {
    id: "catfishing",
    text: `catfishing.net
#818 - 4.5/10
🐟🐟🐟🐟🥚
🐈🐟🐈🐈🐈`,
    expected: { puzzle: "818", score: 4.5, display: "4.5/10" },
  },
  {
    id: "minute-cryptic",
    text: `Minute Cryptic - 24 September, 2026
"The Godfather Part I" (3)
🟣🟣🟣🟣🟣🟣
🏆 0 hints – 1 under the community par (141,308 solvers so far).
https://www.minutecryptic.com/?utm_source=share`,
    expected: { puzzle: "2026-09-24", score: 0, display: "0 pistas", tiebreak: null },
  },
  {
    id: "minute-cryptic",
    text: `Minute Cryptic - 23 September, 2026
"So, what anagram indicator can I ultimately use?" (1,4,4)
⚪️🟣🟣🟣🟣🟣🟣🟣🟣🟣🟣🟣
🏆 1 hints – 1 under the community par (154,463 solvers so far). Time: 24m 12s.
https://www.minutecryptic.com/?utm_source=share`,
    expected: { puzzle: "2026-09-23", score: 1, display: "1 pista · 24m 12s", tiebreak: 1452 },
  },
];
