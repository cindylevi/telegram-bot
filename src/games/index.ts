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

export function parseResult(text: string): Match | null {
  for (const game of GAMES) {
    const result = game.parse(text);
    if (result) return { game, result };
  }
  return null;
}
