import { boludle } from "./boludle";
import { catfishing } from "./catfishing";
import { fourByThree } from "./fourByThree";
import { foxiMax } from "./foxiMax";
import { krillion } from "./krillion";
import { magnitudleDaily } from "./magnitudleDaily";
import { metazooa } from "./metazooa";
import { pedantle } from "./pedantle";
import { poople } from "./poople";
import { sizeItUp } from "./sizeItUp";
import { trivia } from "./trivia";
import type { Game, ParsedResult } from "./types";

export const GAMES: Game[] = [
  fourByThree, magnitudleDaily, sizeItUp, krillion, foxiMax, trivia,
  poople, metazooa, boludle, pedantle, catfishing,
];

export interface Match {
  game: Game;
  result: ParsedResult;
}

// Un mensaje puede traer varios resultados pegados juntos: se devuelve uno por juego.
export function parseResults(text: string): Match[] {
  return GAMES.flatMap((game) => {
    const result = game.parse(text);
    return result ? [{ game, result }] : [];
  });
}
