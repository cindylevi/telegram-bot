import { dayInArgentina } from "./date";
import type { Env } from "./env";
import { parseResult } from "./games";
import { loadResults, saveResult } from "./store";
import { buildSummary } from "./summary";
import { sendMessage, type TelegramUpdate } from "./telegram";

const SUMMARY_COMMAND = /^\/resumen(@\w+)?(\s|$)/i;

async function postSummary(env: Env, day: string): Promise<boolean> {
  const chatId = Number(env.GROUP_CHAT_ID);
  const summary = buildSummary(await loadResults(env.DB, chatId), day);
  if (summary === null) return false;
  await sendMessage(env.BOT_TOKEN, chatId, summary);
  return true;
}

async function handleUpdate(update: TelegramUpdate, env: Env): Promise<void> {
  const message = update.message;
  if (!message?.text || !message.from || message.from.is_bot) return;
  if (String(message.chat.id) !== env.GROUP_CHAT_ID) return;

  const day = dayInArgentina(message.date);

  if (SUMMARY_COMMAND.test(message.text)) {
    const sent = await postSummary(env, day);
    if (!sent) await sendMessage(env.BOT_TOKEN, message.chat.id, "Hoy todavía no jugó nadie.");
    return;
  }

  const match = parseResult(message.text);
  if (!match) return;

  await saveResult(env.DB, {
    chatId: message.chat.id,
    messageId: message.message_id,
    userId: message.from.id,
    userName: message.from.first_name || message.from.username || String(message.from.id),
    game: match.game.id,
    puzzle: match.result.puzzle ?? day,
    score: match.result.score,
    display: match.result.display,
    day,
    createdAt: message.date,
  });
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

  async scheduled(controller, env) {
    const day = dayInArgentina(Math.floor(controller.scheduledTime / 1000));
    await postSummary(env, day);
  },
} satisfies ExportedHandler<Env>;
