import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { choosePhoto, chosenPhoto, forgetPhoto, requestPhoto, takePhotoRequest } from "../src/photoStore";

describe("photoStore", () => {
  it("guarda, reemplaza y borra la foto elegida", async () => {
    expect(await chosenPhoto(env.DB, 1)).toBeNull();
    await choosePhoto(env.DB, 1, "foto-a", 100);
    await choosePhoto(env.DB, 1, "foto-b", 200);
    expect(await chosenPhoto(env.DB, 1)).toBe("foto-b");
    await forgetPhoto(env.DB, 1);
    expect(await chosenPhoto(env.DB, 1)).toBeNull();
  });

  it("el pedido de /mifoto vale una vez y solo si es reciente", async () => {
    await requestPhoto(env.DB, 1, 1000);
    expect(await takePhotoRequest(env.DB, 1, 1001)).toBe(false);
    await requestPhoto(env.DB, 1, 1000);
    expect(await takePhotoRequest(env.DB, 1, 900)).toBe(true);
    expect(await takePhotoRequest(env.DB, 1, 900)).toBe(false);
  });
});
