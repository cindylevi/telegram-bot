# Bot de resumen diario de juegos — Diseño

**Fecha:** 2026-09-24

## Objetivo

En un grupo de Telegram cada persona pega el resultado de sus juegos diarios (4x3, Magnitudle, Boludle, etc.). El bot lee esos mensajes, guarda los resultados y al final de cada día publica en el grupo un resumen por juego: cuántas personas jugaron, el promedio y quién sacó el mejor puntaje, más el juego más jugado del día. Además muestra la racha actual más larga de cada juego y un ranking histórico de partidas jugadas.

**Criterios de éxito:**

- Todos los formatos listados en [Juegos soportados](#juegos-soportados) se reconocen con sus ejemplos reales.
- El resumen del día sale todos los días a las 23:58 (hora de Argentina) sin intervención manual.
- Corre gratis y sin depender de una máquina personal.
- Los mensajes que no son resultados se ignoran sin responder nada.

## Decisiones tomadas

- **Chat:** es un grupo (no un canal), así el bot sabe quién mandó cada mensaje.
- **Hosting:** Cloudflare Workers + D1 + Cron Trigger (plan free). Se descartaron GitHub Actions (Telegram retiene updates solo 24 h y el cron se atrasa) y la VM de Oracle (tarjeta, mantenimiento).
- **Lenguaje:** TypeScript.
- **Día:** se define por la hora de envío en `America/Argentina/Buenos_Aires`.
- **Duplicados:** si alguien manda el mismo puzzle dos veces, vale el primero.
- **Puzzles de archivo:** por juego y por día solo cuenta el puzzle más jugado; el resto se ignora en el resumen, en las rachas y en el ranking histórico.
- **Rachas:** se mide la racha **actual** (días seguidos hasta el día del resumen), no la más larga de la historia.
- **Ranking histórico:** total acumulado de partidas desde que arrancó el bot (no hay historial previo: la API de bots no lee mensajes viejos).
- **Repo:** GitHub personal `cindylevi/telegram-bot`, remote vía el alias SSH `github-tesis`.

## Arquitectura

```text
Telegram ──webhook──▶ Worker (POST /webhook) ──▶ parsers ──▶ D1 (results)
                                                                 │
Cron 02:59 UTC ──▶ Worker (scheduled) ──▶ arma resumen ◀─────────┘
                                             │
                                             ▼
                                   Telegram sendMessage
```

**Componentes:**

- `src/index.ts` — entrypoint del Worker: handler `fetch` (webhook) y `scheduled` (cron).
- `src/telegram.ts` — tipos mínimos del Update de Telegram y `sendMessage`.
- `src/games/*.ts` — un parser por juego, todos con la misma interfaz.
- `src/games/index.ts` — registro de todos los parsers y `parseResult(text)`.
- `src/store.ts` — acceso a D1: insertar resultado, leer todos los resultados del grupo.
- `src/summary.ts` — función pura: resultados + día → texto del resumen (incluye rachas y ranking histórico).
- `src/date.ts` — día en hora argentina a partir de un timestamp.
- `migrations/0001_results.sql` — esquema de D1.

**Configuración:**

- Secretos (con `wrangler secret put`, nunca en el repo): `BOT_TOKEN`, `WEBHOOK_SECRET`.
- Variable en `wrangler.toml`: `GROUP_CHAT_ID`.
- En BotFather: `/setprivacy` → Disable, para que el bot vea todos los mensajes del grupo.
- El webhook se registra una vez con `setWebhook` pasando `secret_token=WEBHOOK_SECRET`.

## Flujo de un mensaje

1. Llega `POST /webhook`. Si el header `X-Telegram-Bot-Api-Secret-Token` no coincide con `WEBHOOK_SECRET`, se responde 401.
2. Si el update no es un `message` con texto del chat `GROUP_CHAT_ID`, se responde 200 y listo.
3. Si el texto es `/resumen` (o `/resumen@NombreDelBot`), se arma el resumen del día en curso y se manda al grupo.
4. Si no, se ejecuta `parseResult(text)`. Si ningún parser matchea, se responde 200 sin hacer nada.
5. Si matchea, se inserta en `results` con `INSERT OR IGNORE` y se responde 200.

El webhook responde 200 siempre que el secreto sea válido, incluso si algo falla internamente (el error se loguea), para que Telegram no reintente en loop.

## Parsers

**Interfaz:**

```ts
type Direction = "higher" | "lower";

interface ParsedResult {
  puzzle: string | null; // null → se usa el día de envío
  score: number | null;  // null → no lo resolvió (fail)
  display: string;       // cómo se muestra en el resumen, ej. "4/6", "161"
}

interface Game {
  id: string;            // "boludle"
  name: string;          // "Boludle"
  emoji: string;
  direction: Direction;  // cuál puntaje gana
  parse(text: string): ParsedResult | null;
}
```

Cada parser reconoce su juego por una marca inequívoca del texto (URL, hashtag o encabezado) y extrae puzzle y puntaje con regex. Se prueban en orden; gana el primero que matchea.

**Fails:** si el mensaje muestra que la persona no lo resolvió (ej. `X/6`), `score = null`. Cuenta como jugador, aparece último y no entra en el promedio.

### Juegos soportados

| Juego | Se reconoce por | Puzzle | Puntaje | Gana |
|---|---|---|---|---|
| 4x3 | `4x3.fun` | fecha de la primera línea (`September 24, 2026`) | `161 points` → 161 | más alto |
| Magnitudle Daily | `Magnitudle — Daily Question` | `S20 · Q02` | `Score: 70/100` → 70 | más alto |
| Size It Up | `Size It Up` / `magnitudle.com/size-it-up` | día de envío | `Overall Score 185` → 185 | más alto |
| Krillion | `Krillion #N` | N | número de la línea siguiente → 385 | más alto |
| FoxiMax | `#FoxiMax #N` | N | `6/8` → 6 (`X/8` → fail) | más bajo |
| La Trivia del Día | `latriviadeldia.com` | fecha (`23 de septiembre de 2026`) | `5/7` → 5 | más alto |
| Poople | `Poople #N` | N | `6/5` → 6 | más bajo |
| Metazooa | `#metazooa` / `metazooa.com` | `Animal #N` | `in 6 guesses` → 6 | más bajo |
| Boludle | `boludle.com #N` | N | `4/6` → 4 (`X/6` → fail) | más bajo |
| Pedantle | `#pedantle #N` | N | `in 89 guesses` → 89 | más bajo |
| Catfishing | `catfishing.net` | `#N` | `4.5/10` → 4.5 | más alto |

Los ejemplos reales de cada juego se guardan como fixtures en `test/fixtures/` y son la base de los tests. Los formatos de fail que no conocemos todavía (Metazooa, Pedantle, etc.) se agregan cuando aparezcan: hasta entonces ese mensaje simplemente no matchea.

## Datos

```sql
CREATE TABLE results (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id     INTEGER NOT NULL,
  user_id     INTEGER NOT NULL,
  user_name   TEXT    NOT NULL,  -- first_name (o username si no hay)
  game        TEXT    NOT NULL,  -- Game.id
  puzzle      TEXT    NOT NULL,  -- ParsedResult.puzzle o el día de envío
  score       REAL,              -- NULL = fail
  display     TEXT    NOT NULL,
  day         TEXT    NOT NULL,  -- YYYY-MM-DD, hora argentina
  message_id  INTEGER NOT NULL,
  created_at  INTEGER NOT NULL,  -- unix timestamp del mensaje
  UNIQUE (chat_id, user_id, game, puzzle)
);

CREATE INDEX results_chat_day ON results (chat_id, day);
```

El `UNIQUE` + `INSERT OR IGNORE` implementa "vale el primero".

## Resumen

**Disparo:** cron `58 2 * * *` (UTC) = 23:58 en Argentina (UTC-3, sin horario de verano). Resume el día en curso; lo que llegue entre las 23:58 y las 23:59:59 no sale en el resumen, pero cuenta para rachas y ranking. También se dispara a mano con `/resumen`.

**Resultados válidos** (base de todo lo que sigue): para cada par (juego, día) se queda solo el puzzle con más resultados; si empatan, el de mayor número o fecha más reciente. El resto (puzzles de archivo) se descarta.

**Cálculo del día** (función pura sobre los resultados válidos del día del resumen):

1. Agrupar por juego.
2. Ordenar jugadores por puntaje según `direction`; los fails van al final.
3. Promedio sobre los puntajes que no son fail, redondeado a 1 decimal (entero si da exacto).
4. Si hay más de 6 jugadores se muestra podio (🥇🥈🥉); si no, solo 🥇. Los empates comparten lugar y se listan juntos en la misma línea.
5. Juego más jugado: el de más jugadores; si empatan, se listan todos.
6. Los juegos sin jugadores no aparecen. Si ese día no jugó nadie, no se manda nada (tampoco rachas ni ranking).

**Racha por juego** (sobre todos los resultados válidos):

- La racha actual de una persona en un juego es la cantidad de días consecutivos, terminando en el día del resumen, en los que tiene un resultado válido de ese juego. Un fail cuenta como día jugado.
- Por cada juego que aparece en el resumen se muestra la racha más larga entre quienes lo jugaron ese día. Empates se listan juntos.
- Solo se muestra si es de 2 días o más (una racha de 1 es simplemente haber jugado hoy).
- Con `/resumen` a mitad del día, quien todavía no jugó hoy no tiene racha activa: el número refleja "hasta ahora".

**Ranking histórico** (sobre todos los resultados válidos, incluido el día del resumen):

- Total de partidas por persona (cada resultado válido cuenta 1, fails incluidos).
- Top 3, con empates compartiendo lugar. Se muestra al final del resumen.
- El nombre que se muestra es el `user_name` más reciente de esa persona.

**Volumen:** `store.ts` trae todos los resultados del grupo y el cálculo se hace en memoria. Para un grupo (~10 personas × ~11 juegos × 365 días ≈ 40k filas por año) entra holgado en el plan free de D1; si algún día pesa, se pasa a SQL.

**Formato:**

```text
📊 Resumen del 24/09

🎮 Más jugado: 4x3 (7 personas)

🟦 4x3 — 7 personas · promedio 132
   🥇 Cindy — 161
   🥈 Juan — 150
   🥉 Ana — 140
   🔥 Racha: Juan, 12 días

🐸 Boludle — 3 personas · promedio 4.5
   🥇 Juan — 4/6

🏆 Ranking histórico
   🥇 Cindy — 143 partidas
   🥈 Juan — 120
   🥉 Ana — 98
```

Los juegos se ordenan por cantidad de jugadores (de más a menos).

## Comandos

- `/help`: la lista de comandos.
- `/resumen`: el resumen del día hasta ese momento.
- `/listdles`: los juegos reconocidos, con su link y su comando de detalle.
- `/<juego>detalle` (ej. `/foximaxdetalle`, `/minutecrypticdetalle`; el id sin guiones): todos los que jugaron hoy ordenados (medalla a los 3 primeros, del 4.º en adelante numerados, fails al final con ✖️), el mejor puntaje histórico (con fecha si es de una sola persona), la racha histórica más larga (con rango si es de una sola persona) y las rachas actuales de 2 días o más. A diferencia del resumen, una racha de quien jugó ayer y todavía no hoy se muestra como viva, marcada "(le falta jugar hoy)".

## Errores y observabilidad

- Un error en el webhook se loguea con `console.error` y se responde 200.
- Si falla el `sendMessage` del cron, se loguea; no hay reintento; hasta las 23:59 se puede pedir con `/resumen`.
- Los logs se miran con `wrangler tail`.
- **Migración a supergrupo:** Telegram le cambia el id al grupo (por ejemplo al hacer visible el historial para nuevos miembros). El bot loguea un `console.warn` con el id nuevo y el SQL a correr: `UPDATE results SET chat_id = <nuevo> WHERE chat_id = <viejo>`. Después hay que actualizar `GROUP_CHAT_ID` y redeployar. Para evitarlo, conviene que el grupo ya sea supergrupo (id `-100…`) antes de configurar el bot.
- **Varios resultados en un mensaje:** se guarda uno por juego; cada parser lee solo su propio bloque.

## Tests

- **Vitest** con `@cloudflare/vitest-pool-workers` (corre sobre Miniflare, con D1 local).
- **Parsers:** cada fixture real parsea al puzzle y puntaje esperados; un texto cualquiera no matchea con ningún parser; ningún fixture matchea con dos parsers.
- **Resumen:** casos de un jugador, más de 6 (podio), empates, fails, puzzles de archivo descartados, día vacío.
- **Rachas:** racha que se corta por un día sin jugar, racha que no cuenta un puzzle de archivo, racha de 1 que no se muestra, empate de rachas.
- **Ranking histórico:** conteo sobre varios días, empates, cambio de nombre de una persona.
- **Integración:** un update simulado por `/webhook` termina en una fila de D1; el duplicado se ignora; un secreto inválido da 401; un chat ajeno se ignora.

## Fuera de alcance

- Rachas históricas (la más larga de siempre) y rankings semanales o mensuales.
- Importar resultados anteriores al arranque del bot.
- Configurar juegos desde el chat.
- Más de un grupo.
