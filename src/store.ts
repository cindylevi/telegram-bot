export interface StoredResult {
  userId: number;
  userName: string;
  game: string;
  puzzle: string;
  score: number | null;
  display: string;
  day: string;
  createdAt: number;
  tiebreak: number | null;
  // Grilla de emojis ("" si el juego no trae una). null en los resultados guardados antes de que existiera.
  pattern: string | null;
  // Mensaje del que salió. Las copias de un ft comparten el del original: así se sabe que lo jugaron juntos.
  messageId: number;
}

export interface NewResult extends StoredResult {
  chatId: number;
}

interface Row {
  user_id: number;
  user_name: string;
  game: string;
  puzzle: string;
  score: number | null;
  display: string;
  day: string;
  created_at: number;
  tiebreak: number | null;
  pattern: string | null;
  message_id: number;
}

// Devuelve false si ya estaba (mismo puzzle de la misma persona: vale el primero).
export async function saveResult(db: D1Database, result: NewResult): Promise<boolean> {
  const { meta } = await db
    .prepare(
      `INSERT OR IGNORE INTO results
         (chat_id, user_id, user_name, game, puzzle, score, display, day, message_id, created_at, tiebreak, pattern)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      result.chatId,
      result.userId,
      result.userName,
      result.game,
      result.puzzle,
      result.score,
      result.display,
      result.day,
      result.messageId,
      result.createdAt,
      result.tiebreak,
      result.pattern,
    )
    .run();
  return meta.changes > 0;
}

// Quienes ya mandaron el resultado idéntico en el mismo puzzle y día: mismo puntaje exacto
// y, si el juego trae grilla, también la misma grilla. Los del mismo ft (mismo mensaje) no cuentan.
export async function findTwins(db: D1Database, result: NewResult): Promise<{ userId: number; userName: string }[]> {
  if (result.pattern === null) return [];
  const { results } = await db
    .prepare(
      `SELECT user_id, user_name FROM results
       WHERE chat_id = ? AND game = ? AND puzzle = ? AND day = ? AND user_id <> ? AND message_id <> ?
         AND pattern = ? AND display = ?
       ORDER BY created_at, id`,
    )
    .bind(
      result.chatId,
      result.game,
      result.puzzle,
      result.day,
      result.userId,
      result.messageId,
      result.pattern,
      result.display,
    )
    .all<{ user_id: number; user_name: string }>();
  return results.map((row) => ({ userId: row.user_id, userName: row.user_name }));
}

// Los resultados del último mensaje con resultados de esa persona, si lo mandó desde `since`.
export async function lastMessageResults(
  db: D1Database,
  chatId: number,
  userId: number,
  since: number,
): Promise<StoredResult[]> {
  const { results } = await db
    .prepare(
      `SELECT user_id, user_name, game, puzzle, score, display, day, created_at, tiebreak, pattern, message_id
       FROM results
       WHERE chat_id = ? AND user_id = ? AND created_at >= ? AND message_id = (
         SELECT MAX(message_id) FROM results WHERE chat_id = ? AND user_id = ?
       )
       ORDER BY id`,
    )
    .bind(chatId, userId, since, chatId, userId)
    .all<Row>();
  return results.map(fromRow);
}

export async function loadResults(db: D1Database, chatId: number): Promise<StoredResult[]> {
  const { results } = await db
    .prepare(
      `SELECT user_id, user_name, game, puzzle, score, display, day, created_at, tiebreak, pattern, message_id
       FROM results WHERE chat_id = ? ORDER BY created_at, id`,
    )
    .bind(chatId)
    .all<Row>();
  return results.map(fromRow);
}

function fromRow(row: Row): StoredResult {
  return {
    userId: row.user_id,
    userName: row.user_name,
    game: row.game,
    puzzle: row.puzzle,
    score: row.score,
    display: row.display,
    day: row.day,
    createdAt: row.created_at,
    tiebreak: row.tiebreak,
    pattern: row.pattern,
    messageId: row.message_id,
  };
}
