import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { loadResults, saveResult, type NewResult } from "../src/store";

// Corre de nuevo una migración sobre filas guardadas con el formato anterior.
async function rerun(prefix: string) {
  const migration = env.TEST_MIGRATIONS.find((m) => m.name.startsWith(prefix))!;
  await env.DB.batch(migration.queries.map((query) => env.DB.prepare(query)));
}

describe("0005: el tiempo de Minute Cryptic pasa al detalle", () => {
  const base: NewResult = {
    chatId: -1001,
    messageId: 1,
    userId: 1,
    userName: "Cindy",
    game: "minute-cryptic",
    puzzle: "2026-09-23",
    score: 1,
    display: "1 pista · 24m 12s",
    day: "2026-09-23",
    createdAt: 1,
    tiebreak: 1452,
    pattern: "⚪️🟣🟣",
  };

  it("saca el tiempo del puntaje y del desempate y lo suma a la grilla", async () => {
    await saveResult(env.DB, base);
    await saveResult(env.DB, { ...base, userId: 2, pattern: null });
    await saveResult(env.DB, { ...base, userId: 3, display: "0 pistas", score: 0, tiebreak: null, pattern: "🟣🟣🟣" });
    await saveResult(env.DB, { ...base, userId: 4, game: "cluesbysam", display: "1 error · 03:19", tiebreak: 199 });
    await rerun("0005");
    const rows = (await loadResults(env.DB, -1001)).map(({ userId, display, tiebreak, pattern }) => ({ userId, display, tiebreak, pattern }));
    expect(rows).toEqual([
      { userId: 1, display: "1 pista", tiebreak: null, pattern: "⚪️🟣🟣\n24m 12s" },
      { userId: 2, display: "1 pista", tiebreak: null, pattern: null },
      { userId: 3, display: "0 pistas", tiebreak: null, pattern: "🟣🟣🟣" },
      { userId: 4, display: "1 error · 03:19", tiebreak: 199, pattern: "⚪️🟣🟣" },
    ]);
  });
});
