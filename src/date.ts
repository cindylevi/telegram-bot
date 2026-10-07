import type { Game } from "./games/types";

const TIME_ZONE = "America/Argentina/Buenos_Aires";

const formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function dayInArgentina(unixSeconds: number): string {
  const parts = formatter.formatToParts(new Date(unixSeconds * 1000));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

// Día al que pertenece un resultado de ese juego: el día argentino, corrido si el puzzle cambia a otra hora.
export function gameDay(game: Pick<Game, "dayStartsAt">, unixSeconds: number): string {
  const shift = game.dayStartsAt === undefined ? 0 : (24 - game.dayStartsAt) * 3600;
  return dayInArgentina(unixSeconds + shift);
}

export function previousDay(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function shortDay(day: string): string {
  const [, month, dayOfMonth] = day.split("-");
  return `${dayOfMonth}/${month}`;
}

export function isoDate(year: number, month: number, dayOfMonth: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(dayOfMonth).padStart(2, "0")}`;
}

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

// Número de mes (1–12) a partir del nombre en inglés o en español, completo o abreviado ("Oct", "Sept").
export function monthNumber(name: string): number | null {
  const lower = name.toLowerCase();
  if (MONTHS[lower]) return MONTHS[lower];
  if (lower.length < 3) return null;
  const full = Object.keys(MONTHS).find((month) => month.startsWith(lower));
  return full ? MONTHS[full] : null;
}
