import { createScheduledController, env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import type { Env } from "../src/env";
import worker from "../src/index";
import type { TelegramMessage, TelegramUpdate } from "../src/telegram";
import { FIXTURES } from "./fixtures/games";

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

const CHAT = -1001;
const testEnv: Env = { ...env, GROUP_CHAT_ID: String(CHAT) };
// 2026-09-24 15:00 en Argentina
const DATE = Date.UTC(2026, 8, 24, 18, 0) / 1000;
const boludle = FIXTURES.find((f) => f.id === "boludle")!.text;

let fetchSpy: MockInstance<typeof fetch>;

beforeEach(() => {
  fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response("{}"));
});

afterEach(() => vi.restoreAllMocks());

function message(overrides: Partial<TelegramMessage> = {}): TelegramMessage {
  return {
    message_id: 1,
    date: DATE,
    chat: { id: CHAT },
    from: { id: 42, is_bot: false, first_name: "Cindy" },
    text: boludle,
    ...overrides,
  };
}

// Los handlers no usan ctx, así que se llaman solo con (request, env).
function post(update: TelegramUpdate, secret = "test-secret") {
  return worker.fetch(
    new IncomingRequest("https://bot.test/webhook", {
      method: "POST",
      headers: { "X-Telegram-Bot-Api-Secret-Token": secret, "content-type": "application/json" },
      body: JSON.stringify(update),
    }),
    testEnv,
  );
}

async function storedRows() {
  return (await env.DB.prepare("SELECT user_id, user_name, game, puzzle, day FROM results").all()).results;
}

function sentTexts(): string[] {
  return fetchSpy.mock.calls.map(([, init]) => JSON.parse(String(init?.body)).text);
}

describe("webhook", () => {
  it("guarda un resultado del grupo", async () => {
    const response = await post({ update_id: 1, message: message() });
    expect(response.status).toBe(200);
    expect(await storedRows()).toEqual([
      { user_id: 42, user_name: "Cindy", game: "boludle", puzzle: "1683", day: "2026-09-24" },
    ]);
  });

  it("usa el día de envío como puzzle cuando el juego no trae número", async () => {
    const sizeItUp = FIXTURES.find((f) => f.id === "size-it-up")!.text;
    await post({ update_id: 1, message: message({ text: sizeItUp }) });
    expect((await storedRows())[0]).toMatchObject({ game: "size-it-up", puzzle: "2026-09-24" });
  });

  it("guarda todos los resultados de un mensaje con varios juegos", async () => {
    const pedantle = FIXTURES.find((f) => f.id === "pedantle")!.text;
    const metazooa = FIXTURES.find((f) => f.id === "metazooa")!.text;
    await post({ update_id: 1, message: message({ text: `${pedantle}\n\n${metazooa}` }) });
    const rows = await env.DB.prepare("SELECT game, score FROM results ORDER BY game").all();
    expect(rows.results).toEqual([
      { game: "metazooa", score: 6 },
      { game: "pedantle", score: 89 },
    ]);
  });

  it("avisa en los logs cuando el grupo se migra a supergrupo", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await post({ update_id: 1, message: message({ text: undefined, migrate_to_chat_id: -100999 }) });
    await post({ update_id: 2, message: message({ chat: { id: -100999 }, text: undefined, migrate_from_chat_id: CHAT }) });
    expect(warn.mock.calls.map((call) => String(call[0]))).toEqual([
      expect.stringContaining("UPDATE results SET chat_id = -100999 WHERE chat_id = -1001"),
      expect.stringContaining("-100999"),
    ]);
  });

  it("ignora el duplicado", async () => {
    await post({ update_id: 1, message: message() });
    await post({ update_id: 2, message: message({ message_id: 2 }) });
    expect(await storedRows()).toHaveLength(1);
  });

  it("rechaza un secreto inválido", async () => {
    const response = await post({ update_id: 1, message: message() }, "otro");
    expect(response.status).toBe(401);
    expect(await storedRows()).toHaveLength(0);
  });

  it("ignora otros chats, charla normal, ediciones, bots y mensajes sin autor", async () => {
    await post({ update_id: 1, message: message({ chat: { id: -2002 } }) });
    await post({ update_id: 2, message: message({ text: "buen día gente" }) });
    await post({ update_id: 3, edited_message: message() });
    await post({ update_id: 4, message: message({ from: { id: 1087968824, is_bot: true, first_name: "Group" } }) });
    await post({ update_id: 5, message: message({ from: undefined }) });
    expect(await storedRows()).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("responde 200 aunque el body sea inválido", async () => {
    const response = await worker.fetch(
      new IncomingRequest("https://bot.test/webhook", {
        method: "POST",
        headers: { "X-Telegram-Bot-Api-Secret-Token": "test-secret" },
        body: "no es json",
      }),
      testEnv,
    );
    expect(response.status).toBe(200);
  });

  it("devuelve 404 fuera de POST /webhook", async () => {
    const response = await worker.fetch(new IncomingRequest("https://bot.test/"), testEnv);
    expect(response.status).toBe(404);
  });
});

describe("/resumen", () => {
  it("manda el resumen del día en curso", async () => {
    await post({ update_id: 1, message: message() });
    await post({ update_id: 2, message: message({ message_id: 2, text: "/resumen" }) });
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy.mock.calls[0][0]).toBe("https://api.telegram.org/bottest-token/sendMessage");
    expect(sentTexts()[0]).toContain("📊 Resumen del 24/09");
  });

  it("acepta /resumen@NombreDelBot y avisa si no jugó nadie", async () => {
    await post({ update_id: 1, message: message({ text: "/resumen@ResumenJuegosBot" }) });
    expect(sentTexts()).toEqual(["Hoy todavía no jugó nadie."]);
  });
});

describe("/listdles", () => {
  it("responde con la lista de juegos", async () => {
    await post({ update_id: 1, message: message({ text: "/listdles@StatsReseteoBot" }) });
    expect(sentTexts()).toHaveLength(1);
    expect(sentTexts()[0]).toMatch(/^🎮 Juegos que reconozco/);
    expect(await storedRows()).toHaveLength(0);
  });
});

describe("cron", () => {
  async function runCron() {
    // 02:58 UTC del 25/09 = 23:58 del 24/09 en Argentina
    await worker.scheduled(
      createScheduledController({ scheduledTime: Date.UTC(2026, 8, 25, 2, 58), cron: "58 2 * * *" }),
      testEnv,
    );
  }

  it("manda el resumen del día que termina", async () => {
    await post({ update_id: 1, message: message() });
    await runCron();
    expect(sentTexts()[0]).toContain("📊 Resumen del 24/09");
  });

  it("no manda nada si ese día no jugó nadie", async () => {
    await runCron();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
