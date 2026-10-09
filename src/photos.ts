import type { Env } from "./env";
import { chosenPhoto } from "./photoStore";
import { downloadFile, profilePhotoId } from "./telegram";

function toBase64(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < view.length; i += 0x8000) binary += String.fromCharCode(...view.subarray(i, i + 0x8000));
  return btoa(binary);
}

// La foto de alguien para el MEGA: la elegida con /mifoto o la de perfil. null = va con su inicial.
export async function personPhoto(env: Env, userId: number): Promise<string | null> {
  try {
    const fileId = (await chosenPhoto(env.DB, userId)) ?? (await profilePhotoId(env.BOT_TOKEN, userId));
    if (!fileId) return null;
    const bytes = await downloadFile(env.BOT_TOKEN, fileId);
    return bytes ? `data:image/jpeg;base64,${toBase64(bytes)}` : null;
  } catch (error) {
    console.error(`foto de ${userId}`, error);
    return null;
  }
}
