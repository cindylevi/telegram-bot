export type Direction = "higher" | "lower";

export interface ParsedResult {
  puzzle: string | null;
  score: number | null;
  display: string;
}

export interface Game {
  id: string;
  name: string;
  emoji: string;
  direction: Direction;
  parse(text: string): ParsedResult | null;
}
