import type { Env } from "./env";
import type { Game } from "./games/types";
import { joinNames } from "./summary";
import { sendMessage } from "./telegram";

export interface MegaPerson {
  userId: number;
  name: string;
}

export function megaCaption(game: Game, people: MegaPerson[]): string {
  return `💖 ¡MEGA MATCHI MATCHI de ${joinNames(people.map((person) => person.name))} en ${game.emoji} ${game.name}!`;
}

export async function announceMega(env: Env, chatId: number, game: Game, people: MegaPerson[]): Promise<void> {
  await sendMessage(env.BOT_TOKEN, chatId, megaCaption(game, people));
}
