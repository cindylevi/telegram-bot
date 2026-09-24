export interface StoredResult {
  userId: number;
  userName: string;
  game: string;
  puzzle: string;
  score: number | null;
  display: string;
  day: string;
  createdAt: number;
}

export interface NewResult extends StoredResult {
  chatId: number;
  messageId: number;
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
}

export async function saveResult(db: D1Database, result: NewResult): Promise<void> {
  await db
    .prepare(
      `INSERT OR IGNORE INTO results
         (chat_id, user_id, user_name, game, puzzle, score, display, day, message_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    )
    .run();
}

export async function loadResults(db: D1Database, chatId: number): Promise<StoredResult[]> {
  const { results } = await db
    .prepare(
      `SELECT user_id, user_name, game, puzzle, score, display, day, created_at
       FROM results WHERE chat_id = ? ORDER BY created_at, id`,
    )
    .bind(chatId)
    .all<Row>();
  return results.map((row) => ({
    userId: row.user_id,
    userName: row.user_name,
    game: row.game,
    puzzle: row.puzzle,
    score: row.score,
    display: row.display,
    day: row.day,
    createdAt: row.created_at,
  }));
}
