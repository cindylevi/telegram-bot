import { previousDay } from "./date";
import type { Direction } from "./games/types";
import type { StoredResult } from "./store";

export interface Placement {
  score: number;
  tiebreak: number | null;
  names: string[];
  display: string;
}

export interface Streak {
  names: string[];
  days: number;
}

export interface RankingEntry {
  names: string[];
  games: number;
}

export function comparePuzzles(a: string, b: string): number {
  if (/^\d+$/.test(a) && /^\d+$/.test(b)) return Number(a) - Number(b);
  return a < b ? -1 : a > b ? 1 : 0;
}

export function validResults(rows: StoredResult[]): StoredResult[] {
  const counts = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const key = `${row.game}|${row.day}`;
    const puzzles = counts.get(key) ?? new Map<string, number>();
    puzzles.set(row.puzzle, (puzzles.get(row.puzzle) ?? 0) + 1);
    counts.set(key, puzzles);
  }

  const mainPuzzle = new Map<string, string>();
  for (const [key, puzzles] of counts) {
    let best: [string, number] | undefined;
    for (const entry of puzzles) {
      if (!best || entry[1] > best[1] || (entry[1] === best[1] && comparePuzzles(entry[0], best[0]) > 0)) {
        best = entry;
      }
    }
    mainPuzzle.set(key, best![0]);
  }

  return rows.filter((row) => mainPuzzle.get(`${row.game}|${row.day}`) === row.puzzle);
}

// Menor tiebreak gana; sin tiebreak va después de los que lo tienen.
function compareTiebreaks(a: StoredResult, b: StoredResult): number {
  if (a.tiebreak === b.tiebreak) return 0;
  if (a.tiebreak === null) return 1;
  if (b.tiebreak === null) return -1;
  return a.tiebreak - b.tiebreak;
}

export function podium(rows: StoredResult[], direction: Direction, size: number): Placement[] {
  const solved = rows
    .filter((row): row is StoredResult & { score: number } => row.score !== null)
    .sort((a, b) => (direction === "higher" ? b.score - a.score : a.score - b.score) || compareTiebreaks(a, b));

  const placements: Placement[] = [];
  for (const row of solved) {
    const last = placements.at(-1);
    if (last && last.score === row.score && last.tiebreak === row.tiebreak) {
      last.names.push(row.userName);
      continue;
    }
    if (placements.length === size) break;
    placements.push({ score: row.score, tiebreak: row.tiebreak, names: [row.userName], display: row.display });
  }
  return placements;
}

export function average(rows: StoredResult[]): number | null {
  const scores = rows.flatMap((row) => (row.score === null ? [] : [row.score]));
  if (scores.length === 0) return null;
  const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  return Math.round(mean * 10) / 10;
}

export function longestCurrentStreak(valid: StoredResult[], game: string, day: string): Streak | null {
  const gameRows = valid.filter((row) => row.game === game);
  const played = new Set(gameRows.map((row) => `${row.userId}|${row.day}`));

  let best: Streak | null = null;
  const seen = new Set<number>();
  for (const row of gameRows) {
    if (row.day !== day || seen.has(row.userId)) continue;
    seen.add(row.userId);

    let days = 0;
    for (let current = day; played.has(`${row.userId}|${current}`); current = previousDay(current)) {
      days += 1;
    }

    if (!best || days > best.days) best = { names: [row.userName], days };
    else if (days === best.days) best.names.push(row.userName);
  }

  return best && best.days >= 2 ? best : null;
}

export function historicalRanking(valid: StoredResult[], upToDay: string, size = 3): RankingEntry[] {
  const totals = new Map<number, { name: string; latest: number; games: number }>();
  for (const row of valid) {
    if (row.day > upToDay) continue;
    const entry = totals.get(row.userId) ?? { name: row.userName, latest: row.createdAt, games: 0 };
    entry.games += 1;
    if (row.createdAt >= entry.latest) {
      entry.name = row.userName;
      entry.latest = row.createdAt;
    }
    totals.set(row.userId, entry);
  }

  const sorted = [...totals.values()].sort((a, b) => b.games - a.games);
  const ranking: RankingEntry[] = [];
  for (const entry of sorted) {
    const last = ranking.at(-1);
    if (last && last.games === entry.games) {
      last.names.push(entry.name);
      continue;
    }
    if (ranking.length === size) break;
    ranking.push({ names: [entry.name], games: entry.games });
  }
  return ranking;
}

