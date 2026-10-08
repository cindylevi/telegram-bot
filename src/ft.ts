import { findPlayers, type Player } from "./profile";
import type { StoredResult } from "./store";

// "ft Rafa": el resultado lo hicieron juntos y cuenta también para los nombrados.
const FT_LINE = /^\s*(?:ft|feat)\.?\s+(.+)$/i;
const SEPARATOR = /[\s,;&+]+/;
const FILLER = new Set(["y", "e", "and", "con", "etc"]);

export interface FtLine {
  line: number;
  names: string[];
}

function names(rest: string): string[] {
  return rest
    .split(SEPARATOR)
    .map((word) => word.replace(/^@/, "").replace(/[.!?]+$/, ""))
    .filter((word) => word !== "" && !FILLER.has(word.toLowerCase()));
}

export function ftLines(text: string): FtLine[] {
  return text.split("\n").flatMap((line, index) => {
    const match = line.match(FT_LINE);
    return match ? [{ line: index, names: names(match[1]) }] : [];
  });
}

// El ft de un resultado es el primero que aparece debajo de donde arranca su bloque.
export function ftForBlock(fts: FtLine[], start: number): FtLine | undefined {
  return fts.find((ft) => ft.line > start);
}

// Un mensaje que es solo un ft, para el resultado que la misma persona mandó justo antes.
export function ftOnly(text: string): string[] | null {
  const first = text.trim().split("\n")[0];
  const match = first.match(FT_LINE);
  return match ? names(match[1]) : null;
}

export interface Partners {
  players: Player[];
  unknown: string[];
  ambiguous: { name: string; options: string[] }[];
}

// Busca a cada nombrado como /detalle <nombre>, entre quienes ya mandaron algún resultado.
export function resolvePartners(rows: StoredResult[], wanted: string[], selfId: number): Partners {
  const partners: Partners = { players: [], unknown: [], ambiguous: [] };
  for (const name of wanted) {
    const { matches } = findPlayers(rows, name);
    if (matches.length === 0) partners.unknown.push(name);
    else if (matches.length > 1) partners.ambiguous.push({ name, options: matches.map((player) => player.name) });
    else if (matches[0].userId !== selfId && !partners.players.some((player) => player.userId === matches[0].userId)) {
      partners.players.push(matches[0]);
    }
  }
  return partners;
}
