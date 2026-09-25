export type Direction = "higher" | "lower";

export interface ParsedResult {
  puzzle: string | null;
  score: number | null;
  display: string;
  // Desempate entre puntajes iguales: gana el menor (por ejemplo, segundos). null = sin dato.
  tiebreak?: number | null;
}

export interface Game {
  id: string;
  name: string;
  emoji: string;
  url: string;
  direction: Direction;
  parse(text: string): ParsedResult | null;
}
