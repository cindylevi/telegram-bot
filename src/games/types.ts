export type Direction = "higher" | "lower";

export interface ParsedResult {
  puzzle: string | null;
  score: number | null;
  display: string;
  // Desempate entre puntajes iguales: gana el menor (por ejemplo, segundos). null = sin dato.
  tiebreak?: number | null;
  // Grilla de emojis del resultado ("" si el juego no trae una). La completa parseResults.
  pattern?: string;
}

export interface Game {
  id: string;
  name: string;
  emoji: string;
  url: string;
  direction: Direction;
  // false = la grilla no se guarda porque solo refleja el puntaje (matchi matchi compara el número).
  grid?: false;
  // Hora argentina en la que cambia el puzzle, si no es a la medianoche: desde esa hora lo que se manda
  // cuenta para el día siguiente (Pedantle cambia a las 16).
  dayStartsAt?: number;
  parse(text: string): ParsedResult | null;
}
