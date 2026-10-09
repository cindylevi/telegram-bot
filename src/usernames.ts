// El @usuario de Telegram de cada quien, para encontrar a los que nombran en un ft. Se guarda en minúsculas.
export async function rememberUsername(db: D1Database, userId: number, username: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO usernames (user_id, username) VALUES (?, ?)
       ON CONFLICT (user_id) DO UPDATE SET username = excluded.username`,
    )
    .bind(userId, username.toLowerCase())
    .run();
}

export async function loadUsernames(db: D1Database): Promise<Map<string, number>> {
  const { results } = await db.prepare("SELECT user_id, username FROM usernames").all<{ user_id: number; username: string }>();
  return new Map(results.map((row) => [row.username, row.user_id]));
}
