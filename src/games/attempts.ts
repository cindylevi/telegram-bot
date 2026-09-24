import type { ParsedResult } from "./types";

// Formatos "N/M" donde N son los intentos y "X" significa que no lo resolvió.
// pattern captura: (1) número de puzzle, (2) intentos o X, (3) máximo.
export function parseAttempts(text: string, pattern: RegExp): ParsedResult | null {
  const match = text.match(pattern);
  if (!match) return null;
  const attempts = match[2].toUpperCase();
  return {
    puzzle: match[1],
    score: attempts === "X" ? null : Number(attempts),
    display: `${attempts}/${match[3]}`,
  };
}
