import { dayInArgentina, gameDay } from "./date";
import type { Env } from "./env";
import { announceMega, type MegaPerson } from "./announce";
import { buildDetail } from "./detail";
import { ftForBlock, ftLines, ftOnly, resolvePartners, type Partners } from "./ft";
import { commandName, GAMES, gameByCommand, listGames, parseResults } from "./games";
import type { Game } from "./games/types";
import { choosePhoto, forgetPhoto, requestPhoto, takePhotoRequest } from "./photoStore";
import { buildProfile, findPlayers, playerById, type Player } from "./profile";
import { findTwins, lastMessageResults, loadResults, saveResult, type NewResult, type StoredResult } from "./store";
import { buildSummary, joinNames } from "./summary";
import { isChatMember, sendMessage, type TelegramMessage, type TelegramUpdate, type TelegramUser } from "./telegram";

const SUMMARY_COMMAND = /^\/resumen(@\w+)?(\s|$)/i;
const LIST_COMMAND = /^\/listdles(@\w+)?(\s|$)/i;
const DETAIL_COMMAND = /^\/([a-z0-9]+)detalle(@\w+)?(\s|$)/i;
const HELP_COMMAND = /^\/(help|start)(@\w+)?(\s|$)/i;
const PERSON_COMMAND = /^\/detalle(@\w+)?(?:\s+([\s\S]+))?$/i;
const MY_PHOTO_COMMAND = /^\/mifoto(@\w+)?(?:\s+(\S+))?\s*$/i;
const PHOTO_REQUEST_SECONDS = 600;

const HELP = [
  "🤖 Comandos",
  "",
  "/resumen — el resumen de hoy hasta ahora",
  "/listdles — los juegos que reconozco, con su link",
  "/detalle <nombre> — partidas, oros, récords, matchi matchi y qué le falta jugar hoy a alguien (sin nombre, el tuyo; también respondiendo a un mensaje suyo)",
  "/mifoto — por privado, elegí la foto que uso para vos en los MEGA matchi matchi (/mifoto borrar vuelve a la de perfil)",
  "/help — esta ayuda",
  "",
  "📊 Detalle de cada juego (ranking de hoy, récords y rachas)",
  ...GAMES.map((game) => `/${commandName(game)}detalle — ${game.emoji} ${game.name}`),
  "",
  "Pegá tu resultado en el grupo y lo guardo solo. El resumen sale todos los días a las 23:58.",
  "Si lo jugaron juntos, poné \"ft <nombres>\" abajo del resultado o en el mensaje siguiente y cuenta para todos.",
  "Los comandos también andan por privado.",
].join("\n");

async function postSummary(env: Env, day: string): Promise<boolean> {
  const chatId = Number(env.GROUP_CHAT_ID);
  const summary = buildSummary(await loadResults(env.DB, chatId), day);
  if (summary === null) return false;
  await sendMessage(env.BOT_TOKEN, chatId, summary);
  return true;
}

// Apodos para quienes tienen en Telegram un nombre que no los identifica.
const NICKNAMES: Record<number, string> = {
  5190757894: "Juanma B.",
};

function displayName(user: TelegramUser): string {
  return NICKNAMES[user.id] ?? (user.first_name || user.username || String(user.id));
}

// A quién pide ver /detalle: la persona del mensaje respondido, la del nombre, o quien lo pide.
function personDetail(rows: StoredResult[], message: TelegramMessage, from: TelegramUser, query: string | undefined, day: string): string {
  const show = (userId: number, name: string) => buildProfile(rows, playerById(rows, userId, name), day, userId === from.id, message.date);

  const replied = message.reply_to_message?.from;
  if (replied && !replied.is_bot) return show(replied.id, displayName(replied));
  if (!query) return show(from.id, displayName(from));

  const { exact, matches } = findPlayers(rows, query);
  if (matches.length === 0) return "No encontré a nadie que se llame así.";
  if (matches.length > 1 && exact) {
    return `Hay más de una persona que se llama ${matches[0].name}. Mandá /detalle respondiendo a un mensaje de la que querés.`;
  }
  if (matches.length > 1) {
    return ["Hay más de una persona con ese nombre:", ...matches.map((p) => `• ${p.name} → /detalle ${p.name}`)].join("\n");
  }
  return show(matches[0].userId, matches[0].name);
}

type Defer = (task: Promise<void>) => void;

