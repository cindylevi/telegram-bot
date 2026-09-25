import { shortDay } from "./date";
import { GAMES } from "./games";
import { average, historicalRanking, longestCurrentStreak, podium, validResults } from "./stats";
import type { StoredResult } from "./store";

const MEDALS = ["🥇", "🥈", "🥉"];
const PODIUM_MIN_PLAYERS = 7;

export function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} y ${names.at(-1)}`;
}

export function people(count: number): string {
  return count === 1 ? "1 persona" : `${count} personas`;
}

function matches(count: number): string {
  return count === 1 ? "1 partida" : `${count} partidas`;
}

export function buildSummary(rows: StoredResult[], day: string): string | null {
  const valid = validResults(rows);
  const today = valid.filter((row) => row.day === day);
  if (today.length === 0) return null;

  const games = GAMES.map((game) => ({ game, rows: today.filter((row) => row.game === game.id) }))
    .filter((entry) => entry.rows.length > 0)
    .sort((a, b) => b.rows.length - a.rows.length);

  const mostPlayers = games[0].rows.length;
  const mostPlayed = games.filter((entry) => entry.rows.length === mostPlayers).map((entry) => entry.game.name);

  const lines = [
    `📊 Resumen del ${shortDay(day)}`,
    "",
    `🎮 Más jugado: ${joinNames(mostPlayed)} (${people(mostPlayers)})`,
  ];

  for (const { game, rows: gameRows } of games) {
    const mean = average(gameRows);
    lines.push("", `${game.emoji} ${game.name} — ${people(gameRows.length)}${mean === null ? "" : ` · promedio ${mean}`}`);

    const size = gameRows.length >= PODIUM_MIN_PLAYERS ? 3 : 1;
    podium(gameRows, game.direction, size).forEach((place, i) => {
      lines.push(`   ${MEDALS[i]} ${joinNames(place.names)} — ${place.display}`);
    });

    const streak = longestCurrentStreak(valid, game.id, day);
    if (streak) lines.push(`   🔥 Racha: ${joinNames(streak.names)}, ${streak.days} días`);
  }

  lines.push("", "🏆 Ranking histórico");
  historicalRanking(valid, day).forEach((entry, i) => {
    lines.push(`   ${MEDALS[i]} ${joinNames(entry.names)} — ${i === 0 ? matches(entry.games) : entry.games}`);
  });

  return lines.join("\n");
}
