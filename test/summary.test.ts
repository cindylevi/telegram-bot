import { describe, expect, it } from "vitest";
import { buildSummary, joinNames } from "../src/summary";
import { result } from "./helpers";

const D = "2026-09-24";

describe("joinNames", () => {
  it("une con coma y 'y'", () => {
    expect(joinNames(["Ana"])).toBe("Ana");
    expect(joinNames(["Ana", "Juan"])).toBe("Ana y Juan");
    expect(joinNames(["Ana", "Juan", "Lu"])).toBe("Ana, Juan y Lu");
  });
});

describe("buildSummary", () => {
  it("arma el resumen completo con podio, racha y ranking", () => {
    const fourByThree = (userId: number, userName: string, day: string, score: number) =>
      result({ userId, userName, game: "4x3", day, score, display: String(score) });
    const boludle = (userId: number, userName: string, score: number | null) =>
      result({
        userId,
        userName,
        game: "boludle",
        day: D,
        puzzle: "1683",
        score,
        display: score === null ? "X/6" : `${score}/6`,
      });

    const rows = [
      fourByThree(2, "Juan", "2026-09-22", 100),
      fourByThree(2, "Juan", "2026-09-23", 100),
      fourByThree(1, "Cindy", "2026-09-23", 100),
      fourByThree(1, "Cindy", D, 161),
      fourByThree(2, "Juan", D, 150),
      fourByThree(3, "Ana", D, 140),
      fourByThree(4, "Pedro", D, 130),
      fourByThree(5, "Lu", D, 120),
      fourByThree(6, "Sofi", D, 110),
      fourByThree(7, "Tomi", D, 113),
      boludle(2, "Juan", 4),
      boludle(3, "Ana", 5),
      boludle(4, "Pedro", null),
    ];

    expect(buildSummary(rows, D)).toBe(
      [
        "📊 Resumen del 24/09",
        "",
        "🎮 Más jugado: 4x3 (7 personas)",
        "",
        "🟦 4x3 — 7 personas · promedio 132",
        "   🥇 Cindy — 161",
        "   🥈 Juan — 150",
        "   🥉 Ana — 140",
        "   🔥 Racha: Juan, 3 días",
        "",
        "🧉 Boludle — 3 personas · promedio 4.5",
        "   🥇 Juan — 4/6",
        "",
        "🏆 Ranking histórico",
        "   🥇 Juan — 4 partidas",
        "   🥈 Cindy, Ana y Pedro — 2",
        "   🥉 Lu, Sofi y Tomi — 1",
      ].join("\n"),
    );
  });

  it("con una sola persona que no lo resolvió: sin promedio ni medalla", () => {
    const rows = [
      result({ userId: 1, userName: "Cindy", game: "boludle", day: D, puzzle: "1683", score: null, display: "X/6" }),
    ];
    expect(buildSummary(rows, D)).toBe(
      [
        "📊 Resumen del 24/09",
        "",
        "🎮 Más jugado: Boludle (1 persona)",
        "",
        "🧉 Boludle — 1 persona",
        "",
        "🏆 Ranking histórico",
        "   🥇 Cindy — 1 partida",
      ].join("\n"),
    );
  });

  it("lista todos los juegos empatados como más jugados", () => {
    const rows = [
      result({ userId: 1, game: "boludle", day: D, puzzle: "1683" }),
      result({ userId: 1, game: "4x3", day: D }),
    ];
    expect(buildSummary(rows, D)).toContain("🎮 Más jugado: 4x3 y Boludle (1 persona)");
  });

  it("devuelve null si ese día no jugó nadie", () => {
    const rows = [result({ userId: 1, game: "boludle", day: "2026-09-23" })];
    expect(buildSummary(rows, D)).toBeNull();
    expect(buildSummary([], D)).toBeNull();
  });
});
