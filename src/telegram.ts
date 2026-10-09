export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
}

export interface TelegramMessage {
  message_id: number;
  date: number;
  chat: { id: number; type?: string };
  from?: TelegramUser;
  text?: string;
  // Telegram manda la misma foto en varios tamaños, de menor a mayor.
  photo?: { file_id: string; width: number; height: number }[];
  caption?: string;
  document?: { file_id: string; mime_type?: string };
  reply_to_message?: TelegramMessage;
  migrate_to_chat_id?: number;
  migrate_from_chat_id?: number;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
}

const MESSAGE_LIMIT = 4096;

export function chunkText(text: string, limit = MESSAGE_LIMIT): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const block of text.split("\n\n")) {
    const candidate = current ? `${current}\n\n${block}` : block;
    if (candidate.length <= limit) {
      current = candidate;
      continue;
    }
    if (current) chunks.push(current);
    current = block;
    while (current.length > limit) {
      chunks.push(current.slice(0, limit));
      current = current.slice(limit);
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export async function sendMessage(token: string, chatId: number, text: string): Promise<void> {
  for (const chunk of chunkText(text)) {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: chunk }),
    });
    if (!response.ok) {
      throw new Error(`sendMessage ${response.status}: ${await response.text()}`);
    }
  }
}

// Si userId está en el grupo (también cuenta un restringido que sigue adentro).
export async function isChatMember(token: string, chatId: number, userId: number): Promise<boolean> {
  const response = await fetch(`https://api.telegram.org/bot${token}/getChatMember`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, user_id: userId }),
  });
  if (!response.ok) return false;
  const data = await response.json<{ result?: { status: string; is_member?: boolean } }>();
  const status = data.result?.status;
  if (status === "restricted") return data.result?.is_member === true;
  return status === "member" || status === "administrator" || status === "creator";
}

export async function sendPhoto(token: string, chatId: number, png: ArrayBuffer, caption: string): Promise<void> {
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("caption", caption);
  form.append("photo", new Blob([png], { type: "image/png" }), "mega.png");
  const response = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: "POST", body: form });
  if (!response.ok) throw new Error(`sendPhoto ${response.status}: ${await response.text()}`);
}

// La foto de perfil más reciente, en su tamaño más grande. null si no tiene o no es visible para el bot.
export async function profilePhotoId(token: string, userId: number): Promise<string | null> {
  const response = await fetch(`https://api.telegram.org/bot${token}/getUserProfilePhotos`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ user_id: userId, limit: 1 }),
  });
  if (!response.ok) return null;
  const data = await response.json<{ result?: { photos: { file_id: string }[][] } }>();
  return data.result?.photos[0]?.at(-1)?.file_id ?? null;
}

// Baja un archivo de Telegram. Su URL lleva el token del bot: no tiene que salir del Worker.
export async function downloadFile(token: string, fileId: string): Promise<ArrayBuffer | null> {
  const meta = await fetch(`https://api.telegram.org/bot${token}/getFile`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ file_id: fileId }),
  });
  if (!meta.ok) return null;
  const path = (await meta.json<{ result?: { file_path?: string } }>()).result?.file_path;
  if (!path) return null;
  const file = await fetch(`https://api.telegram.org/file/bot${token}/${path}`);
  return file.ok ? file.arrayBuffer() : null;
}
