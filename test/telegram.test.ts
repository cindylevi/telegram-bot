import { afterEach, describe, expect, it, vi } from "vitest";
import { chunkText, sendMessage } from "../src/telegram";

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
