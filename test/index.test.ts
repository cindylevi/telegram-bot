import { createExecutionContext, createScheduledController, env, waitOnExecutionContext } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import type { Env } from "../src/env";
import { commandName, GAMES } from "../src/games";
import worker from "../src/index";
import type { TelegramMessage, TelegramUpdate } from "../src/telegram";
import { FIXTURES } from "./fixtures/games";

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

const CHAT = -1001;
const quickAction = vi.fn<(action: string, options: { html: string }) => Promise<Response>>();
const testEnv: Env = { ...env, GROUP_CHAT_ID: String(CHAT), BROWSER: { quickAction } as unknown as BrowserRun };
// 2026-09-24 15:00 en Argentina
const DATE = Date.UTC(2026, 8, 24, 18, 0) / 1000;
const boludle = FIXTURES.find((f) => f.id === "boludle")!.text;

let fetchSpy: MockInstance<typeof fetch>;
let memberStatus = "member";

beforeEach(() => {
  memberStatus = "member";
  quickAction.mockReset();
  quickAction.mockImplementation(async () => new Response(new Uint8Array([137, 80, 78, 71])));
  fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
    const path = String(url);
    if (path.endsWith("/getChatMember")) {
      return new Response(JSON.stringify({ ok: true, result: { status: memberStatus } }));
    }
    if (path.endsWith("/getUserProfilePhotos")) {
      const { user_id } = JSON.parse(String(init?.body));
      const photos = user_id === 2 ? [[{ file_id: "rafa-chica" }, { file_id: "rafa-grande" }]] : [];
      return new Response(JSON.stringify({ ok: true, result: { photos } }));
    }
    if (path.endsWith("/getFile")) return new Response(JSON.stringify({ ok: true, result: { file_path: "photos/rafa.jpg" } }));
    if (path.endsWith("/photos/rafa.jpg")) return new Response(new Uint8Array([1, 2, 3]));
    return new Response("{}");
  });
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

// Los avisos que tardan (la foto del MEGA) corren en ctx.waitUntil: se espera a que terminen.
async function post(update: TelegramUpdate, secret = "test-secret") {
  const ctx = createExecutionContext();
  const response = await worker.fetch(
    new IncomingRequest("https://bot.test/webhook", {
      method: "POST",
      headers: { "X-Telegram-Bot-Api-Secret-Token": secret, "content-type": "application/json" },
      body: JSON.stringify(update),
    }),
    testEnv,
    ctx,
  );
  await waitOnExecutionContext(ctx);
  return response;
}

async function storedRows() {
  return (await env.DB.prepare("SELECT user_id, user_name, game, puzzle, day FROM results").all()).results;
}

function sent(): { chat_id: number; text: string }[] {
  return fetchSpy.mock.calls
    .filter(([url]) => String(url).endsWith("/sendMessage"))
    .map(([, init]) => JSON.parse(String(init?.body)));
}

function sentTexts(): string[] {
  return sent().map((body) => body.text);
}

function photos(): { chat_id: string; caption: string }[] {
  return fetchSpy.mock.calls
    .filter(([url]) => String(url).endsWith("/sendPhoto"))
    .map(([, init]) => {
      const form = init?.body as FormData;
      return { chat_id: String(form.get("chat_id")), caption: String(form.get("caption")) };
    });
}

