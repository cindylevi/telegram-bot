import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { findTwins, loadResults, saveResult, type NewResult } from "../src/store";

const base: NewResult = {
  chatId: -1001,
  messageId: 1,
  userId: 42,
  userName: "Cindy",
  game: "boludle",
  puzzle: "1683",
  score: 4,
  display: "4/6",
  day: "2026-09-24",
  createdAt: 1_790_000_000,
  tiebreak: null,
  pattern: "",
};

describe("store", () => {
  it("guarda y lee un resultado", async () => {
    await saveResult(env.DB, base);
    const { chatId, messageId, ...stored } = base;
    expect(await loadResults(env.DB, -1001)).toEqual([stored]);
  });

  it("si el mismo puzzle llega dos veces, queda el primero", async () => {
    await saveResult(env.DB, base);
    await saveResult(env.DB, { ...base, messageId: 2, score: 3, display: "3/6", createdAt: base.createdAt + 60 });
    const rows = await loadResults(env.DB, -1001);
    expect(rows).toHaveLength(1);
    expect(rows[0].display).toBe("4/6");
  });

  it("avisa si guardó el resultado o si era un duplicado", async () => {
    expect(await saveResult(env.DB, base)).toBe(true);
    expect(await saveResult(env.DB, { ...base, messageId: 2 })).toBe(false);
  });

  it("encuentra a quienes tienen el mismo resultado en el mismo puzzle", async () => {
    const trivia = { ...base, game: "trivia", puzzle: "2026-09-24", display: "2/3", pattern: "🟩🟩🟥" };
    await saveResult(env.DB, { ...trivia, userId: 1, userName: "Cindy" });
    await saveResult(env.DB, { ...trivia, userId: 2, userName: "Rafa", pattern: "🟩🟥🟩" });
    await saveResult(env.DB, { ...trivia, userId: 3, userName: "Lu", puzzle: "2026-09-23" });
    await saveResult(env.DB, { ...trivia, userId: 4, userName: "Viejo", pattern: null });
    expect(await findTwins(env.DB, { ...trivia, userId: 5 })).toEqual([{ userId: 1, userName: "Cindy" }]);
  });

  it("con la misma grilla pero distinto puntaje no es matchi matchi", async () => {
    const foxi = { ...base, game: "foximax", puzzle: "1495", pattern: "🟩🟩🟩🟩🟩" };
    await saveResult(env.DB, { ...foxi, userId: 1, userName: "Cindy", display: "6/8" });
    expect(await findTwins(env.DB, { ...foxi, userId: 2, display: "5/8" })).toEqual([]);
  });

  it("sin grilla compara el puntaje exacto", async () => {
    const size = { ...base, game: "size-it-up", puzzle: "2026-09-24", pattern: "" };
    await saveResult(env.DB, { ...size, userId: 1, userName: "Cindy", display: "185" });
    await saveResult(env.DB, { ...size, userId: 2, userName: "Rafa", display: "170" });
    expect(await findTwins(env.DB, { ...size, userId: 3, display: "185" })).toEqual([{ userId: 1, userName: "Cindy" }]);
  });

  it("guarda la grilla", async () => {
    await saveResult(env.DB, { ...base, pattern: "🟩🟩🟥" });
    expect((await loadResults(env.DB, -1001))[0].pattern).toBe("🟩🟩🟥");
  });

  it("guarda el desempate", async () => {
    await saveResult(env.DB, { ...base, tiebreak: 1452 });
    expect((await loadResults(env.DB, -1001))[0].tiebreak).toBe(1452);
  });

  it("guarda los fails con score null", async () => {
    await saveResult(env.DB, { ...base, score: null, display: "X/6" });
    expect((await loadResults(env.DB, -1001))[0].score).toBeNull();
  });

  it("solo lee los resultados del grupo pedido y en orden de llegada", async () => {
    await saveResult(env.DB, { ...base, userId: 2, createdAt: base.createdAt + 10 });
    await saveResult(env.DB, { ...base, userId: 1 });
    await saveResult(env.DB, { ...base, chatId: -2002, userId: 3 });
    expect((await loadResults(env.DB, -1001)).map((r) => r.userId)).toEqual([1, 2]);
  });
});
