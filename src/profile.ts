import { previousDay, shortDay } from "./date";
import { GAMES } from "./games";
import { goldCounts, longestRun, podium, streakEndingAt, validResults } from "./stats";
import type { StoredResult } from "./store";
import { joinNames } from "./summary";

export interface Player {
  userId: number;
  name: string;
}

function normalizeName(name: string): string {
  return name.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

// Cada persona con su nombre más reciente, en orden de aparición.
function allPlayers(rows: StoredResult[]): Player[] {
  const latest = new Map<number, { name: string; at: number }>();
  for (const row of rows) {
    const current = latest.get(row.userId);
    if (!current || row.createdAt >= current.at) latest.set(row.userId, { name: row.userName, at: row.createdAt });
  }
  return [...latest].map(([userId, { name }]) => ({ userId, name }));
}

// El nombre exacto gana; si no hay, se busca por el comienzo. Sin importar mayúsculas ni tildes.
export function findPlayers(rows: StoredResult[], query: string): { exact: boolean; matches: Player[] } {
  const wanted = normalizeName(query);
  const players = allPlayers(rows);
  const exact = players.filter((player) => normalizeName(player.name) === wanted);
  if (exact.length > 0) return { exact: true, matches: exact };
  return { exact: false, matches: players.filter((player) => normalizeName(player.name).startsWith(wanted)) };
}

export function playerById(rows: StoredResult[], userId: number, fallbackName: string): Player {
  return allPlayers(rows).find((player) => player.userId === userId) ?? { userId, name: fallbackName };
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export function buildProfile(rows: StoredResult[], player: Player, day: string, self: boolean): string {
  const valid = validResults(rows);
  const mine = valid.filter((row) => row.userId === player.userId);
  const lines = [`👤 ${player.name} — detalle`, ""];

  if (mine.length === 0) {
    lines.push(self ? "Todavía no tenés partidas." : "Todavía no tiene partidas.");
  } else {
    const perGame = GAMES.map((game) => ({ game, rows: mine.filter((row) => row.game === game.id) }))
      .filter((entry) => entry.rows.length > 0)
      .sort((a, b) => b.rows.length - a.rows.length)
      .map((entry) => ({ ...entry, golds: goldCounts(valid, entry.game.id, entry.game.direction).get(player.userId) ?? 0 }));

    const totalGolds = perGame.reduce((sum, entry) => sum + entry.golds, 0);
    const days = [...new Set(mine.map((row) => row.day))].sort();
    const mostMatches = perGame[0].rows.length;
    const mostPlayed = perGame.filter((entry) => entry.rows.length === mostMatches).map((entry) => entry.game.name);

    const golds = totalGolds > 0 ? ` · 🥇 ${plural(totalGolds, "oro", "oros")}` : "";
    lines.push(`🎮 ${plural(mine.length, "partida", "partidas")} en ${plural(perGame.length, "juego", "juegos")}${golds}`);
    lines.push(`📅 ${self ? "Jugaste" : "Jugó"} ${plural(days.length, "día", "días")} (desde el ${shortDay(days[0])})`);
    lines.push(`⭐ Más jugado: ${joinNames(mostPlayed)} (${plural(mostMatches, "partida", "partidas")})`);
    lines.push("", "Por juego");

    for (const { game, rows: gameRows, golds: gameGolds } of perGame) {
      const parts = [`${game.emoji} ${game.name} — ${plural(gameRows.length, "partida", "partidas")}`];
      if (gameGolds > 0) parts.push(`🥇 ${gameGolds}`);
      const [best] = podium(gameRows, game.direction, 1);
      if (best) parts.push(`mejor ${best.display}`);
      // La racha sigue viva si jugó ayer y todavía no hoy, igual que en el detalle del juego.
      const played = new Set(gameRows.map((row) => row.day));
      const record = longestRun(played).days;
      if (record >= 2) {
        const current = Math.max(streakEndingAt(played, day), streakEndingAt(played, previousDay(day)));
        parts.push(`racha ${current} (récord ${record})`);
      }
      lines.push(parts.join(" · "));
    }
  }

  const today = mine.filter((row) => row.day === day);
  const played = GAMES.filter((game) => today.some((row) => row.game === game.id));
  const missing = GAMES.filter((game) => !played.includes(game));
  lines.push("", "📌 Hoy");
  if (missing.length === 0) {
    lines.push(self ? "🎉 ¡Ya jugaste todos!" : "🎉 ¡Ya jugó todos!");
  } else {
    const done = played.map((game) => `${game.emoji} ${game.name} ${today.find((row) => row.game === game.id)!.display}`);
    lines.push(`✅ ${self ? "Ya jugaste" : "Ya jugó"}: ${done.length > 0 ? done.join(" · ") : "ninguno todavía"}`);
    const pending = missing.map((game) => `${game.emoji} ${game.name}`).join(", ");
    lines.push(`⏳ ${self ? "Te faltan" : "Le faltan"} (${missing.length}): ${pending}`);
  }

  return lines.join("\n");
}
