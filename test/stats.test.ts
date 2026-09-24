import { describe, expect, it } from "vitest";
import {
  average,
  comparePuzzles,
  historicalRanking,
  longestCurrentStreak,
  podium,
  validResults,
} from "../src/stats";
import { result } from "./helpers";

const D = "2026-09-24";

describe("comparePuzzles", () => {
  it("compara números como números y el resto como texto", () => {
    expect(comparePuzzles("1000", "999")).toBeGreaterThan(0);
    expect(comparePuzzles("2026-09-24", "2026-09-23")).toBeGreaterThan(0);
    expect(comparePuzzles("S20-Q02", "S20-Q02")).toBe(0);
  });
});

describe("validResults", () => {
  it("se queda con el puzzle más jugado del día y descarta los de archivo", () => {
    const rows = [
      result({ userId: 1, game: "boludle", day: D, puzzle: "1683" }),
      result({ userId: 2, game: "boludle", day: D, puzzle: "1683" }),
      result({ userId: 3, game: "boludle", day: D, puzzle: "1678" }),
    ];
    expect(validResults(rows).map((r) => r.userId)).toEqual([1, 2]);
  });

  it("si empatan, gana el puzzle más nuevo", () => {
    const rows = [
      result({ userId: 1, game: "boludle", day: D, puzzle: "999" }),
      result({ userId: 2, game: "boludle", day: D, puzzle: "1000" }),
    ];
    expect(validResults(rows).map((r) => r.puzzle)).toEqual(["1000"]);
  });

  it("decide por separado para cada juego y cada día", () => {
    const rows = [
      result({ userId: 1, game: "boludle", day: D, puzzle: "1683" }),
      result({ userId: 1, game: "poople", day: D, puzzle: "405" }),
      result({ userId: 1, game: "boludle", day: "2026-09-23", puzzle: "1682" }),
    ];
    expect(validResults(rows)).toHaveLength(3);
  });
});

describe("podium", () => {
  it("en juegos higher gana el más alto", () => {
    const rows = [
      result({ userId: 1, userName: "Ana", game: "4x3", day: D, score: 140, display: "140" }),
      result({ userId: 2, userName: "Cindy", game: "4x3", day: D, score: 161, display: "161" }),
    ];
    expect(podium(rows, "higher", 3)).toEqual([
      { score: 161, names: ["Cindy"], display: "161" },
      { score: 140, names: ["Ana"], display: "140" },
    ]);
  });

  it("en juegos lower gana el más bajo y los empates comparten lugar", () => {
    const rows = [
      result({ userId: 1, userName: "Ana", game: "boludle", day: D, score: 5, display: "5/6" }),
      result({ userId: 2, userName: "Juan", game: "boludle", day: D, score: 4, display: "4/6" }),
      result({ userId: 3, userName: "Lu", game: "boludle", day: D, score: 4, display: "4/6" }),
    ];
    expect(podium(rows, "lower", 3)).toEqual([
      { score: 4, names: ["Juan", "Lu"], display: "4/6" },
      { score: 5, names: ["Ana"], display: "5/6" },
    ]);
  });

  it("deja afuera los fails y respeta el tamaño", () => {
    const rows = [
      result({ userId: 1, game: "boludle", day: D, score: null, display: "X/6" }),
      result({ userId: 2, game: "boludle", day: D, score: 5 }),
      result({ userId: 3, game: "boludle", day: D, score: 3 }),
    ];
    expect(podium(rows, "lower", 1).map((p) => p.score)).toEqual([3]);
    expect(podium([rows[0]], "lower", 3)).toEqual([]);
  });
});

describe("average", () => {
  it("promedia sin fails y redondea a 1 decimal", () => {
    const scores = (...values: (number | null)[]) =>
      values.map((score, i) => result({ userId: i, game: "g", day: D, score }));
    expect(average(scores(4, 5, null))).toBe(4.5);
    expect(average(scores(1, 1, 2))).toBe(1.3);
    expect(average(scores(null))).toBeNull();
  });
});

describe("longestCurrentStreak", () => {
  const played = (userId: number, userName: string, day: string, puzzle = day) =>
    result({ userId, userName, game: "boludle", day, puzzle });

  it("cuenta los días seguidos hasta hoy", () => {
    const rows = [
      played(2, "Juan", "2026-09-22"),
      played(2, "Juan", "2026-09-23"),
      played(2, "Juan", D),
      played(1, "Cindy", "2026-09-23"),
      played(1, "Cindy", D),
    ];
    expect(longestCurrentStreak(validResults(rows), "boludle", D)).toEqual({ names: ["Juan"], days: 3 });
  });

  it("se corta si faltó un día y no muestra rachas de 1", () => {
    const rows = [played(2, "Juan", "2026-09-22"), played(2, "Juan", D)];
    expect(longestCurrentStreak(validResults(rows), "boludle", D)).toBeNull();
  });

  it("un puzzle de archivo no mantiene la racha", () => {
    const rows = [
      played(2, "Juan", "2026-09-23", "1678"),
      played(3, "Ana", "2026-09-23", "1682"),
      played(4, "Lu", "2026-09-23", "1682"),
      played(2, "Juan", D, "1683"),
    ];
    expect(longestCurrentStreak(validResults(rows), "boludle", D)).toBeNull();
  });

  it("los empates se listan juntos y solo cuenta quien jugó hoy", () => {
    const rows = [
      played(1, "Cindy", "2026-09-23"),
      played(1, "Cindy", D),
      played(2, "Juan", "2026-09-23"),
      played(2, "Juan", D),
      played(3, "Ana", "2026-09-21"),
      played(3, "Ana", "2026-09-22"),
      played(3, "Ana", "2026-09-23"),
    ];
    expect(longestCurrentStreak(validResults(rows), "boludle", D)).toEqual({
      names: ["Cindy", "Juan"],
      days: 2,
    });
  });
});

describe("historicalRanking", () => {
  it("cuenta partidas, agrupa empates y usa el nombre más reciente", () => {
    const rows = [
      result({ userId: 1, userName: "Cin", game: "boludle", day: "2026-09-23" }),
      result({ userId: 2, userName: "Juan", game: "boludle", day: "2026-09-23" }),
      result({ userId: 1, userName: "Cindy", game: "boludle", day: D }),
      result({ userId: 2, userName: "Juan", game: "poople", day: D }),
      result({ userId: 3, userName: "Ana", game: "poople", day: D }),
    ];
    expect(historicalRanking(rows, D)).toEqual([
      { names: ["Cindy", "Juan"], games: 2 },
      { names: ["Ana"], games: 1 },
    ]);
  });

  it("no cuenta días posteriores y respeta el tamaño", () => {
    const rows = [
      result({ userId: 1, game: "boludle", day: D }),
      result({ userId: 1, game: "boludle", day: "2026-09-25" }),
      result({ userId: 2, game: "boludle", day: D }),
      result({ userId: 2, game: "poople", day: D }),
    ];
    expect(historicalRanking(rows, D, 1)).toEqual([{ names: ["U2"], games: 2 }]);
  });
});
