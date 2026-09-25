import { shortDay } from "./date";
import type { Game } from "./games/types";
import { average, bestEver, currentStreaks, longestStreakEver, podium, validResults } from "./stats";
import type { StoredResult } from "./store";
import { joinNames, people } from "./summary";

const MEDALS = ["🥇", "🥈", "🥉"];

export function buildDetail(rows: StoredResult[], game: Game, day: string): string {
  const valid = validResults(rows);
  const today = valid.filter((row) => row.game === game.id && row.day === day);
  const lines = [`${game.emoji} ${game.name} — detalle del ${shortDay(day)}`, ""];

  if (today.length === 0) {
    lines.push("Hoy todavía no jugó nadie.");
  } else {
    const mean = average(today);
    lines.push(`Hoy · ${people(today.length)}${mean === null ? "" : ` · promedio ${mean}`}`);
    podium(today, game.direction, Infinity).forEach((place, i) => {
      const position = i < MEDALS.length ? MEDALS[i] : `${i + 1}.`;
      lines.push(`   ${position} ${joinNames(place.names)} — ${place.display}`);
    });
    for (const row of today) {
      if (row.score === null) lines.push(`   ✖️ ${row.userName} — ${row.display}`);
    }
  }

  const best = bestEver(valid, game.id, game.direction);
  const record = longestStreakEver(valid, game.id);
  if (best || record) lines.push("");
  if (best) {
    const when = best.day ? ` (${shortDay(best.day)})` : "";
    lines.push(`🏆 Mejor puntaje histórico: ${joinNames(best.names)} — ${best.display}${when}`);
  }
  if (record) {
    const range = record.from && record.to ? ` (del ${shortDay(record.from)} al ${shortDay(record.to)})` : "";
    lines.push(`🔥 Racha histórica: ${joinNames(record.names)}, ${record.days} días${range}`);
  }

  const streaks = currentStreaks(valid, game.id, day);
  if (streaks.length > 0) {
    lines.push("", "📈 Rachas actuales");
    for (const streak of streaks) {
      lines.push(`   ${streak.name} — ${streak.days} días${streak.pendingToday ? " (le falta jugar hoy)" : ""}`);
    }
  }

  return lines.join("\n");
}
