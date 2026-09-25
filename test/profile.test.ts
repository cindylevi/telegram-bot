import { describe, expect, it } from "vitest";
import { GAMES } from "../src/games";
import { buildProfile, findPlayers } from "../src/profile";
import { result } from "./helpers";

const D = "2026-09-24";

describe("findPlayers", () => {
  const rows = [
    result({ userId: 1, userName: "Rafa", game: "boludle", day: D }),
    result({ userId: 2, userName: "Rafael", game: "boludle", day: D }),
    result({ userId: 3, userName: "Valentín", game: "boludle", day: D }),
  ];

  it("el nombre exacto gana sobre el comienzo", () => {
    expect(findPlayers(rows, "rafa")).toEqual({ exact: true, matches: [{ userId: 1, name: "Rafa" }] });
    expect(findPlayers(rows, "RAFAEL")).toEqual({ exact: true, matches: [{ userId: 2, name: "Rafael" }] });
  });

  it("sin exacto busca por el comienzo, sin importar tildes", () => {
    expect(findPlayers(rows, "raf").matches.map((p) => p.name)).toEqual(["Rafa", "Rafael"]);
    expect(findPlayers(rows, "valentin")).toEqual({ exact: true, matches: [{ userId: 3, name: "Valentín" }] });
    expect(findPlayers(rows, "vale")).toEqual({ exact: false, matches: [{ userId: 3, name: "Valentín" }] });
  });

  it("no encuentra a nadie", () => {
    expect(findPlayers(rows, "juan").matches).toEqual([]);
  });

  it("usa el nombre más reciente de cada persona", () => {
    const renamed = [...rows, result({ userId: 1, userName: "Rafita", game: "boludle", day: D })];
    expect(findPlayers(renamed, "rafita").matches).toEqual([{ userId: 1, name: "Rafita" }]);
  });
});

describe("buildProfile", () => {
  const play = (userId: number, userName: string, game: string, day: string, score: number, display: string) =>
    result({ userId, userName, game, day, score, display });

  const rows = [
    play(1, "Cindy", "boludle", "2026-09-22", 2, "2/6"),
    play(2, "Rafa", "boludle", "2026-09-22", 3, "3/6"),
    play(1, "Cindy", "boludle", "2026-09-23", 3, "3/6"),
    play(2, "Rafa", "boludle", "2026-09-23", 3, "3/6"),
    play(1, "Cindy", "boludle", D, 4, "4/6"),
    play(2, "Rafa", "boludle", D, 3, "3/6"),
    play(1, "Cindy", "4x3", D, 161, "161"),
    play(2, "Rafa", "4x3", D, 150, "150"),
  ];
  const cindy = { userId: 1, name: "Cindy" };
  const missing = GAMES.filter((g) => g.id !== "boludle" && g.id !== "4x3").map((g) => `   ${g.emoji} ${g.name} — ${g.url}`);

  it("arma el detalle propio con partidas, oros, récords y lo que falta hoy", () => {
    expect(buildProfile(rows, cindy, D, true)).toBe(
      [
        "👤 Cindy — detalle",
        "",
        "🎮 4 partidas en 2 juegos · 🥇 3 oros",
        "📅 Jugaste 3 días (desde el 22/09)",
        "⭐ Más jugado: Boludle (3 partidas)",
        "",
        "Por juego",
        "🧉 Boludle — 3 partidas · 🥇 2 · mejor 2/6 · racha 3 (récord 3)",
        "🟦 4x3 — 1 partida · 🥇 1 · mejor 161",
        "",
        "📌 Hoy",
        "✅ Ya jugaste: 🟦 4x3 161 · 🧉 Boludle 4/6",
        `⏳ Te faltan (${missing.length}):`,
        ...missing,
      ].join("\n"),
    );
  });

  it("habla en tercera persona cuando es el detalle de otro", () => {
    const text = buildProfile(rows, cindy, D, false);
    expect(text).toContain("📅 Jugó 3 días (desde el 22/09)");
    expect(text).toContain("✅ Ya jugó: ");
    expect(text).toContain(`⏳ Le faltan (${missing.length}):\n${missing[0]}`);
  });

  it("cuenta como viva la racha de ayer y muestra el récord aunque se haya cortado", () => {
    const history = [
      play(1, "Cindy", "boludle", "2026-09-19", 4, "4/6"),
      play(1, "Cindy", "boludle", "2026-09-20", 4, "4/6"),
      play(1, "Cindy", "boludle", "2026-09-21", 4, "4/6"),
      play(1, "Cindy", "boludle", "2026-09-23", 4, "4/6"),
    ];
    expect(buildProfile(history, cindy, D, true)).toContain("🧉 Boludle — 4 partidas · 🥇 4 · mejor 4/6 · racha 1 (récord 3)");
  });

  it("sin partidas muestra igual lo que falta hoy", () => {
    const text = buildProfile([], cindy, D, true);
    expect(text).toContain("👤 Cindy — detalle\n\nTodavía no tenés partidas.");
    expect(text).toContain("✅ Ya jugaste: ninguno todavía");
  });

  it("festeja si ya jugó todos", () => {
    const all = GAMES.map((game) => play(1, "Cindy", game.id, D, 1, "1"));
    expect(buildProfile(all, cindy, D, true).endsWith("📌 Hoy\n🎉 ¡Ya jugaste todos!")).toBe(true);
  });
});
