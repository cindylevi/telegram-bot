import { describe, expect, it } from "vitest";
import { buildDetail } from "../src/detail";
import { GAMES } from "../src/games";
import { result } from "./helpers";

const D = "2026-09-24";
const boludle = GAMES.find((game) => game.id === "boludle")!;

const play = (userId: number, userName: string, day: string, score: number | null) =>
  result({ userId, userName, game: "boludle", day, score, display: score === null ? "X/6" : `${score}/6` });

describe("buildDetail", () => {
  it("muestra a todos los de hoy, el mejor histórico y las rachas", () => {
    const rows = [
      play(1, "Ana", "2026-09-19", 5),
      play(1, "Ana", "2026-09-20", 5),
      play(1, "Ana", "2026-09-21", 2),
      play(1, "Ana", "2026-09-22", 5),
      play(2, "Juan", "2026-09-22", 5),
      play(3, "Cindy", "2026-09-22", 5),
      play(2, "Juan", "2026-09-23", 5),
      play(3, "Cindy", "2026-09-23", 5),
      play(4, "Lu", D, 3),
      play(2, "Juan", D, 4),
      play(5, "Tomi", D, 5),
      play(6, "Sofi", D, 6),
      play(7, "Pedro", D, null),
    ];

    expect(buildDetail(rows, boludle, D)).toBe(
      [
        "🧉 Boludle — detalle del 24/09",
        "",
        "Hoy · 5 personas · promedio 4.5",
        "   🥇 Lu — 3/6",
        "   🥈 Juan — 4/6",
        "   🥉 Tomi — 5/6",
        "   4. Sofi — 6/6",
        "   ✖️ Pedro — X/6",
        "",
        "🏆 Mejor puntaje histórico: Ana — 2/6 (21/09)",
        "🔥 Racha histórica: Ana, 4 días (del 19/09 al 22/09)",
        "",
        "📈 Rachas actuales",
        "   Juan — 3 días",
        "   Cindy — 2 días (le falta jugar hoy)",
      ].join("\n"),
    );
  });

  it("sin jugadores hoy muestra igual lo histórico", () => {
    const rows = [play(1, "Ana", "2026-09-22", 2)];
    expect(buildDetail(rows, boludle, D)).toBe(
      [
        "🧉 Boludle — detalle del 24/09",
        "",
        "Hoy todavía no jugó nadie.",
        "",
        "🏆 Mejor puntaje histórico: Ana — 2/6 (22/09)",
      ].join("\n"),
    );
  });

  it("un juego que nunca se jugó", () => {
    expect(buildDetail([], boludle, D)).toBe("🧉 Boludle — detalle del 24/09\n\nHoy todavía no jugó nadie.");
  });
});