export interface Best {
  names: string[];
  display: string;
  day: string | null; // solo si lo tiene una sola persona
}

export interface HistoricStreak {
  names: string[];
  days: number;
  from: string | null; // solo si la tiene una sola persona
  to: string | null;
}

export interface CurrentStreak {
  name: string;
  days: number;
  pendingToday: boolean; // jugó hasta ayer y todavía no hoy
}

// Nombre más reciente y días jugados de cada persona en un juego.
function playersOf(valid: StoredResult[], game: string) {
  const players = new Map<number, { name: string; latest: number; days: Set<string> }>();
  for (const row of valid) {
    if (row.game !== game) continue;
    const player = players.get(row.userId) ?? { name: row.userName, latest: row.createdAt, days: new Set<string>() };
    player.days.add(row.day);
    if (row.createdAt >= player.latest) {
      player.name = row.userName;
      player.latest = row.createdAt;
    }
    players.set(row.userId, player);
  }
  return players;
}

export function bestEver(valid: StoredResult[], game: string, direction: Direction): Best | null {
  const gameRows = valid.filter((row) => row.game === game);
  const [top] = podium(gameRows, direction, 1);
  if (!top) return null;

  const winners = gameRows
    .filter((row) => row.score === top.score && row.tiebreak === top.tiebreak)
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  const players = playersOf(valid, game);
  const userIds = [...new Set(winners.map((row) => row.userId))];
  return {
    names: userIds.map((id) => players.get(id)!.name),
    display: top.display,
    day: userIds.length === 1 ? winners[0].day : null,
  };
}

export function longestStreakEver(valid: StoredResult[], game: string): HistoricStreak | null {
  let best: { names: string[]; days: number; from: string; to: string } | null = null;

  for (const player of playersOf(valid, game).values()) {
    const days = [...player.days].sort();
    let run = { days: 0, from: "", to: "" };
    let longest = run;
    for (const day of days) {
      run = run.days > 0 && previousDay(day) === run.to ? { ...run, days: run.days + 1, to: day } : { days: 1, from: day, to: day };
      if (run.days > longest.days) longest = run;
    }

    if (!best || longest.days > best.days) best = { names: [player.name], ...longest };
    else if (longest.days === best.days) best.names.push(player.name);
  }

  if (!best || best.days < 2) return null;
  const single = best.names.length === 1;
  return { names: best.names, days: best.days, from: single ? best.from : null, to: single ? best.to : null };
}

export function currentStreaks(valid: StoredResult[], game: string, day: string): CurrentStreak[] {
  const yesterday = previousDay(day);
  const streaks: CurrentStreak[] = [];

  for (const player of playersOf(valid, game).values()) {
    const start = player.days.has(day) ? day : player.days.has(yesterday) ? yesterday : null;
    if (!start) continue;
    let days = 0;
    for (let current = start; player.days.has(current); current = previousDay(current)) days += 1;
    if (days >= 2) streaks.push({ name: player.name, days, pendingToday: start !== day });
  }

  return streaks.sort((a, b) => b.days - a.days || Number(a.pendingToday) - Number(b.pendingToday));
}

export interface MedalEntry {
  names: string[];
  golds: number;
}

// Primeros puestos de cada día en un juego; un empate en el primero le da oro a todos los empatados.
export function goldMedals(valid: StoredResult[], game: string, direction: Direction): MedalEntry[] {
  const gameRows = valid.filter((row) => row.game === game);
  const golds = new Map<number, number>();
  for (const player of playersOf(valid, game).keys()) golds.set(player, 0);

  for (const day of new Set(gameRows.map((row) => row.day))) {
    const dayRows = gameRows.filter((row) => row.day === day);
    const [top] = podium(dayRows, direction, 1);
    if (!top) continue;
    const winners = new Set(
      dayRows.filter((row) => row.score === top.score && row.tiebreak === top.tiebreak).map((row) => row.userId),
    );
    for (const userId of winners) golds.set(userId, golds.get(userId)! + 1);
  }

  const players = playersOf(valid, game);
  const sorted = [...golds].filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1]);
  const medals: MedalEntry[] = [];
  for (const [userId, count] of sorted) {
    const last = medals.at(-1);
    if (last && last.golds === count) last.names.push(players.get(userId)!.name);
    else medals.push({ names: [players.get(userId)!.name], golds: count });
  }
  return medals;
}
