import { boludle } from "./boludle";
import { catfishing } from "./catfishing";
import { chainle } from "./chainle";
import { cluesBySam } from "./cluesBySam";
import { fourByThree } from "./fourByThree";
import { fermi } from "./fermi";
import { foxiMax } from "./foxiMax";
import { krillion } from "./krillion";
import { magnitudleDaily } from "./magnitudleDaily";
import { maptap } from "./maptap";
import { metazooa } from "./metazooa";
import { minuteCryptic } from "./minuteCryptic";
import { originle } from "./originle";
import { pedantango } from "./pedantango";
import { pedantle } from "./pedantle";
import { perceptle } from "./perceptle";
import { poople } from "./poople";
import { sizeItUp } from "./sizeItUp";
import { smush } from "./smush";
import { trivia } from "./trivia";
import { previousDay } from "../date";
import type { Game, ParsedResult } from "./types";

export const GAMES: Game[] = [
  fourByThree, magnitudleDaily, sizeItUp, krillion, foxiMax, trivia,
  poople, metazooa, boludle, pedantle, catfishing, minuteCryptic, maptap, chainle,
  cluesBySam, originle, pedantango, smush, fermi, perceptle,
];

export interface Match {
  game: Game;
  result: ParsedResult;
  // Renglón del mensaje donde arranca el bloque de este resultado.
  line: number;
}

// Telegram no acepta guiones en los comandos: "minute-cryptic" → "minutecryptic".
export function commandName(game: Game): string {
  return game.id.replace(/-/g, "");
}

export function gameByCommand(name: string): Game | undefined {
  return GAMES.find((game) => commandName(game) === name.toLowerCase());
}

export function hasMega(gameId: string): boolean {
  return GAMES.find((game) => game.id === gameId)?.mega !== false;
}

export function hasCommon(gameId: string): boolean {
  return GAMES.find((game) => game.id === gameId)?.common !== false;
}

export function commonByPattern(gameId: string): boolean {
  return GAMES.find((game) => game.id === gameId)?.commonByPattern === true;
}

export function inStreakPause(gameId: string, day: string): boolean {
  const pauses = GAMES.find((game) => game.id === gameId)?.streakPauses ?? [];
  return pauses.some((pause) => pause.from <= day && day <= pause.to);
}

// El día anterior que cuenta para la racha: se saltean los días en pausa del juego.
export function previousStreakDay(gameId: string, day: string): string {
  let previous = previousDay(day);
  while (inStreakPause(gameId, previous)) previous = previousDay(previous);
  return previous;
}

export function listGames(): string {
  const lines = GAMES.map((game) => `${game.emoji} ${game.name} — ${game.url} · /${commandName(game)}detalle`);
  return [`🎮 Juegos que reconozco (${GAMES.length})`, "", ...lines].join("\n");
}

// Renglón de grilla: solo emojis, a lo sumo con un número pegado al final (FoxiMax pone "🟩🟩⬜⬜🟩7";
// "🟥🟥⬜️⬜️⬜️ 43" de MapTap es un puntaje por ronda, no grilla).
const GRID_LINE = /^[^\p{L}\p{N}]*[^\p{L}\p{N}\s]\p{N}*$/u;

// Renglón donde arranca el resultado de un juego: el último desde el cual el parser todavía lo reconoce.
function blockStart(game: Game, lines: string[]): number {
  for (let i = lines.length - 1; i > 0; i--) {
    if (game.parse(lines.slice(i).join("\n"))) return i;
  }
  return 0;
}

// Según el teclado, el mismo emoji llega como "⬜️" (con U+FE0F) o como "⬜": se sacan para que las grillas
// que se ven iguales sean iguales al compararlas en los matchi matchi.
function withoutVariationSelectors(pattern: string): string {
  return pattern.replace(/[\uFE0E\uFE0F]/gu, "");
}

// Un mensaje puede traer varios resultados pegados juntos: se devuelve uno por juego,
// cada uno con la grilla de emojis de su propio bloque.
export function parseResults(text: string): Match[] {
  const found = GAMES.flatMap((game) => {
    const result = game.parse(text);
    return result ? [{ game, result }] : [];
  });
  if (found.length === 0) return [];

  const lines = text.split("\n");
  const starts = found.map((match) => blockStart(match.game, lines));
  return found.map((match, i) => {
    const end = Math.min(lines.length, ...starts.filter((start) => start > starts[i]));
    const grid = () =>
      lines
        .slice(starts[i], end)
        .map((line) => line.trim())
        .filter((line) => GRID_LINE.test(line))
        .join("\n");
    const pattern = withoutVariationSelectors(match.result.pattern ?? (match.game.grid === false ? "" : grid()));
    return { game: match.game, result: { ...match.result, pattern }, line: starts[i] };
  });
}
