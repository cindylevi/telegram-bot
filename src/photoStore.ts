// La foto que cada persona eligió con /mifoto: se guarda el file_id de Telegram, no la imagen.
export async function chosenPhoto(db: D1Database, userId: number): Promise<string | null> {
  const row = await db.prepare("SELECT file_id FROM user_photos WHERE user_id = ?").bind(userId).first<{ file_id: string }>();
  return row?.file_id ?? null;
}

export async function choosePhoto(db: D1Database, userId: number, fileId: string, now: number): Promise<void> {
  await db
    .prepare(
      `INSERT INTO user_photos (user_id, file_id, updated_at) VALUES (?, ?, ?)
       ON CONFLICT (user_id) DO UPDATE SET file_id = excluded.file_id, updated_at = excluded.updated_at`,
    )
    .bind(userId, fileId, now)
    .run();
}

export async function forgetPhoto(db: D1Database, userId: number): Promise<void> {
  await db.batch([
    db.prepare("DELETE FROM user_photos WHERE user_id = ?").bind(userId),
    db.prepare("DELETE FROM photo_requests WHERE user_id = ?").bind(userId),
  ]);
}

// "/mifoto" sin foto: la próxima foto que mande por privado es la elegida.
export async function requestPhoto(db: D1Database, userId: number, now: number): Promise<void> {
  await db
    .prepare(
      `INSERT INTO photo_requests (user_id, requested_at) VALUES (?, ?)
       ON CONFLICT (user_id) DO UPDATE SET requested_at = excluded.requested_at`,
    )
    .bind(userId, now)
    .run();
}

// Consume el pedido si lo hizo desde `since`.
export async function takePhotoRequest(db: D1Database, userId: number, since: number): Promise<boolean> {
  const { meta } = await db
    .prepare("DELETE FROM photo_requests WHERE user_id = ? AND requested_at >= ?")
    .bind(userId, since)
    .run();
  if (meta.changes > 0) return true;
  await db.prepare("DELETE FROM photo_requests WHERE user_id = ?").bind(userId).run();
  return false;
}
