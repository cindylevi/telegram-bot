import { dayInArgentina } from "./date";
import type { Env } from "./env";
import { listGames, parseResults } from "./games";
import { loadResults, saveResult } from "./store";
import { buildSummary } from "./summary";
import { sendMessage, type TelegramUpdate } from "./telegram";

const SUMMARY_COMMAND = /^\/resumen(@\w+)?(\s|$)/i;
const LIST_COMMAND = /^\/listdles(@\w+)?(\s|$)/i;

async function postSummary(env: Env, day: string): Promise<boolean> {
  const chatId = Number(env.GROUP_CHAT_ID);
  const summary = buildSummary(await loadResults(env.DB, chatId), day);
  if (summary === null) return false;
  await sendMessage(env.BOT_TOKEN, chatId, summary);
  return true;
}

async function handleUpdate(update: TelegramUpdate, env: Env): Promise<void> {
  const message = update.message;
  if (!message) return;

  // Telegram cambia el id cuando el grupo pasa a supergrupo; sin esto el bot queda mudo sin avisar.
  if (message.migrate_to_chat_id) {
    console.warn(
      `el grupo se migró a ${message.migrate_to_chat_id}: actualizar GROUP_CHAT_ID y correr ` +
        `UPDATE results SET chat_id = ${message.migrate_to_chat_id} WHERE chat_id = ${message.chat.id}`,
    );
    return;
  }
  if (String(message.chat.id) !== env.GROUP_CHAT_ID) {
    const origin = message.migrate_from_chat_id ? ` (migrado desde ${message.migrate_from_chat_id})` : "";
    console.warn(`mensaje de un chat desconocido: ${message.chat.id}${origin}`);
    return;
  }
  if (!message.text || !message.from || message.from.is_bot) return;

  const day = dayInArgentina(message.date);

  if (SUMMARY_COMMAND.test(message.text)) {
    const sent = await postSummary(env, day);
    if (!sent) await sendMessage(env.BOT_TOKEN, message.chat.id, "Hoy todavía no jugó nadie.");
    return;
  }

  if (LIST_COMMAND.test(message.text)) {
    await sendMessage(env.BOT_TOKEN, message.chat.id, listGames());
    return;
  }

  const from = message.from;
  for (const match of parseResults(message.text)) {
    await saveResult(env.DB, {
      chatId: message.chat.id,
      messageId: message.message_id,
      userId: from.id,
      userName: from.first_name || from.username || String(from.id),
      game: match.game.id,
      puzzle: match.result.puzzle ?? day,
      score: match.result.score,
      display: match.result.display,
      day,
      createdAt: message.date,
    });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/webhook") {
      return new Response("not found", { status: 404 });
    }
    if (request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.WEBHOOK_SECRET) {
      return new Response("unauthorized", { status: 401 });
    }
    try {
      await handleUpdate(await request.json<TelegramUpdate>(), env);
    } catch (error) {
      console.error("webhook error", error);
    }
    return new Response("ok");
  },

  // Corre a las 23:58 de Argentina y resume el día en curso.
  async scheduled(controller, env) {
    const day = dayInArgentina(Math.floor(controller.scheduledTime / 1000));
    await postSummary(env, day);
  },
} satisfies ExportedHandler<Env>;
