export type Direction = "higher" | "lower";

export interface ParsedResult {
  puzzle: string | null;
  score: number | null;
  display: string;
  // Desempate entre puntajes iguales: gana el menor (por ejemplo, segundos). null = sin dato.
  tiebreak?: number | null;
  // Detalle del resultado: la grilla de emojis o, si el parser lo da, las rondas (Size It Up, MapTap).
  // "" si no trae. Si el parser no lo da, lo completa parseResults con la grilla.
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
  // false = nunca hay MEGA matchi matchi (en la Trivia coincidir en la grilla es fácil).
  mega?: false;
  // false = solo cuenta el MEGA (en Boludle y Minute Cryptic coincidir el puntaje es trivial).
  common?: false;
  // Hora argentina en la que cambia el puzzle, si no es a la medianoche: desde esa hora lo que se manda
  // cuenta para el día siguiente (Pedantle cambia a las 16).
  dayStartsAt?: number;
  parse(text: string): ParsedResult | null;
}
