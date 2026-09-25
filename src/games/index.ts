import { boludle } from "./boludle";
import { catfishing } from "./catfishing";
import { fourByThree } from "./fourByThree";
import { foxiMax } from "./foxiMax";
import { krillion } from "./krillion";
import { magnitudleDaily } from "./magnitudleDaily";
import { metazooa } from "./metazooa";
import { minuteCryptic } from "./minuteCryptic";
import { pedantle } from "./pedantle";
import { poople } from "./poople";
import { sizeItUp } from "./sizeItUp";
import { trivia } from "./trivia";
import type { Game, ParsedResult } from "./types";

export const GAMES: Game[] = [
  fourByThree, magnitudleDaily, sizeItUp, krillion, foxiMax, trivia,
  poople, metazooa, boludle, pedantle, catfishing, minuteCryptic,
];

export interface Match {
  game: Game;
  result: ParsedResult;
}

// Telegram no acepta guiones en los comandos: "minute-cryptic" → "minutecryptic".
export function commandName(game: Game): string {
  return game.id.replace(/-/g, "");
}

export function gameByCommand(name: string): Game | undefined {
  return GAMES.find((game) => commandName(game) === name.toLowerCase());
}

export function listGames(): string {
  const lines = GAMES.map((game) => `${game.emoji} ${game.name} — ${game.url} · /${commandName(game)}detalle`);
  return [`🎮 Juegos que reconozco (${GAMES.length})`, "", ...lines].join("\n");
}

// Un mensaje puede traer varios resultados pegados juntos: se devuelve uno por juego.
export function parseResults(text: string): Match[] {
  return GAMES.flatMap((game) => {
    const result = game.parse(text);
    return result ? [{ game, result }] : [];
  });
}