describe("webhook", () => {
  it("guarda un resultado del grupo", async () => {
    const response = await post({ update_id: 1, message: message() });
    expect(response.status).toBe(200);
    expect(await storedRows()).toEqual([
      { user_id: 42, user_name: "Cindy", game: "boludle", puzzle: "1683", day: "2026-09-24" },
    ]);
    const { results } = await env.DB.prepare("SELECT pattern FROM results").all();
    expect(results).toEqual([{ pattern: "⬜🟨⬜⬜🟨\n⬜🟨⬜⬜🟩\n⬜🟨🟩⬜🟩\n🟩🟩🟩🟩🟩" }]);
  });

  it("usa el día de envío como puzzle cuando el juego no trae número", async () => {
    const sizeItUp = FIXTURES.find((f) => f.id === "size-it-up")!.text;
    await post({ update_id: 1, message: message({ text: sizeItUp }) });
    expect((await storedRows())[0]).toMatchObject({ game: "size-it-up", puzzle: "2026-09-24" });
  });

  it("en Pedantle lo mandado desde las 16 cuenta para el día siguiente", async () => {
    const pedantle = (n: number) => `I found #pedantle #${n} in 54 guesses!`;
    const rafa = { id: 2, is_bot: false, first_name: "Rafa" };
    const at = (hourUtc: number) => Date.UTC(2026, 8, 30, hourUtc, 20) / 1000;
    await post({ update_id: 1, message: message({ text: pedantle(1595), date: at(18) }) }); // 15:20 ART
    await post({ update_id: 2, message: message({ message_id: 2, from: rafa, text: pedantle(1596), date: at(23) }) }); // 20:20 ART
    const rows = await env.DB.prepare("SELECT user_name, puzzle, day FROM results ORDER BY id").all();
    expect(rows.results).toEqual([
      { user_name: "Cindy", puzzle: "1595", day: "2026-09-30" },
      { user_name: "Rafa", puzzle: "1596", day: "2026-10-01" },
    ]);
  });

  it("usa el apodo de quienes tienen uno en vez del nombre de Telegram", async () => {
    await post({ update_id: 1, message: message({ from: { id: 5190757894, is_bot: false, first_name: "J" } }) });
    expect((await storedRows())[0]).toMatchObject({ user_name: "Juanma B." });
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
      createExecutionContext(),
    );
    expect(response.status).toBe(200);
  });

  it("devuelve 404 fuera de POST /webhook", async () => {
    const response = await worker.fetch(new IncomingRequest("https://bot.test/"), testEnv, createExecutionContext());
    expect(response.status).toBe(404);
  });
});

