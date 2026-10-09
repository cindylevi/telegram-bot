import type { Env } from "./env";
import type { Game } from "./games/types";
import { MAX_FACES, megaHtml } from "./mega";
import { personPhoto } from "./photos";
import { renderPng } from "./render";
import { joinNames } from "./summary";
import { sendMessage, sendPhoto } from "./telegram";

export interface MegaPerson {
  userId: number;
  name: string;
}

export function megaCaption(game: Game, people: MegaPerson[]): string {
  return `💖 ¡MEGA MATCHI MATCHI de ${joinNames(people.map((person) => person.name))} en ${game.emoji} ${game.name}!`;
}

// La foto del MEGA; si algo falla (cuota del navegador, Telegram), el epígrafe sale como texto.
export async function announceMega(env: Env, chatId: number, game: Game, people: MegaPerson[]): Promise<void> {
  const caption = megaCaption(game, people);
  try {
    const faces = await Promise.all(
      people.slice(0, MAX_FACES).map(async (person) => ({ name: person.name, photo: await personPhoto(env, person.userId) })),
    );
    await sendPhoto(env.BOT_TOKEN, chatId, await renderPng(env.BROWSER, megaHtml(faces)), caption);
  } catch (error) {
    console.error("no salió la foto del MEGA", error);
    await sendMessage(env.BOT_TOKEN, chatId, caption);
  }
}
