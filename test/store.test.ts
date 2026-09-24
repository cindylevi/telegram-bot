import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { loadResults, saveResult, type NewResult } from "../src/store";

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