describe("aviso de matchi matchi", () => {
  const rafa = { id: 2, is_bot: false, first_name: "Rafa" };
  const juan = { id: 3, is_bot: false, first_name: "Juan" };
  const otraGrilla = boludle.replace("⬜🟨⬜⬜🟨", "🟨⬜⬜⬜🟨");

  it("misma grilla y mismo puntaje es MEGA", async () => {
    await post({ update_id: 1, message: message() });
    expect(sent()).toEqual([]);
    await post({ update_id: 2, message: message({ message_id: 2, from: rafa }) });
    expect(photos().map((photo) => photo.caption)).toEqual(["💖 ¡MEGA MATCHI MATCHI de Cindy y Rafa en 🧉 Boludle!"]);
  });

  it("el MEGA sale con foto: Rafa con su foto de perfil, Cindy con la inicial", async () => {
    await post({ update_id: 1, message: message() });
    await post({ update_id: 2, message: message({ message_id: 2, from: rafa }) });
    expect(photos()).toEqual([{ chat_id: String(CHAT), caption: "💖 ¡MEGA MATCHI MATCHI de Cindy y Rafa en 🧉 Boludle!" }]);
    expect(sent()).toEqual([]);
    // Sin esperar la marca, en el Chrome de Cloudflare no cargan las tipografías.
    expect(quickAction.mock.calls[0][1]).toMatchObject({ waitForSelector: { selector: "#fonts-ready" } });
    const html = quickAction.mock.calls[0][1].html;
    expect(html).toContain("data:image/jpeg;base64,AQID");
    expect(html).toMatch(/>C<\/div>/);
  });

  it("usa la foto elegida con /mifoto antes que la de perfil", async () => {
    await env.DB.prepare("INSERT INTO user_photos (user_id, file_id, updated_at) VALUES (2, 'elegida', 0)").run();
    await post({ update_id: 1, message: message() });
    await post({ update_id: 2, message: message({ message_id: 2, from: rafa }) });
    const getFiles = fetchSpy.mock.calls.filter(([url]) => String(url).endsWith("/getFile"));
    expect(getFiles.map(([, init]) => JSON.parse(String(init?.body)).file_id)).toEqual(["elegida"]);
  });

  it("si falla la foto de alguien, va con su inicial y el MEGA sale igual con foto", async () => {
    fetchSpy.mockImplementation(async (url) => {
      if (String(url).endsWith("/getFile")) return new Response("{}", { status: 400 });
      if (String(url).endsWith("/getUserProfilePhotos")) {
        return new Response(JSON.stringify({ ok: true, result: { photos: [[{ file_id: "x" }]] } }));
      }
      return new Response("{}");
    });
    await post({ update_id: 1, message: message() });
    await post({ update_id: 2, message: message({ message_id: 2, from: rafa }) });
    expect(photos()).toHaveLength(1);
    expect(quickAction.mock.calls[0][1].html).toMatch(/>R<\/div>/);
  });

  it("si falla el render, el MEGA sale como texto", async () => {
    quickAction.mockImplementation(async () => new Response("sin cuota", { status: 429 }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await post({ update_id: 1, message: message() });
    await post({ update_id: 2, message: message({ message_id: 2, from: rafa }) });
    expect(photos()).toEqual([]);
    expect(sentTexts()).toEqual(["💖 ¡MEGA MATCHI MATCHI de Cindy y Rafa en 🧉 Boludle!"]);
  });

  it("con más de 6 personas la foto lleva 6 y el epígrafe nombra a todas", async () => {
    for (let id = 1; id <= 7; id++) {
      const from = { id: 100 + id, is_bot: false, first_name: `P${id}` };
      await post({ update_id: id, message: message({ message_id: id, from }) });
    }
    const last = quickAction.mock.calls.at(-1)![1].html;
    expect(last.match(/class="half[ "]/g)).toHaveLength(6);
    expect(photos().at(-1)!.caption).toBe("💖 ¡MEGA MATCHI MATCHI de P1, P2, P3, P4, P5, P6 y P7 en 🧉 Boludle!");
  });

  it("mismo puntaje con otra grilla es matchi matchi común", async () => {
    const foxi = FIXTURES.find((f) => f.id === "foximax")!.text;
    await post({ update_id: 1, message: message({ text: foxi }) });
    await post({ update_id: 2, message: message({ message_id: 2, from: rafa, text: foxi.replace("⬜🟩🟩⬜🟩", "🟩⬜🟩⬜🟩") }) });
    expect(sentTexts()).toEqual(["👯 ¡Cindy y Rafa hicieron matchi matchi en 🦊 FoxiMax!"]);
  });

  it("en Boludle el mismo puntaje con otra grilla no avisa", async () => {
    await post({ update_id: 1, message: message() });
    await post({ update_id: 2, message: message({ message_id: 2, from: rafa, text: otraGrilla }) });
    expect(sent()).toEqual([]);
    expect(photos()).toEqual([]);
  });

  it("si se suma alguien vuelve a avisar con los del MEGA", async () => {
    await post({ update_id: 1, message: message() });
    await post({ update_id: 2, message: message({ message_id: 2, from: rafa, text: otraGrilla }) });
    await post({ update_id: 3, message: message({ message_id: 3, from: juan }) });
    expect(photos().at(-1)!.caption).toBe("💖 ¡MEGA MATCHI MATCHI de Cindy y Juan en 🧉 Boludle!");
  });

  it("no avisa si el puntaje es distinto ni si reenvían el mismo resultado", async () => {
    const otroPuntaje = boludle.replace("#1683 4/6", "#1683 5/6");
    await post({ update_id: 1, message: message() });
    await post({ update_id: 2, message: message({ message_id: 2, from: rafa, text: otroPuntaje }) });
    await post({ update_id: 3, message: message({ message_id: 3 }) });
    expect(sent()).toEqual([]);
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

describe("/<juego>detalle", () => {
  it("responde con el detalle del juego", async () => {
    await post({ update_id: 1, message: message() });
    await post({ update_id: 2, message: message({ message_id: 2, text: "/boludledetalle@StatsReseteoBot" }) });
    expect(sentTexts()).toHaveLength(1);
    expect(sentTexts()[0]).toMatch(/^🧉 Boludle — detalle del 24\/09/);
    expect(sentTexts()[0]).toContain("🥇 Cindy — 4/6");
  });

  it("acepta los juegos con guion en el id", async () => {
    await post({ update_id: 1, message: message({ text: "/minutecrypticdetalle" }) });
    expect(sentTexts()[0]).toMatch(/^🧩 Minute Cryptic — detalle/);
  });

  it("ignora un juego que no existe", async () => {
    await post({ update_id: 1, message: message({ text: "/noexistedetalle" }) });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("/help", () => {
  it("lista todos los comandos", async () => {
    await post({ update_id: 1, message: message({ text: "/help@StatsReseteoBot" }) });
    expect(sentTexts()).toHaveLength(1);
    const lines = sentTexts()[0].split("\n");
    for (const command of ["/resumen", "/listdles", "/detalle", "/mifoto", "/help"]) {
      expect(sentTexts()[0]).toContain(command);
    }
    for (const game of GAMES) {
      expect(lines).toContain(`/${commandName(game)}detalle — ${game.emoji} ${game.name}`);
    }
  });
});

describe("/detalle <nombre>", () => {
  const rafa = { id: 2, is_bot: false, first_name: "Rafa" };
  const rafael = { id: 3, is_bot: false, first_name: "Rafael" };

  async function seed() {
    await post({ update_id: 1, message: message() });
    await post({ update_id: 2, message: message({ message_id: 2, from: rafa }) });
    await post({ update_id: 3, message: message({ message_id: 3, from: rafael }) });
    fetchSpy.mockClear(); // los avisos de matchi matchi no son parte de estos tests
  }

  it("con el nombre exacto muestra a esa persona aunque otro nombre empiece igual", async () => {
    await seed();
    await post({ update_id: 4, message: message({ message_id: 4, text: "/detalle Rafa" }) });
    expect(sentTexts()[0]).toMatch(/^👤 Rafa — detalle/);
    expect(sentTexts()[0]).toContain("Ya jugó");
  });

  it("si el comienzo coincide con varios, los lista", async () => {
    await seed();
    await post({ update_id: 4, message: message({ message_id: 4, text: "/detalle@StatsReseteoBot raf" }) });
    expect(sentTexts()).toEqual([
      "Hay más de una persona con ese nombre:\n• Rafa → /detalle Rafa\n• Rafael → /detalle Rafael",
    ]);
  });

  it("sin nombre muestra el propio", async () => {
    await seed();
    await post({ update_id: 4, message: message({ message_id: 4, text: "/detalle" }) });
    expect(sentTexts()[0]).toMatch(/^👤 Cindy — detalle/);
    expect(sentTexts()[0]).toContain("Ya jugaste");
  });

  it("respondiendo a un mensaje muestra a quien lo mandó", async () => {
    await seed();
    const replied = message({ message_id: 3, from: rafael });
    await post({ update_id: 4, message: message({ message_id: 4, text: "/detalle", reply_to_message: replied }) });
    expect(sentTexts()[0]).toMatch(/^👤 Rafael — detalle/);
  });

  it("avisa si no encuentra a nadie", async () => {
    await seed();
    await post({ update_id: 4, message: message({ message_id: 4, text: "/detalle Juan" }) });
    expect(sentTexts()).toEqual(["No encontré a nadie que se llame así."]);
  });

  it("si dos personas se llaman igual, pide responder a un mensaje", async () => {
    await seed();
    const otroRafa = { id: 4, is_bot: false, first_name: "Rafa" };
    await post({ update_id: 4, message: message({ message_id: 4, from: otroRafa }) });
    fetchSpy.mockClear();
    await post({ update_id: 5, message: message({ message_id: 5, text: "/detalle rafa" }) });
    expect(sentTexts()).toEqual([
      "Hay más de una persona que se llama Rafa. Mandá /detalle respondiendo a un mensaje de la que querés.",
    ]);
  });
});

describe("por privado", () => {
  const USER = 42;
  const dm = (overrides: Partial<TelegramMessage> = {}) =>
    message({ chat: { id: USER, type: "private" }, ...overrides });

  it("responde /resumen en el privado con los datos del grupo", async () => {
    await post({ update_id: 1, message: message() });
    await post({ update_id: 2, message: dm({ message_id: 2, text: "/resumen" }) });
    expect(sent()).toEqual([{ chat_id: USER, text: expect.stringContaining("📊 Resumen del 24/09") }]);
  });

  it("responde el detalle de un juego en el privado", async () => {
    await post({ update_id: 1, message: message() });
    await post({ update_id: 2, message: dm({ message_id: 2, text: "/boludledetalle" }) });
    expect(sent()).toEqual([{ chat_id: USER, text: expect.stringContaining("🥇 Cindy — 4/6") }]);
  });

  it("/start muestra la ayuda", async () => {
    await post({ update_id: 1, message: dm({ text: "/start" }) });
    expect(sentTexts()[0]).toMatch(/^🤖 Comandos/);
  });

  it("rechaza a quien no es del grupo", async () => {
    memberStatus = "left";
    await post({ update_id: 1, message: dm({ text: "/help" }) });
    expect(sent()).toEqual([{ chat_id: USER, text: "Este bot es solo para los miembros del grupo." }]);
    const check = fetchSpy.mock.calls.find(([url]) => String(url).endsWith("/getChatMember"))!;
    expect(JSON.parse(String(check[1]?.body))).toEqual({ chat_id: CHAT, user_id: USER });
  });

  it("no guarda resultados mandados por privado y avisa", async () => {
    await post({ update_id: 1, message: dm() });
    expect(await storedRows()).toHaveLength(0);
    expect(sentTexts()).toEqual(["Los resultados mandalos en el grupo así cuentan 😉"]);
  });

  it("ignora la charla por privado", async () => {
    await post({ update_id: 1, message: dm({ text: "hola" }) });
    expect(sent()).toEqual([]);
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

describe("ft", () => {
  const rafa = { id: 2, is_bot: false, first_name: "Rafa" };
  const tomer = { id: 3, is_bot: false, first_name: "Tomer" };
  const fourByThree = FIXTURES.find((f) => f.id === "4x3")!.text;
  const chainle = FIXTURES.find((f) => f.id === "chainle")!.text;

  // Rafa y Tomer ya mandaron algo antes, así el bot los conoce.
  async function knownPlayers() {
    const metazooa = FIXTURES.find((f) => f.id === "metazooa")!.text;
    await post({ update_id: 101, message: message({ message_id: 101, from: rafa, text: metazooa }) });
    await post({ update_id: 102, message: message({ message_id: 102, from: tomer, text: metazooa }) });
    fetchSpy.mockClear();
  }

  async function rowsOf(game: string) {
    const { results } = await env.DB.prepare("SELECT user_name, score, display FROM results WHERE game = ? ORDER BY user_id")
      .bind(game)
      .all();
    return results;
  }

  it("en el mismo mensaje el resultado cuenta también para el ft", async () => {
    await knownPlayers();
    await post({ update_id: 1, message: message({ text: `${boludle}\nft Rafa` }) });
    expect((await rowsOf("boludle")).map((row) => row.user_name).sort()).toEqual(["Cindy", "Rafa"]);
    expect(sentTexts()).toEqual(["🤝 Anotado también para Rafa en 🧉 Boludle"]);
  });

  it("cada ft vale para los resultados que tiene arriba", async () => {
    await knownPlayers();
    await post({ update_id: 1, message: message({ text: `${fourByThree}\n ft Rafa \n\n${chainle}\n ft tomer zoe etc` }) });
    const players = async (game: string) => (await rowsOf(game)).map((row) => row.user_name).sort();
    expect(await players("4x3")).toEqual(["Cindy", "Rafa"]);
    expect(await players("chainle")).toEqual(["Cindy", "Tomer"]);
    expect(sentTexts()).toEqual([
      "🤝 Anotado también para Rafa en 🟦 4x3\n🤝 Anotado también para Tomer en 🔗 Chainle\nNo conozco a zoe: que mande un resultado propio primero.",
    ]);
  });

  it("un ft único al final vale para todos los juegos del mensaje", async () => {
    await knownPlayers();
    await post({ update_id: 1, message: message({ text: `${fourByThree}\n\n${chainle}\nft Rafa` }) });
    expect((await rowsOf("4x3")).map((row) => row.user_name).sort()).toEqual(["Cindy", "Rafa"]);
    expect((await rowsOf("chainle")).map((row) => row.user_name).sort()).toEqual(["Cindy", "Rafa"]);
  });

  it("el ft en el mensaje siguiente vale para el último resultado de los últimos 10 minutos", async () => {
    await knownPlayers();
    await post({ update_id: 1, message: message({ message_id: 1, text: `${fourByThree}\n\n${chainle}` }) });
    await post({ update_id: 2, message: message({ message_id: 3, date: DATE + 120, text: "ft Rafa" }) });
    expect((await rowsOf("chainle")).map((row) => row.user_name).sort()).toEqual(["Cindy", "Rafa"]);
    expect((await rowsOf("4x3")).map((row) => row.user_name).sort()).toEqual(["Cindy", "Rafa"]);
    expect(sentTexts()).toEqual(["🤝 Anotado también para Rafa en 🟦 4x3\n🤝 Anotado también para Rafa en 🔗 Chainle"]);
  });

  it("ignora el ft que llega pasados los 10 minutos", async () => {
    await knownPlayers();
    await post({ update_id: 1, message: message({ message_id: 1 }) });
    await post({ update_id: 2, message: message({ message_id: 2, date: DATE + 601, text: "ft Rafa" }) });
    expect((await rowsOf("boludle")).map((row) => row.user_name)).toEqual(["Cindy"]);
    expect(sent()).toEqual([]);
  });

  it("feat @usuario encuentra a quien tiene ese usuario de Telegram", async () => {
    const victoria = { id: 5, is_bot: false, first_name: "Victoria", username: "VictoriaAleF" };
    const metazooa = FIXTURES.find((f) => f.id === "metazooa")!.text;
    await post({ update_id: 101, message: message({ message_id: 101, from: victoria, text: metazooa }) });
    fetchSpy.mockClear();
    await post({ update_id: 1, message: message({ text: `${boludle}\nFeat @VictoriaAleF` }) });
    expect((await rowsOf("boludle")).map((row) => row.user_name).sort()).toEqual(["Cindy", "Victoria"]);
    expect(sentTexts()).toEqual(["🤝 Anotado también para Victoria en 🧉 Boludle"]);
  });

  it("avisa si el nombre es ambiguo y no lo anota", async () => {
    await knownPlayers();
    const rafael = { id: 4, is_bot: false, first_name: "Rafael" };
    const metazooa = FIXTURES.find((f) => f.id === "metazooa")!.text;
    await post({ update_id: 103, message: message({ message_id: 103, from: rafael, text: metazooa }) });
    fetchSpy.mockClear();
    await post({ update_id: 1, message: message({ text: `${boludle}\nft raf` }) });
    expect((await rowsOf("boludle")).map((row) => row.user_name)).toEqual(["Cindy"]);
    expect(sentTexts()).toEqual(['"raf" puede ser Rafa o Rafael: no lo anoté.']);
  });

  it("si el del ft ya había mandado su resultado, vale el suyo", async () => {
    await knownPlayers();
    const otro = boludle.replace("⬜🟨⬜⬜🟨", "🟨⬜⬜⬜🟨");
    await post({ update_id: 1, message: message({ message_id: 1, from: rafa, text: otro }) });
    fetchSpy.mockClear();
    await post({ update_id: 2, message: message({ message_id: 2, text: `${boludle}\nft Rafa` }) });
    const { results } = await env.DB.prepare("SELECT user_name, pattern FROM results WHERE game = 'boludle' AND user_id = 2").all();
    expect(results).toEqual([{ user_name: "Rafa", pattern: expect.stringContaining("🟨⬜⬜⬜🟨") }]);
    expect(sent()).toEqual([]);
  });

  it("no hay matchi matchi dentro del ft, pero sí con alguien de afuera", async () => {
    await knownPlayers();
    await post({ update_id: 1, message: message({ message_id: 1, text: `${boludle}\nft Rafa` }) });
    expect(sentTexts()).toEqual(["🤝 Anotado también para Rafa en 🧉 Boludle"]);
    await post({ update_id: 2, message: message({ message_id: 2, from: tomer }) });
    expect(photos().at(-1)!.caption).toBe("💖 ¡MEGA MATCHI MATCHI de Cindy, Rafa y Tomer en 🧉 Boludle!");
  });

  it("el ft en el mensaje siguiente tampoco es matchi matchi en el resumen", async () => {
    await knownPlayers();
    await post({ update_id: 1, message: message({ message_id: 1 }) });
    await post({ update_id: 2, message: message({ message_id: 2, date: DATE + 60, text: "ft Rafa" }) });
    await post({ update_id: 3, message: message({ message_id: 3, date: DATE + 120, text: "/resumen" }) });
    expect(sentTexts().at(-1)).toContain("🥇 Cindy y Rafa — 4/6");
    expect(sentTexts().at(-1)).not.toContain("matchi matchi: Cindy y Rafa");
  });
});

describe("/mifoto", () => {
  const privado = { id: 42, type: "private" };
  const foto = [
    { file_id: "chica", width: 90, height: 90 },
    { file_id: "grande", width: 640, height: 640 },
  ];
  const elegida = async () => (await env.DB.prepare("SELECT file_id FROM user_photos WHERE user_id = 42").first())?.file_id;

  it("una foto con /mifoto de epígrafe queda elegida", async () => {
    await post({ update_id: 1, message: message({ chat: privado, text: undefined, caption: "/mifoto", photo: foto }) });
    expect(await elegida()).toBe("grande");
    expect(sentTexts()).toEqual(["Listo, esa es tu foto para los mega 💖"]);
  });

  it("guarda la más chica de al menos 640 px: alcanza para la franja y pesa menos", async () => {
    const tamaños = [
      { file_id: "chica", width: 90, height: 120 },
      { file_id: "media", width: 480, height: 640 },
      { file_id: "justa", width: 960, height: 1280 },
      { file_id: "enorme", width: 1920, height: 2560 },
    ];
    await post({ update_id: 1, message: message({ chat: privado, text: undefined, caption: "/mifoto", photo: tamaños }) });
    expect(await elegida()).toBe("justa");
  });

  it("/mifoto y después la foto, dentro de los 10 minutos", async () => {
    await post({ update_id: 1, message: message({ chat: privado, text: "/mifoto" }) });
    await post({ update_id: 2, message: message({ message_id: 2, chat: privado, date: DATE + 60, text: undefined, photo: foto }) });
    expect(await elegida()).toBe("grande");
    expect(sentTexts()).toEqual(["Mandame la foto que querés usar en los mega 💖", "Listo, esa es tu foto para los mega 💖"]);
  });

  it("una foto suelta, sin pedido o pasados los 10 minutos, se ignora", async () => {
    await post({ update_id: 1, message: message({ chat: privado, text: "/mifoto" }) });
    await post({ update_id: 2, message: message({ message_id: 2, chat: privado, date: DATE + 601, text: undefined, photo: foto }) });
    expect(await elegida()).toBeUndefined();
    expect(sentTexts()).toEqual(["Mandame la foto que querés usar en los mega 💖"]);
  });

  it("/mifoto borrar vuelve a la foto de perfil", async () => {
    await post({ update_id: 1, message: message({ chat: privado, text: undefined, caption: "/mifoto", photo: foto }) });
    await post({ update_id: 2, message: message({ message_id: 2, chat: privado, text: "/mifoto borrar" }) });
    expect(await elegida()).toBeUndefined();
    expect(sentTexts().at(-1)).toBe("Listo, vuelvo a usar tu foto de perfil.");
  });

  it("si la manda como archivo, avisa que la mande como foto", async () => {
    await post({ update_id: 1, message: message({ chat: privado, text: "/mifoto" }) });
    const document = { file_id: "archivo", mime_type: "image/jpeg" };
    await post({ update_id: 2, message: message({ message_id: 2, chat: privado, text: undefined, document }) });
    expect(await elegida()).toBeUndefined();
    expect(sentTexts().at(-1)).toBe("Mandala como foto, no como archivo 🙏");
  });

  it("si manda el archivo con /mifoto de epígrafe, la foto que manda después queda elegida", async () => {
    const document = { file_id: "archivo", mime_type: "image/jpeg" };
    await post({ update_id: 1, message: message({ chat: privado, text: undefined, caption: "/mifoto", document }) });
    await post({ update_id: 2, message: message({ message_id: 2, chat: privado, date: DATE + 60, text: undefined, photo: foto }) });
    expect(await elegida()).toBe("grande");
    expect(sentTexts()).toEqual(["Mandala como foto, no como archivo 🙏", "Listo, esa es tu foto para los mega 💖"]);
  });

  it("en el grupo explica que es por privado", async () => {
    await post({ update_id: 1, message: message({ text: "/mifoto" }) });
    expect(sentTexts()).toEqual(["La foto se cambia por privado: escribime a mí 😉"]);
  });

  it("rechaza a quien no es del grupo", async () => {
    memberStatus = "left";
    await post({ update_id: 1, message: message({ chat: privado, text: undefined, caption: "/mifoto", photo: foto }) });
    expect(await elegida()).toBeUndefined();
    expect(sentTexts()).toEqual(["Este bot es solo para los miembros del grupo."]);
  });
});
