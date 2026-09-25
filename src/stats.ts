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