async function handleUpdate(update: TelegramUpdate, env: Env, defer: Defer): Promise<void> {
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
  const isPrivate = message.chat.type === "private";
  if (!isPrivate && String(message.chat.id) !== env.GROUP_CHAT_ID) {
    const origin = message.migrate_from_chat_id ? ` (migrado desde ${message.migrate_from_chat_id})` : "";
    console.warn(`mensaje de un chat desconocido: ${message.chat.id}${origin}`);
    return;
  }
  if (!message.from || message.from.is_bot) return;
  // Las fotos traen el texto en el epígrafe.
  const text = message.text ?? message.caption ?? "";
  const hasImage = Boolean(message.photo || message.document?.mime_type?.startsWith("image/"));
  if (!text && !hasImage) return;

  const day = dayInArgentina(message.date);
  const groupId = Number(env.GROUP_CHAT_ID);
  // Siempre se responde en el chat desde donde se pidió; los datos son siempre los del grupo.
  const reply = (text: string) => sendMessage(env.BOT_TOKEN, message.chat.id, text);

  // Cualquiera puede escribirle al bot: por privado solo atiende a los miembros del grupo.
  if (isPrivate && !(await isChatMember(env.BOT_TOKEN, groupId, message.from.id))) {
    await reply("Este bot es solo para los miembros del grupo.");
    return;
  }

  const myPhoto = text.match(MY_PHOTO_COMMAND);
  if (myPhoto && !isPrivate) {
    await reply("La foto se cambia por privado: escribime a mí 😉");
    return;
  }
  if (isPrivate && (myPhoto || hasImage)) {
    const answer = await photoCommand(env, message, message.from, myPhoto !== null, myPhoto?.[2]);
    if (answer) await reply(answer);
    return;
  }

  if (SUMMARY_COMMAND.test(text)) {
    const summary = buildSummary(await loadResults(env.DB, groupId), day);
    await reply(summary ?? "Hoy todavía no jugó nadie.");
    return;
  }

  if (HELP_COMMAND.test(text)) {
    await reply(HELP);
    return;
  }

  if (LIST_COMMAND.test(text)) {
    await reply(listGames());
    return;
  }

  const person = text.match(PERSON_COMMAND);
  if (person) {
    const rows = await loadResults(env.DB, groupId);
    await reply(personDetail(rows, message, message.from, person[2]?.trim(), day));
    return;
  }

  const detail = text.match(DETAIL_COMMAND);
  if (detail) {
    const game = gameByCommand(detail[1]);
    if (game) await reply(buildDetail(await loadResults(env.DB, groupId), game, gameDay(game, message.date)));
    return;
  }

  // Los resultados solo cuentan si se mandan en el grupo, a la vista de todos.
  if (isPrivate) {
    if (parseResults(text).length > 0) await reply("Los resultados mandalos en el grupo así cuentan 😉");
    return;
  }

  const matches = parseResults(text);
  const notes =
    matches.length > 0 ? await saveResults(env, message, text, message.from, matches, defer) : await ftAfterResults(env, message, text, message.from);
  if (notes.length > 0) await reply(notes.join("\n"));
}

type Matches = ReturnType<typeof parseResults>;

// Guarda los resultados del mensaje, también para quienes nombra cada ft, y devuelve lo que hay que contestar.
async function saveResults(
  env: Env,
  message: TelegramMessage,
  text: string,
  from: TelegramUser,
  matches: Matches,
  defer: Defer,
): Promise<string[]> {
  const fts = ftLines(text);
  const rows = fts.length > 0 ? await loadResults(env.DB, message.chat.id) : [];
  const partnersByLine = new Map(fts.map((ft) => [ft.line, resolvePartners(rows, ft.names, from.id)]));
  const notes: string[] = [];

  for (const match of matches) {
    const result: NewResult = {
      chatId: message.chat.id,
      messageId: message.message_id,
      userId: from.id,
      userName: displayName(from),
      game: match.game.id,
      puzzle: match.result.puzzle ?? dayInArgentina(message.date),
      score: match.result.score,
      display: match.result.display,
      day: gameDay(match.game, message.date),
      createdAt: message.date,
      tiebreak: match.result.tiebreak ?? null,
      pattern: match.result.pattern ?? "",
    };
    if (!(await saveResult(env.DB, result))) continue;

    const ft = ftForBlock(fts, match.line);
    const partners = ft ? partnersByLine.get(ft.line)!.players : [];
    const shared = await shareResult(env, result, partners);
    if (shared.length > 0) notes.push(sharedNote(shared.map((player) => player.name), match.game));

    const twins = await findTwins(env.DB, result);
    const mega = twins.filter((twin) => twin.mega);
    const us: MegaPerson[] = [{ userId: result.userId, name: result.userName }, ...shared.map((p) => ({ userId: p.userId, name: p.name }))];
    if (mega.length > 0) {
      const people = [...mega.map((twin) => ({ userId: twin.userId, name: twin.userName })), ...us];
      // La foto tarda: se manda después de contestarle a Telegram.
      defer(
        announceMega(env, message.chat.id, match.game, people).catch((error) => console.error("aviso del MEGA", error)),
      );
    } else if (twins.length > 0) {
      const names = joinNames([...twins.map((twin) => twin.userName), ...us.map((person) => person.name)]);
      await sendMessage(env.BOT_TOKEN, message.chat.id, `👯 ¡${names} hicieron matchi matchi en ${match.game.emoji} ${match.game.name}!`);
    }
  }
  return [...notes, ...[...partnersByLine.values()].flatMap(missingNotes)];
}

