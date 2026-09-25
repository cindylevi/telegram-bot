import { afterEach, describe, expect, it, vi } from "vitest";
import { chunkText, isChatMember, sendMessage } from "../src/telegram";

afterEach(() => vi.restoreAllMocks());

describe("chunkText", () => {
  it("deja el texto entero si entra", () => {
    expect(chunkText("a\n\nb", 10)).toEqual(["a\n\nb"]);
  });

  it("parte por párrafos sin pasarse del límite", () => {
    expect(chunkText("aaaa\n\nbbbb\n\ncc", 10)).toEqual(["aaaa\n\nbbbb", "cc"]);
  });

  it("corta un párrafo que solo ya no entra", () => {
    expect(chunkText("abcdefghij", 4)).toEqual(["abcd", "efgh", "ij"]);
  });
});

describe("sendMessage", () => {
  it("manda un POST por chunk a la API de Telegram", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response("{}"));
    await sendMessage("tok", -1001, "hola");
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://api.telegram.org/bottok/sendMessage");
    expect(JSON.parse(String(init?.body))).toEqual({ chat_id: -1001, text: "hola" });
  });

  it("tira error si Telegram responde con error", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response("bad", { status: 400 }));
    await expect(sendMessage("tok", -1001, "hola")).rejects.toThrow("sendMessage 400");
  });
});

describe("isChatMember", () => {
  const answer = (body: unknown, status = 200) =>
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify(body), { status }));

  it("acepta miembros, admins y creador", async () => {
    for (const status of ["member", "administrator", "creator"]) {
      answer({ ok: true, result: { status } });
      expect(await isChatMember("tok", -1001, 42)).toBe(true);
      vi.restoreAllMocks();
    }
  });

  it("acepta restringidos que siguen en el grupo y rechaza a los que se fueron", async () => {
    answer({ ok: true, result: { status: "restricted", is_member: true } });
    expect(await isChatMember("tok", -1001, 42)).toBe(true);
    vi.restoreAllMocks();
    answer({ ok: true, result: { status: "left" } });
    expect(await isChatMember("tok", -1001, 42)).toBe(false);
  });

  it("rechaza si Telegram responde con error", async () => {
    answer({ ok: false, description: "user not found" }, 400);
    expect(await isChatMember("tok", -1001, 42)).toBe(false);
  });
});