async function photoCommand(
  env: Env,
  message: TelegramMessage,
  from: TelegramUser,
  isCommand: boolean,
  argument: string | undefined,
): Promise<string | null> {
  if (argument?.toLowerCase() === "borrar") {
    await forgetPhoto(env.DB, from.id);
    return "Listo, vuelvo a usar tu foto de perfil.";
  }
  const largest = message.photo?.at(-1)?.file_id;
  if (largest && (isCommand || (await takePhotoRequest(env.DB, from.id, message.date - PHOTO_REQUEST_SECONDS)))) {
    await choosePhoto(env.DB, from.id, largest, message.date);
    return "Listo, esa es tu foto para los mega 💖";
  }
  if (message.document) {
    // Con /mifoto de epígrafe queda el pedido: la foto que mande después es la elegida.
    if (isCommand) await requestPhoto(env.DB, from.id, message.date);
    return "Mandala como foto, no como archivo 🙏";
  }
  if (isCommand) {
    await requestPhoto(env.DB, from.id, message.date);
    return "Mandame la foto que querés usar en los mega 💖";
  }
  return null;
}

const FT_WINDOW_SECONDS = 600;

// Un mensaje que es solo un ft suma a los nombrados al último resultado de la misma persona, si es reciente.
async function ftAfterResults(env: Env, message: TelegramMessage, text: string, from: TelegramUser): Promise<string[]> {
  const wanted = ftOnly(text);
  if (!wanted) return [];
  const last = await lastMessageResults(env.DB, message.chat.id, from.id, message.date - FT_WINDOW_SECONDS);
  if (last.length === 0) return [];

  const partners = resolvePartners(await loadResults(env.DB, message.chat.id), wanted, from.id);
  const notes: string[] = [];
  for (const stored of last) {
    const game = GAMES.find((candidate) => candidate.id === stored.game);
    if (!game) continue;
    const shared = await shareResult(env, { ...stored, chatId: message.chat.id }, partners.players);
    if (shared.length > 0) notes.push(sharedNote(shared.map((player) => player.name), game));
  }
  return [...notes, ...missingNotes(partners)];
}

// Copia el resultado a cada compañero; si alguien ya tenía el suyo de ese puzzle, vale el suyo.
async function shareResult(env: Env, result: NewResult, partners: Player[]): Promise<Player[]> {
  const shared: Player[] = [];
  for (const partner of partners) {
    if (await saveResult(env.DB, { ...result, userId: partner.userId, userName: partner.name })) shared.push(partner);
  }
  return shared;
}

function sharedNote(names: string[], game: Game): string {
  return `🤝 Anotado también para ${joinNames(names)} en ${game.emoji} ${game.name}`;
}

function missingNotes(partners: Partners): string[] {
  const notes = partners.ambiguous.map(({ name, options }) => {
    const choices = `${options.slice(0, -1).join(", ")} o ${options.at(-1)}`;
    return `"${name}" puede ser ${choices}: no lo anoté.`;
  });
  if (partners.unknown.length > 0) {
    notes.unshift(`No conozco a ${joinNames(partners.unknown)}: que mande un resultado propio primero.`);
  }
  return notes;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/webhook") {
      return new Response("not found", { status: 404 });
    }
    if (request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.WEBHOOK_SECRET) {
      return new Response("unauthorized", { status: 401 });
    }
    try {
      await handleUpdate(await request.json<TelegramUpdate>(), env, (task) => ctx.waitUntil(task));
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
