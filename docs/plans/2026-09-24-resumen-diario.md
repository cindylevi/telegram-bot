# Bot de resumen diario de juegos — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un bot de Telegram que guarda los resultados de juegos diarios que se pegan en un grupo y publica a las 23:59 (hora de Argentina) un resumen con promedio, podio, racha actual por juego y ranking histórico.

**Architecture:** Un Cloudflare Worker en TypeScript recibe los mensajes del grupo por webhook, los pasa por un parser por juego y guarda los que matchean en D1. Un Cron Trigger (y el comando `/resumen`) lee todos los resultados del grupo, calcula las estadísticas con funciones puras y manda el texto con `sendMessage`.

**Tech Stack:** Cloudflare Workers, D1, Cron Triggers, TypeScript 5, Wrangler 4, Vitest 3.2 + `@cloudflare/vitest-pool-workers` 0.8.

**Spec:** `docs/specs/2026-09-24-resumen-diario-design.md`

## Global Constraints

- **Cuentas personales, nada de Brubank:** todo commit con author y committer `cindylevi@gmail.com` (el `user.email` global de la máquina es el de Brubank; el del repo ya está seteado local). Verificar con `git log -1 --format='%ae | %ce'` después de cada commit.
- **GitHub:** remote `git@github-tesis:cindylevi/telegram-bot.git` (alias SSH `github-tesis`, key `id_ed25519_tesis`). **No usar `gh`**: está logueado con la cuenta de Brubank.
- **Cloudflare y Telegram:** cuentas personales. `npx wrangler whoami` tiene que mostrar la cuenta personal antes de cualquier comando `--remote` o `deploy`.
- **npm:** registry público `https://registry.npmjs.org/`.
- **Secretos** (`BOT_TOKEN`, `WEBHOOK_SECRET`) nunca en el repo: van con `wrangler secret put`; en tests, como bindings de Miniflare.
- **Zona horaria:** `America/Argentina/Buenos_Aires`; cron `59 2 * * *` (UTC).
- **Podio** (🥇🥈🥉) solo con más de 6 jugadores; si no, solo 🥇.
- **Duplicados:** vale el primero (`UNIQUE (chat_id, user_id, game, puzzle)` + `INSERT OR IGNORE`).
- **Textos del bot** en español rioplatense, como en la spec.
- **Commits:** conventional commits en español, terminando con `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Review Focus

1. **Admin anónimo o bot que postea en el grupo** (`from.is_bot = true`, ej. `GroupAnonymousBot`): se ignora, no se mezcla como si fuera una persona. Test en Task 7.
2. **Resultado pegado con comentario antes o después** ("uff hoy me costó" + resultado): se parsea igual. Test en Task 3.
3. **Mensaje editado** (`edited_message`): se ignora, no duplica ni pisa el resultado. Test en Task 7.
4. **Resumen de más de 4096 caracteres** (límite de Telegram): se parte en varios mensajes por párrafo. Test en Task 7.
5. **`/resumen` en un día sin resultados:** responde "Hoy todavía no jugó nadie." en vez de quedarse callado. Test en Task 7.

---

## File Structure

```text
package.json
tsconfig.json
wrangler.toml
vitest.config.ts
migrations/0001_results.sql
src/
  env.ts               # tipo Env (bindings)
  date.ts              # días en hora argentina
  games/
    types.ts           # Game, ParsedResult, Direction
    attempts.ts        # helper para formatos "N/M" con X = fail
    fourByThree.ts  magnitudleDaily.ts  sizeItUp.ts  krillion.ts
    foxiMax.ts  trivia.ts  poople.ts  metazooa.ts  boludle.ts
    pedantle.ts  catfishing.ts
    index.ts           # GAMES + parseResult
  store.ts             # D1: saveResult, loadResults, StoredResult
  stats.ts             # cálculos puros: puzzles válidos, podio, promedio, rachas, ranking
  summary.ts           # buildSummary: resultados + día → texto
  telegram.ts          # tipos de Update, sendMessage, chunkText
  index.ts             # handlers fetch (webhook) y scheduled (cron)
test/
  env.d.ts  apply-migrations.ts  helpers.ts
  fixtures/games.ts
  date.test.ts  games.test.ts  store.test.ts  stats.test.ts
  summary.test.ts  telegram.test.ts  index.test.ts
```

---

### Task 1: Proyecto, toolchain de tests y fechas

**Files:**

- Create: `package.json`, `tsconfig.json`, `wrangler.toml`, `vitest.config.ts`, `migrations/0001_results.sql`
- Create: `src/env.ts`, `src/date.ts`
- Create: `test/env.d.ts`, `test/apply-migrations.ts`
- Test: `test/date.test.ts`

**Interfaces:**

- Produces:
  - `interface Env { DB: D1Database; BOT_TOKEN: string; WEBHOOK_SECRET: string; GROUP_CHAT_ID: string }` en `src/env.ts`
  - `dayInArgentina(unixSeconds: number): string` → `"YYYY-MM-DD"`
  - `previousDay(day: string): string`
  - `shortDay(day: string): string` → `"DD/MM"`
  - `isoDate(year: number, month: number, dayOfMonth: number): string` (month 1–12)
  - Tabla `results` en D1 (esquema abajo); en tests, `env.DB` ya migrada.

- [ ] **Step 1: Crear `package.json`**

```json
{
  "name": "resumen-juegos-bot",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "test": "vitest run",
    "typecheck": "tsc"
  }
}
```

- [ ] **Step 2: Instalar dependencias**

Run:

```bash
npm config get registry   # tiene que ser https://registry.npmjs.org/
npm install -D wrangler@^4 @cloudflare/vitest-pool-workers@^0.8 vitest@~3.2.0 typescript@^5 @cloudflare/workers-types
```

Expected: instala sin errores de peer dependencies. Si npm reporta un conflicto de peer entre `vitest` y `@cloudflare/vitest-pool-workers`, instalar la versión de `vitest` que pide el mensaje de error.

- [ ] **Step 3: Crear `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types", "@cloudflare/vitest-pool-workers"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src", "test", "vitest.config.ts"]
}
```

- [ ] **Step 4: Crear `wrangler.toml`**

El `database_id` y `GROUP_CHAT_ID` definitivos se completan en la Task 8; para los tests alcanza con estos valores.

```toml
name = "resumen-juegos-bot"
main = "src/index.ts"
compatibility_date = "2025-04-01"
compatibility_flags = ["nodejs_compat"]

[vars]
GROUP_CHAT_ID = "0"

[[d1_databases]]
binding = "DB"
database_name = "resumen-juegos"
database_id = "00000000-0000-0000-0000-000000000000"
migrations_dir = "migrations"

[triggers]
crons = ["59 2 * * *"]
```

- [ ] **Step 5: Crear `migrations/0001_results.sql`**

```sql
CREATE TABLE results (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id     INTEGER NOT NULL,
  user_id     INTEGER NOT NULL,
  user_name   TEXT    NOT NULL,
  game        TEXT    NOT NULL,
  puzzle      TEXT    NOT NULL,
  score       REAL,
  display     TEXT    NOT NULL,
  day         TEXT    NOT NULL,
  message_id  INTEGER NOT NULL,
  created_at  INTEGER NOT NULL,
  UNIQUE (chat_id, user_id, game, puzzle)
);

CREATE INDEX results_chat_day ON results (chat_id, day);
```

- [ ] **Step 6: Crear `src/env.ts`**

```ts
export interface Env {
  DB: D1Database;
  BOT_TOKEN: string;
  WEBHOOK_SECRET: string;
  GROUP_CHAT_ID: string;
}
```

- [ ] **Step 7: Configurar Vitest con D1 migrada**

`vitest.config.ts`:

```ts
import path from "node:path";
import { defineWorkersConfig, readD1Migrations } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig(async () => {
  const migrations = await readD1Migrations(path.resolve("migrations"));
  return {
    test: {
      setupFiles: ["./test/apply-migrations.ts"],
      poolOptions: {
        workers: {
          singleWorker: true,
          wrangler: { configPath: "./wrangler.toml" },
          miniflare: {
            bindings: {
              TEST_MIGRATIONS: migrations,
              BOT_TOKEN: "test-token",
              WEBHOOK_SECRET: "test-secret",
            },
          },
        },
      },
    },
  };
});
```

`test/apply-migrations.ts`:

```ts
import { applyD1Migrations, env } from "cloudflare:test";

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
```

`test/env.d.ts`:

```ts
import type { Env } from "../src/env";

declare module "cloudflare:test" {
  interface ProvidedEnv extends Env {
    TEST_MIGRATIONS: D1Migration[];
  }
}
```

- [ ] **Step 8: Escribir los tests de fechas (fallan)**

`test/date.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { dayInArgentina, isoDate, previousDay, shortDay } from "../src/date";

const utc = (...args: [number, number, number, number, number]) => Date.UTC(...args) / 1000;

describe("dayInArgentina", () => {
  it("el cron de las 02:59 UTC cae en el día anterior (23:59 en Argentina)", () => {
    expect(dayInArgentina(utc(2026, 8, 25, 2, 59))).toBe("2026-09-24");
  });

  it("a las 03:00 UTC ya es el día siguiente en Argentina", () => {
    expect(dayInArgentina(utc(2026, 8, 25, 3, 0))).toBe("2026-09-25");
  });
});

describe("previousDay", () => {
  it("cruza fin de mes y de año", () => {
    expect(previousDay("2026-03-01")).toBe("2026-02-28");
    expect(previousDay("2026-01-01")).toBe("2025-12-31");
  });
});

describe("shortDay", () => {
  it("formatea como DD/MM", () => {
    expect(shortDay("2026-09-24")).toBe("24/09");
  });
});

describe("isoDate", () => {
  it("rellena con ceros", () => {
    expect(isoDate(2026, 9, 3)).toBe("2026-09-03");
  });
});
```

- [ ] **Step 9: Correr los tests y verificar que fallan**

Run: `npx vitest run test/date.test.ts`
Expected: FAIL porque `../src/date` no existe. Si falla por otra cosa (config del pool, migraciones), arreglar la config antes de seguir: esa es la parte que este paso valida.

- [ ] **Step 10: Implementar `src/date.ts`**

```ts
const TIME_ZONE = "America/Argentina/Buenos_Aires";

const formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function dayInArgentina(unixSeconds: number): string {
  const parts = formatter.formatToParts(new Date(unixSeconds * 1000));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function previousDay(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function shortDay(day: string): string {
  const [, month, dayOfMonth] = day.split("-");
  return `${dayOfMonth}/${month}`;
}

export function isoDate(year: number, month: number, dayOfMonth: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(dayOfMonth).padStart(2, "0")}`;
}
```

- [ ] **Step 11: Correr los tests y el typecheck**

Run: `npx vitest run test/date.test.ts && npx tsc`
Expected: PASS y `tsc` sin errores.

- [ ] **Step 12: Commit**

```bash
git add package.json package-lock.json tsconfig.json wrangler.toml vitest.config.ts migrations src test
git commit -m "chore: setup del worker, D1 y utilidades de fecha

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
git log -1 --format='%ae | %ce'   # cindylevi@gmail.com | cindylevi@gmail.com
```

---

### Task 2: Parsers — interfaz, registro y primeros 6 juegos

**Files:**

- Create: `src/games/types.ts`, `src/games/attempts.ts`, `src/games/index.ts`
- Create: `src/games/fourByThree.ts`, `src/games/magnitudleDaily.ts`, `src/games/sizeItUp.ts`, `src/games/krillion.ts`, `src/games/foxiMax.ts`, `src/games/trivia.ts`
- Create: `test/fixtures/games.ts`
- Test: `test/games.test.ts`

**Interfaces:**

- Consumes: `isoDate` de `src/date.ts`.
- Produces:
  - `type Direction = "higher" | "lower"`
  - `interface ParsedResult { puzzle: string | null; score: number | null; display: string }`
  - `interface Game { id: string; name: string; emoji: string; direction: Direction; parse(text: string): ParsedResult | null }`
  - `parseAttempts(text: string, pattern: RegExp): ParsedResult | null` — `pattern` captura (1) puzzle, (2) intentos o `X`, (3) máximo
  - `GAMES: Game[]`, `interface Match { game: Game; result: ParsedResult }`, `parseResult(text: string): Match | null`
  - `FIXTURES: { id: string; text: string; expected: ParsedResult }[]` en `test/fixtures/games.ts`

- [ ] **Step 1: Crear los fixtures con los ejemplos reales**

`test/fixtures/games.ts`:

```ts
import type { ParsedResult } from "../../src/games/types";

export interface Fixture {
  id: string;
  text: string;
  expected: ParsedResult;
}

export const FIXTURES: Fixture[] = [
  {
    id: "4x3",
    text: `September 24, 2026
161 points • No mistakes
🌟🟦🟦
🌟🟪🟪
🌟🟨🟨
🌟🟩🟩
https://4x3.fun`,
    expected: { puzzle: "2026-09-24", score: 161, display: "161" },
  },
  {
    id: "magnitudle",
    text: `Magnitudle — Daily Question S20 · Q02

Score: 70/100
🟥🟥🟥🟥🟥🟥🟥◻️◻️◻️ https://magnitudle.com/daily`,
    expected: { puzzle: "S20-Q02", score: 70, display: "70/100" },
  },
  {
    id: "size-it-up",
    text: `Size It Up
Overall Score 185

🟥🟥⬜️⬜️⬜️ 43
🟥🟥🟥🟥⬜️ 74
🟥🟥⬜️⬜️⬜️ 30
🟥🟥⬜️⬜️⬜️ 30
⬜️⬜️⬜️⬜️⬜️ 8
https://magnitudle.com/size-it-up`,
    expected: { puzzle: null, score: 185, display: "185" },
  },
  {
    id: "krillion",
    text: `Krillion #70 🦐
385

🐟🦑🏮🦑🦑🦑🐟`,
    expected: { puzzle: "70", score: 385, display: "385" },
  },
  {
    id: "foximax",
    text: `🦊#FoxiMax #1488 6/8 (18 letters)
https://foximax.com/

🟩🟩🟩🟩🟩
🟩🟩🟩🟩🟩
🟩🟩🟩🟩🟩
🟩🟩🟩🟩🟩
⬜🟩🟩⬜🟩
🟩⬜🟩🟩🟩`,
    expected: { puzzle: "1488", score: 6, display: "6/8" },
  },
  {
    id: "foximax",
    text: `🦊#FoxiMax #1489 X/8 (18 letters)
https://foximax.com/`,
    expected: { puzzle: "1489", score: null, display: "X/8" },
  },
  {
    id: "trivia",
    text: `🎓 https://latriviadeldia.com/
23 de septiembre de 2026
🟩🟩🟩🟩🟥🟩🟥
5/7`,
    expected: { puzzle: "2026-09-23", score: 5, display: "5/7" },
  },
];
```

- [ ] **Step 2: Escribir los tests de parsers (fallan)**

`test/games.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseResult } from "../src/games";
import { FIXTURES } from "./fixtures/games";

describe("parseResult", () => {
  it.each(FIXTURES.map((f) => [f.id, f.expected.display, f] as const))(
    "%s %s",
    (_id, _display, fixture) => {
      const match = parseResult(fixture.text);
      expect(match?.game.id).toBe(fixture.id);
      expect(match?.result).toEqual(fixture.expected);
    },
  );

  it("ignora la charla normal del grupo", () => {
    expect(parseResult("alguien jugó el 4x3 hoy? a mí me fue horrible")).toBeNull();
    expect(parseResult("")).toBeNull();
  });
});
```

- [ ] **Step 3: Correr y verificar que fallan**

Run: `npx vitest run test/games.test.ts`
Expected: FAIL porque `../src/games` no existe.

- [ ] **Step 4: Crear `src/games/types.ts` y `src/games/attempts.ts`**

`src/games/types.ts`:

```ts
export type Direction = "higher" | "lower";

export interface ParsedResult {
  puzzle: string | null;
  score: number | null;
  display: string;
}

export interface Game {
  id: string;
  name: string;
  emoji: string;
  direction: Direction;
  parse(text: string): ParsedResult | null;
}
```

`src/games/attempts.ts`:

```ts
import type { ParsedResult } from "./types";

// Formatos "N/M" donde N son los intentos y "X" significa que no lo resolvió.
// pattern captura: (1) número de puzzle, (2) intentos o X, (3) máximo.
export function parseAttempts(text: string, pattern: RegExp): ParsedResult | null {
  const match = text.match(pattern);
  if (!match) return null;
  const attempts = match[2].toUpperCase();
  return {
    puzzle: match[1],
    score: attempts === "X" ? null : Number(attempts),
    display: `${attempts}/${match[3]}`,
  };
}
```

- [ ] **Step 5: Implementar los 6 parsers**

`src/games/fourByThree.ts`:

```ts
import { isoDate } from "../date";
import type { Game } from "./types";

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

export const fourByThree: Game = {
  id: "4x3",
  name: "4x3",
  emoji: "🟦",
  direction: "higher",
  parse(text) {
    if (!/4x3\.fun/i.test(text)) return null;
    const score = text.match(/(\d+)\s+points?\b/i);
    if (!score) return null;
    const date = text.match(/\b([a-z]+)\s+(\d{1,2}),\s*(\d{4})\b/i);
    const month = date ? MONTHS.indexOf(date[1].toLowerCase()) : -1;
    const puzzle = date && month >= 0 ? isoDate(Number(date[3]), month + 1, Number(date[2])) : null;
    return { puzzle, score: Number(score[1]), display: score[1] };
  },
};
```

`src/games/magnitudleDaily.ts`:

```ts
import type { Game } from "./types";

export const magnitudleDaily: Game = {
  id: "magnitudle",
  name: "Magnitudle Daily",
  emoji: "📏",
  direction: "higher",
  parse(text) {
    const header = text.match(/Magnitudle\s*[—–-]\s*Daily Question\s+(S\d+)\s*[·.•]\s*(Q\d+)/i);
    if (!header) return null;
    const score = text.match(/Score:\s*(\d+)\s*\/\s*100/i);
    if (!score) return null;
    return {
      puzzle: `${header[1].toUpperCase()}-${header[2].toUpperCase()}`,
      score: Number(score[1]),
      display: `${score[1]}/100`,
    };
  },
};
```

`src/games/sizeItUp.ts`:

```ts
import type { Game } from "./types";

export const sizeItUp: Game = {
  id: "size-it-up",
  name: "Size It Up",
  emoji: "📐",
  direction: "higher",
  parse(text) {
    if (!/Size It Up/i.test(text)) return null;
    const score = text.match(/Overall Score\s*:?\s*(\d+)/i);
    if (!score) return null;
    return { puzzle: null, score: Number(score[1]), display: score[1] };
  },
};
```

`src/games/krillion.ts`:

```ts
import type { Game } from "./types";

export const krillion: Game = {
  id: "krillion",
  name: "Krillion",
  emoji: "🦐",
  direction: "higher",
  parse(text) {
    const match = text.match(/Krillion\s+#(\d+)[^\n]*\n\s*(\d+)\s*(?:\n|$)/i);
    if (!match) return null;
    return { puzzle: match[1], score: Number(match[2]), display: match[2] };
  },
};
```

`src/games/foxiMax.ts`:

```ts
import { parseAttempts } from "./attempts";
import type { Game } from "./types";

export const foxiMax: Game = {
  id: "foximax",
  name: "FoxiMax",
  emoji: "🦊",
  direction: "lower",
  parse: (text) => parseAttempts(text, /#FoxiMax\s+#(\d+)\s+(\d+|X)\s*\/\s*(\d+)/i),
};
```

`src/games/trivia.ts`:

```ts
import { isoDate } from "../date";
import type { Game } from "./types";

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function monthIndex(name: string): number {
  const normalized = name.toLowerCase();
  return normalized === "setiembre" ? 8 : MONTHS.indexOf(normalized);
}

export const trivia: Game = {
  id: "trivia",
  name: "La Trivia del Día",
  emoji: "🎓",
  direction: "higher",
  parse(text) {
    if (!/latriviadeldia\.com/i.test(text)) return null;
    const score = text.match(/^\s*(\d+)\s*\/\s*(\d+)\s*$/m);
    if (!score) return null;
    const date = text.match(/(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})/i);
    const month = date ? monthIndex(date[2]) : -1;
    const puzzle = date && month >= 0 ? isoDate(Number(date[3]), month + 1, Number(date[1])) : null;
    return { puzzle, score: Number(score[1]), display: `${score[1]}/${score[2]}` };
  },
};
```

- [ ] **Step 6: Crear el registro `src/games/index.ts`**

```ts
import { fourByThree } from "./fourByThree";
import { foxiMax } from "./foxiMax";
import { krillion } from "./krillion";
import { magnitudleDaily } from "./magnitudleDaily";
import { sizeItUp } from "./sizeItUp";
import { trivia } from "./trivia";
import type { Game, ParsedResult } from "./types";

export const GAMES: Game[] = [fourByThree, magnitudleDaily, sizeItUp, krillion, foxiMax, trivia];

export interface Match {
  game: Game;
  result: ParsedResult;
}

export function parseResult(text: string): Match | null {
  for (const game of GAMES) {
    const result = game.parse(text);
    if (result) return { game, result };
  }
  return null;
}
```

- [ ] **Step 7: Correr los tests y el typecheck**

Run: `npx vitest run test/games.test.ts && npx tsc`
Expected: PASS (7 fixtures + charla normal) y `tsc` sin errores.

- [ ] **Step 8: Commit**

```bash
git add src/games test/fixtures test/games.test.ts
git commit -m "feat: parsers de 4x3, Magnitudle, Size It Up, Krillion, FoxiMax y Trivia

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
git log -1 --format='%ae | %ce'
```

---

### Task 3: Parsers — los 5 juegos restantes y exclusividad

**Files:**

- Create: `src/games/poople.ts`, `src/games/metazooa.ts`, `src/games/boludle.ts`, `src/games/pedantle.ts`, `src/games/catfishing.ts`
- Modify: `src/games/index.ts` (sumar al registro)
- Modify: `test/fixtures/games.ts` (sumar fixtures)
- Test: `test/games.test.ts`

**Interfaces:**

- Consumes: `Game`, `parseAttempts`, `GAMES`, `parseResult`, `FIXTURES` de la Task 2.
- Produces: `GAMES` con los 11 juegos en este orden: `fourByThree, magnitudleDaily, sizeItUp, krillion, foxiMax, trivia, poople, metazooa, boludle, pedantle, catfishing`.

- [ ] **Step 1: Sumar los fixtures**

Agregar al final del array `FIXTURES` en `test/fixtures/games.ts`:

```ts
  {
    id: "poople",
    text: `Poople #405 6/5
⬜⬜⬜⬜
⬜⬜⬜⬜
⬜🟫⬜⬜
⬜🟫🟫⬜
⬜🟫🟫⬜
⬜🟫🟫🟫
🟫🟫🟫🟫

https://poople.io/`,
    expected: { puzzle: "405", score: 6, display: "6/5" },
  },
  {
    id: "metazooa",
    text: `🦫 Animal #1151 🦖
I figured it out in 6 guesses!
🟧🟧🟧🟧🟧🟩
🔥 1 | Avg. Guesses: 5.5

https://metazooa.com
#metazooa`,
    expected: { puzzle: "1151", score: 6, display: "6" },
  },
  {
    id: "boludle",
    text: `boludle.com #1683 4/6

⬜🟨⬜⬜🟨
⬜🟨⬜⬜🟩
⬜🟨🟩⬜🟩
🟩🟩🟩🟩🟩

#boludle`,
    expected: { puzzle: "1683", score: 4, display: "4/6" },
  },
  {
    id: "boludle",
    text: `boludle.com #1684 X/6

⬜🟨⬜⬜🟨

#boludle`,
    expected: { puzzle: "1684", score: null, display: "X/6" },
  },
  {
    id: "pedantle",
    text: `I found #pedantle #1585 in 89 guesses!
🟩🟩🟩🟩🟩🟧🟧🟧🟧🟧🟧🟥🟥🟥🟥🟥🟥🟥🟥🟥
https://pedantle.certitudes.org/`,
    expected: { puzzle: "1585", score: 89, display: "89" },
  },
  {
    id: "catfishing",
    text: `catfishing.net
#818 - 4.5/10
🐟🐟🐟🐟🥚
🐈🐟🐈🐈🐈`,
    expected: { puzzle: "818", score: 4.5, display: "4.5/10" },
  },
```

- [ ] **Step 2: Sumar los tests de exclusividad y de comentarios alrededor**

Agregar en `test/games.test.ts`, dentro del `describe("parseResult")`, e importar `GAMES` junto a `parseResult`:

```ts
  it("cada fixture matchea con un solo juego", () => {
    for (const fixture of FIXTURES) {
      const matching = GAMES.filter((game) => game.parse(fixture.text) !== null).map((g) => g.id);
      expect(matching, fixture.text).toEqual([fixture.id]);
    }
  });

  it("parsea aunque haya comentario antes y después", () => {
    const boludle = FIXTURES.find((f) => f.id === "boludle")!;
    const trivia = FIXTURES.find((f) => f.id === "trivia")!;
    expect(parseResult(`uff hoy me costó\n${boludle.text}\njaja`)?.result).toEqual(boludle.expected);
    expect(parseResult(`${trivia.text}\nla última era imposible`)?.result).toEqual(trivia.expected);
  });

  it("no confunde menciones sueltas con resultados", () => {
    expect(parseResult("hoy saqué 4/6 en el boludle")).toBeNull();
    expect(parseResult("pasen el link de catfishing.net")).toBeNull();
  });
```

El import queda: `import { GAMES, parseResult } from "../src/games";`

- [ ] **Step 3: Correr y verificar que fallan**

Run: `npx vitest run test/games.test.ts`
Expected: FAIL en los fixtures nuevos (`match?.game.id` es `undefined`).

- [ ] **Step 4: Implementar los 5 parsers**

`src/games/poople.ts`:

```ts
import { parseAttempts } from "./attempts";
import type { Game } from "./types";

export const poople: Game = {
  id: "poople",
  name: "Poople",
  emoji: "🟫",
  direction: "lower",
  parse: (text) => parseAttempts(text, /Poople\s+#(\d+)\s+(\d+|X)\s*\/\s*(\d+)/i),
};
```

`src/games/metazooa.ts`:

```ts
import type { Game } from "./types";

export const metazooa: Game = {
  id: "metazooa",
  name: "Metazooa",
  emoji: "🦫",
  direction: "lower",
  parse(text) {
    if (!/metazooa/i.test(text)) return null;
    const puzzle = text.match(/Animal\s+#(\d+)/i);
    const guesses = text.match(/\bin\s+(\d+)\s+guess(?:es)?\b/i);
    if (!puzzle || !guesses) return null;
    return { puzzle: puzzle[1], score: Number(guesses[1]), display: guesses[1] };
  },
};
```

`src/games/boludle.ts`:

```ts
import { parseAttempts } from "./attempts";
import type { Game } from "./types";

export const boludle: Game = {
  id: "boludle",
  name: "Boludle",
  emoji: "🧉",
  direction: "lower",
  parse: (text) => parseAttempts(text, /boludle\.com\s+#(\d+)\s+(\d+|X)\s*\/\s*(\d+)/i),
};
```

`src/games/pedantle.ts`:

```ts
import type { Game } from "./types";

export const pedantle: Game = {
  id: "pedantle",
  name: "Pedantle",
  emoji: "📖",
  direction: "lower",
  parse(text) {
    const match = text.match(/#pedantle\s+#(\d+)\s+in\s+(\d+)\s+guess(?:es)?/i);
    if (!match) return null;
    return { puzzle: match[1], score: Number(match[2]), display: match[2] };
  },
};
```

`src/games/catfishing.ts`:

```ts
import type { Game } from "./types";

export const catfishing: Game = {
  id: "catfishing",
  name: "Catfishing",
  emoji: "🐈",
  direction: "higher",
  parse(text) {
    if (!/catfishing\.net/i.test(text)) return null;
    const match = text.match(/#(\d+)\s*-\s*(\d+(?:\.\d+)?)\s*\/\s*10\b/);
    if (!match) return null;
    return { puzzle: match[1], score: Number(match[2]), display: `${match[2]}/10` };
  },
};
```

- [ ] **Step 5: Sumarlos al registro**

En `src/games/index.ts`, agregar los imports y reemplazar `GAMES`:

```ts
import { boludle } from "./boludle";
import { catfishing } from "./catfishing";
import { metazooa } from "./metazooa";
import { pedantle } from "./pedantle";
import { poople } from "./poople";

export const GAMES: Game[] = [
  fourByThree, magnitudleDaily, sizeItUp, krillion, foxiMax, trivia,
  poople, metazooa, boludle, pedantle, catfishing,
];
```

- [ ] **Step 6: Correr los tests y el typecheck**

Run: `npx vitest run test/games.test.ts && npx tsc`
Expected: PASS (13 fixtures, exclusividad, comentarios, menciones sueltas).

- [ ] **Step 7: Commit**

```bash
git add src/games test/fixtures test/games.test.ts
git commit -m "feat: parsers de Poople, Metazooa, Boludle, Pedantle y Catfishing

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
git log -1 --format='%ae | %ce'
```

---

### Task 4: Persistencia en D1

**Files:**

- Create: `src/store.ts`
- Test: `test/store.test.ts`

**Interfaces:**

- Consumes: tabla `results` (Task 1), `env.DB` migrada en tests.
- Produces:
  - `interface StoredResult { userId: number; userName: string; game: string; puzzle: string; score: number | null; display: string; day: string; createdAt: number }`
  - `interface NewResult extends StoredResult { chatId: number; messageId: number }`
  - `saveResult(db: D1Database, result: NewResult): Promise<void>` — con `INSERT OR IGNORE`
  - `loadResults(db: D1Database, chatId: number): Promise<StoredResult[]>` — ordenados por `created_at, id`

- [ ] **Step 1: Escribir los tests (fallan)**

`test/store.test.ts`:

```ts
import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { loadResults, saveResult, type NewResult } from "../src/store";

const base: NewResult = {
  chatId: -1001,
  messageId: 1,
  userId: 42,
  userName: "Cindy",
  game: "boludle",
  puzzle: "1683",
  score: 4,
  display: "4/6",
  day: "2026-09-24",
  createdAt: 1_790_000_000,
};

describe("store", () => {
  it("guarda y lee un resultado", async () => {
    await saveResult(env.DB, base);
    const { chatId, messageId, ...stored } = base;
    expect(await loadResults(env.DB, -1001)).toEqual([stored]);
  });

  it("si el mismo puzzle llega dos veces, queda el primero", async () => {
    await saveResult(env.DB, base);
    await saveResult(env.DB, { ...base, messageId: 2, score: 3, display: "3/6", createdAt: base.createdAt + 60 });
    const rows = await loadResults(env.DB, -1001);
    expect(rows).toHaveLength(1);
    expect(rows[0].display).toBe("4/6");
  });

  it("guarda los fails con score null", async () => {
    await saveResult(env.DB, { ...base, score: null, display: "X/6" });
    expect((await loadResults(env.DB, -1001))[0].score).toBeNull();
  });

  it("solo lee los resultados del grupo pedido y en orden de llegada", async () => {
    await saveResult(env.DB, { ...base, userId: 2, createdAt: base.createdAt + 10 });
    await saveResult(env.DB, { ...base, userId: 1 });
    await saveResult(env.DB, { ...base, chatId: -2002, userId: 3 });
    expect((await loadResults(env.DB, -1001)).map((r) => r.userId)).toEqual([1, 2]);
  });
});
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `npx vitest run test/store.test.ts`
Expected: FAIL porque `../src/store` no existe.

- [ ] **Step 3: Implementar `src/store.ts`**

```ts
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
```

- [ ] **Step 4: Correr los tests y el typecheck**

Run: `npx vitest run test/store.test.ts && npx tsc`
Expected: PASS. Cada test arranca con la tabla vacía (el pool aísla el storage por test).

- [ ] **Step 5: Commit**

```bash
git add src/store.ts test/store.test.ts
git commit -m "feat: guardar y leer resultados en D1

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
git log -1 --format='%ae | %ce'
```

---

### Task 5: Estadísticas (funciones puras)

**Files:**

- Create: `src/stats.ts`, `test/helpers.ts`
- Test: `test/stats.test.ts`

**Interfaces:**

- Consumes: `StoredResult` (Task 4), `Direction` (Task 2), `previousDay` (Task 1).
- Produces:
  - `comparePuzzles(a: string, b: string): number` — numérico si ambos son dígitos, si no lexicográfico
  - `validResults(rows: StoredResult[]): StoredResult[]` — por (juego, día) deja solo el puzzle más jugado; empate → el mayor según `comparePuzzles`
  - `interface Placement { score: number; names: string[]; display: string }`
  - `podium(rows: StoredResult[], direction: Direction, size: number): Placement[]` — sin fails, empates juntos, hasta `size` lugares
  - `average(rows: StoredResult[]): number | null` — sin fails, redondeado a 1 decimal
  - `interface Streak { names: string[]; days: number }`
  - `longestCurrentStreak(valid: StoredResult[], game: string, day: string): Streak | null` — `null` si la más larga es < 2
  - `interface RankingEntry { names: string[]; games: number }`
  - `historicalRanking(valid: StoredResult[], upToDay: string, size?: number): RankingEntry[]` — `size` por defecto 3
  - `result(fields): StoredResult` en `test/helpers.ts`

- [ ] **Step 1: Crear el helper de tests**

`test/helpers.ts`:

```ts
import type { StoredResult } from "../src/store";

let sequence = 0;

type Required = Pick<StoredResult, "userId" | "game" | "day">;

// Arma un StoredResult con defaults razonables; createdAt crece en cada llamada
// para que el orden de creación sea el orden de llegada.
export function result(fields: Required & Partial<StoredResult>): StoredResult {
  sequence += 1;
  return {
    userName: `U${fields.userId}`,
    puzzle: fields.day,
    score: 1,
    display: "1",
    createdAt: sequence,
    ...fields,
  };
}
```

- [ ] **Step 2: Escribir los tests (fallan)**

`test/stats.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  average,
  comparePuzzles,
  historicalRanking,
  longestCurrentStreak,
  podium,
  validResults,
} from "../src/stats";
import { result } from "./helpers";

const D = "2026-09-24";

describe("comparePuzzles", () => {
  it("compara números como números y el resto como texto", () => {
    expect(comparePuzzles("1000", "999")).toBeGreaterThan(0);
    expect(comparePuzzles("2026-09-24", "2026-09-23")).toBeGreaterThan(0);
    expect(comparePuzzles("S20-Q02", "S20-Q02")).toBe(0);
  });
});

describe("validResults", () => {
  it("se queda con el puzzle más jugado del día y descarta los de archivo", () => {
    const rows = [
      result({ userId: 1, game: "boludle", day: D, puzzle: "1683" }),
      result({ userId: 2, game: "boludle", day: D, puzzle: "1683" }),
      result({ userId: 3, game: "boludle", day: D, puzzle: "1678" }),
    ];
    expect(validResults(rows).map((r) => r.userId)).toEqual([1, 2]);
  });

  it("si empatan, gana el puzzle más nuevo", () => {
    const rows = [
      result({ userId: 1, game: "boludle", day: D, puzzle: "999" }),
      result({ userId: 2, game: "boludle", day: D, puzzle: "1000" }),
    ];
    expect(validResults(rows).map((r) => r.puzzle)).toEqual(["1000"]);
  });

  it("decide por separado para cada juego y cada día", () => {
    const rows = [
      result({ userId: 1, game: "boludle", day: D, puzzle: "1683" }),
      result({ userId: 1, game: "poople", day: D, puzzle: "405" }),
      result({ userId: 1, game: "boludle", day: "2026-09-23", puzzle: "1682" }),
    ];
    expect(validResults(rows)).toHaveLength(3);
  });
});

describe("podium", () => {
  it("en juegos higher gana el más alto", () => {
    const rows = [
      result({ userId: 1, userName: "Ana", game: "4x3", day: D, score: 140, display: "140" }),
      result({ userId: 2, userName: "Cindy", game: "4x3", day: D, score: 161, display: "161" }),
    ];
    expect(podium(rows, "higher", 3)).toEqual([
      { score: 161, names: ["Cindy"], display: "161" },
      { score: 140, names: ["Ana"], display: "140" },
    ]);
  });

  it("en juegos lower gana el más bajo y los empates comparten lugar", () => {
    const rows = [
      result({ userId: 1, userName: "Ana", game: "boludle", day: D, score: 5, display: "5/6" }),
      result({ userId: 2, userName: "Juan", game: "boludle", day: D, score: 4, display: "4/6" }),
      result({ userId: 3, userName: "Lu", game: "boludle", day: D, score: 4, display: "4/6" }),
    ];
    expect(podium(rows, "lower", 3)).toEqual([
      { score: 4, names: ["Juan", "Lu"], display: "4/6" },
      { score: 5, names: ["Ana"], display: "5/6" },
    ]);
  });

  it("deja afuera los fails y respeta el tamaño", () => {
    const rows = [
      result({ userId: 1, game: "boludle", day: D, score: null, display: "X/6" }),
      result({ userId: 2, game: "boludle", day: D, score: 5 }),
      result({ userId: 3, game: "boludle", day: D, score: 3 }),
    ];
    expect(podium(rows, "lower", 1).map((p) => p.score)).toEqual([3]);
    expect(podium([rows[0]], "lower", 3)).toEqual([]);
  });
});

describe("average", () => {
  it("promedia sin fails y redondea a 1 decimal", () => {
    const scores = (...values: (number | null)[]) =>
      values.map((score, i) => result({ userId: i, game: "g", day: D, score }));
    expect(average(scores(4, 5, null))).toBe(4.5);
    expect(average(scores(1, 1, 2))).toBe(1.3);
    expect(average(scores(null))).toBeNull();
  });
});

describe("longestCurrentStreak", () => {
  const played = (userId: number, userName: string, day: string, puzzle = day) =>
    result({ userId, userName, game: "boludle", day, puzzle });

  it("cuenta los días seguidos hasta hoy", () => {
    const rows = [
      played(2, "Juan", "2026-09-22"),
      played(2, "Juan", "2026-09-23"),
      played(2, "Juan", D),
      played(1, "Cindy", "2026-09-23"),
      played(1, "Cindy", D),
    ];
    expect(longestCurrentStreak(validResults(rows), "boludle", D)).toEqual({ names: ["Juan"], days: 3 });
  });

  it("se corta si faltó un día y no muestra rachas de 1", () => {
    const rows = [played(2, "Juan", "2026-09-22"), played(2, "Juan", D)];
    expect(longestCurrentStreak(validResults(rows), "boludle", D)).toBeNull();
  });

  it("un puzzle de archivo no mantiene la racha", () => {
    const rows = [
      played(2, "Juan", "2026-09-23", "1678"),
      played(3, "Ana", "2026-09-23", "1682"),
      played(4, "Lu", "2026-09-23", "1682"),
      played(2, "Juan", D, "1683"),
    ];
    expect(longestCurrentStreak(validResults(rows), "boludle", D)).toBeNull();
  });

  it("los empates se listan juntos y solo cuenta quien jugó hoy", () => {
    const rows = [
      played(1, "Cindy", "2026-09-23"),
      played(1, "Cindy", D),
      played(2, "Juan", "2026-09-23"),
      played(2, "Juan", D),
      played(3, "Ana", "2026-09-21"),
      played(3, "Ana", "2026-09-22"),
      played(3, "Ana", "2026-09-23"),
    ];
    expect(longestCurrentStreak(validResults(rows), "boludle", D)).toEqual({
      names: ["Cindy", "Juan"],
      days: 2,
    });
  });
});

describe("historicalRanking", () => {
  it("cuenta partidas, agrupa empates y usa el nombre más reciente", () => {
    const rows = [
      result({ userId: 1, userName: "Cin", game: "boludle", day: "2026-09-23" }),
      result({ userId: 2, userName: "Juan", game: "boludle", day: "2026-09-23" }),
      result({ userId: 1, userName: "Cindy", game: "boludle", day: D }),
      result({ userId: 2, userName: "Juan", game: "poople", day: D }),
      result({ userId: 3, userName: "Ana", game: "poople", day: D }),
    ];
    expect(historicalRanking(rows, D)).toEqual([
      { names: ["Cindy", "Juan"], games: 2 },
      { names: ["Ana"], games: 1 },
    ]);
  });

  it("no cuenta días posteriores y respeta el tamaño", () => {
    const rows = [
      result({ userId: 1, game: "boludle", day: D }),
      result({ userId: 1, game: "boludle", day: "2026-09-25" }),
      result({ userId: 2, game: "boludle", day: D }),
      result({ userId: 2, game: "poople", day: D }),
    ];
    expect(historicalRanking(rows, D, 1)).toEqual([{ names: ["U2"], games: 2 }]);
  });
});
```

- [ ] **Step 3: Correr y verificar que fallan**

Run: `npx vitest run test/stats.test.ts`
Expected: FAIL porque `../src/stats` no existe.

- [ ] **Step 4: Implementar `src/stats.ts`**

```ts
import { previousDay } from "./date";
import type { Direction } from "./games/types";
import type { StoredResult } from "./store";

export interface Placement {
  score: number;
  names: string[];
  display: string;
}

export interface Streak {
  names: string[];
  days: number;
}

export interface RankingEntry {
  names: string[];
  games: number;
}

export function comparePuzzles(a: string, b: string): number {
  if (/^\d+$/.test(a) && /^\d+$/.test(b)) return Number(a) - Number(b);
  return a < b ? -1 : a > b ? 1 : 0;
}

export function validResults(rows: StoredResult[]): StoredResult[] {
  const counts = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const key = `${row.game}|${row.day}`;
    const puzzles = counts.get(key) ?? new Map<string, number>();
    puzzles.set(row.puzzle, (puzzles.get(row.puzzle) ?? 0) + 1);
    counts.set(key, puzzles);
  }

  const mainPuzzle = new Map<string, string>();
  for (const [key, puzzles] of counts) {
    let best: [string, number] | undefined;
    for (const entry of puzzles) {
      if (!best || entry[1] > best[1] || (entry[1] === best[1] && comparePuzzles(entry[0], best[0]) > 0)) {
        best = entry;
      }
    }
    mainPuzzle.set(key, best![0]);
  }

  return rows.filter((row) => mainPuzzle.get(`${row.game}|${row.day}`) === row.puzzle);
}

export function podium(rows: StoredResult[], direction: Direction, size: number): Placement[] {
  const solved = rows
    .filter((row): row is StoredResult & { score: number } => row.score !== null)
    .sort((a, b) => (direction === "higher" ? b.score - a.score : a.score - b.score));

  const placements: Placement[] = [];
  for (const row of solved) {
    const last = placements.at(-1);
    if (last && last.score === row.score) {
      last.names.push(row.userName);
      continue;
    }
    if (placements.length === size) break;
    placements.push({ score: row.score, names: [row.userName], display: row.display });
  }
  return placements;
}

export function average(rows: StoredResult[]): number | null {
  const scores = rows.flatMap((row) => (row.score === null ? [] : [row.score]));
  if (scores.length === 0) return null;
  const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  return Math.round(mean * 10) / 10;
}

export function longestCurrentStreak(valid: StoredResult[], game: string, day: string): Streak | null {
  const gameRows = valid.filter((row) => row.game === game);
  const played = new Set(gameRows.map((row) => `${row.userId}|${row.day}`));

  let best: Streak | null = null;
  const seen = new Set<number>();
  for (const row of gameRows) {
    if (row.day !== day || seen.has(row.userId)) continue;
    seen.add(row.userId);

    let days = 0;
    for (let current = day; played.has(`${row.userId}|${current}`); current = previousDay(current)) {
      days += 1;
    }

    if (!best || days > best.days) best = { names: [row.userName], days };
    else if (days === best.days) best.names.push(row.userName);
  }

  return best && best.days >= 2 ? best : null;
}

export function historicalRanking(valid: StoredResult[], upToDay: string, size = 3): RankingEntry[] {
  const totals = new Map<number, { name: string; latest: number; games: number }>();
  for (const row of valid) {
    if (row.day > upToDay) continue;
    const entry = totals.get(row.userId) ?? { name: row.userName, latest: row.createdAt, games: 0 };
    entry.games += 1;
    if (row.createdAt >= entry.latest) {
      entry.name = row.userName;
      entry.latest = row.createdAt;
    }
    totals.set(row.userId, entry);
  }

  const sorted = [...totals.values()].sort((a, b) => b.games - a.games);
  const ranking: RankingEntry[] = [];
  for (const entry of sorted) {
    const last = ranking.at(-1);
    if (last && last.games === entry.games) {
      last.names.push(entry.name);
      continue;
    }
    if (ranking.length === size) break;
    ranking.push({ names: [entry.name], games: entry.games });
  }
  return ranking;
}
```

- [ ] **Step 5: Correr los tests y el typecheck**

Run: `npx vitest run test/stats.test.ts && npx tsc`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/stats.ts test/helpers.ts test/stats.test.ts
git commit -m "feat: estadísticas del día, rachas y ranking histórico

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
git log -1 --format='%ae | %ce'
```

---

### Task 6: Armado del texto del resumen

**Files:**

- Create: `src/summary.ts`
- Test: `test/summary.test.ts`

**Interfaces:**

- Consumes: `GAMES` (Task 3), `shortDay` (Task 1), `validResults`, `podium`, `average`, `longestCurrentStreak`, `historicalRanking` (Task 5), `StoredResult` (Task 4), `result` de `test/helpers.ts`.
- Produces:
  - `buildSummary(rows: StoredResult[], day: string): string | null` — `null` si no hay resultados válidos ese día
  - `joinNames(names: string[]): string` — `"a"`, `"a y b"`, `"a, b y c"`

- [ ] **Step 1: Escribir los tests (fallan)**

`test/summary.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildSummary, joinNames } from "../src/summary";
import { result } from "./helpers";

const D = "2026-09-24";

describe("joinNames", () => {
  it("une con coma y 'y'", () => {
    expect(joinNames(["Ana"])).toBe("Ana");
    expect(joinNames(["Ana", "Juan"])).toBe("Ana y Juan");
    expect(joinNames(["Ana", "Juan", "Lu"])).toBe("Ana, Juan y Lu");
  });
});

describe("buildSummary", () => {
  it("arma el resumen completo con podio, racha y ranking", () => {
    const fourByThree = (userId: number, userName: string, day: string, score: number) =>
      result({ userId, userName, game: "4x3", day, score, display: String(score) });
    const boludle = (userId: number, userName: string, score: number | null) =>
      result({
        userId,
        userName,
        game: "boludle",
        day: D,
        puzzle: "1683",
        score,
        display: score === null ? "X/6" : `${score}/6`,
      });

    const rows = [
      fourByThree(2, "Juan", "2026-09-22", 100),
      fourByThree(2, "Juan", "2026-09-23", 100),
      fourByThree(1, "Cindy", "2026-09-23", 100),
      fourByThree(1, "Cindy", D, 161),
      fourByThree(2, "Juan", D, 150),
      fourByThree(3, "Ana", D, 140),
      fourByThree(4, "Pedro", D, 130),
      fourByThree(5, "Lu", D, 120),
      fourByThree(6, "Sofi", D, 110),
      fourByThree(7, "Tomi", D, 113),
      boludle(2, "Juan", 4),
      boludle(3, "Ana", 5),
      boludle(4, "Pedro", null),
    ];

    expect(buildSummary(rows, D)).toBe(
      [
        "📊 Resumen del 24/09",
        "",
        "🎮 Más jugado: 4x3 (7 personas)",
        "",
        "🟦 4x3 — 7 personas · promedio 132",
        "   🥇 Cindy — 161",
        "   🥈 Juan — 150",
        "   🥉 Ana — 140",
        "   🔥 Racha: Juan, 3 días",
        "",
        "🧉 Boludle — 3 personas · promedio 4.5",
        "   🥇 Juan — 4/6",
        "",
        "🏆 Ranking histórico",
        "   🥇 Juan — 4 partidas",
        "   🥈 Cindy, Ana y Pedro — 2",
        "   🥉 Lu, Sofi y Tomi — 1",
      ].join("\n"),
    );
  });

  it("con una sola persona que no lo resolvió: sin promedio ni medalla", () => {
    const rows = [
      result({ userId: 1, userName: "Cindy", game: "boludle", day: D, puzzle: "1683", score: null, display: "X/6" }),
    ];
    expect(buildSummary(rows, D)).toBe(
      [
        "📊 Resumen del 24/09",
        "",
        "🎮 Más jugado: Boludle (1 persona)",
        "",
        "🧉 Boludle — 1 persona",
        "",
        "🏆 Ranking histórico",
        "   🥇 Cindy — 1 partida",
      ].join("\n"),
    );
  });

  it("lista todos los juegos empatados como más jugados", () => {
    const rows = [
      result({ userId: 1, game: "boludle", day: D, puzzle: "1683" }),
      result({ userId: 1, game: "4x3", day: D }),
    ];
    expect(buildSummary(rows, D)).toContain("🎮 Más jugado: 4x3 y Boludle (1 persona)");
  });

  it("devuelve null si ese día no jugó nadie", () => {
    const rows = [result({ userId: 1, game: "boludle", day: "2026-09-23" })];
    expect(buildSummary(rows, D)).toBeNull();
    expect(buildSummary([], D)).toBeNull();
  });
});
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `npx vitest run test/summary.test.ts`
Expected: FAIL porque `../src/summary` no existe.

- [ ] **Step 3: Implementar `src/summary.ts`**

```ts
import { shortDay } from "./date";
import { GAMES } from "./games";
import { average, historicalRanking, longestCurrentStreak, podium, validResults } from "./stats";
import type { StoredResult } from "./store";

const MEDALS = ["🥇", "🥈", "🥉"];
const PODIUM_MIN_PLAYERS = 7;

export function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} y ${names.at(-1)}`;
}

function people(count: number): string {
  return count === 1 ? "1 persona" : `${count} personas`;
}

function matches(count: number): string {
  return count === 1 ? "1 partida" : `${count} partidas`;
}

export function buildSummary(rows: StoredResult[], day: string): string | null {
  const valid = validResults(rows);
  const today = valid.filter((row) => row.day === day);
  if (today.length === 0) return null;

  const games = GAMES.map((game) => ({ game, rows: today.filter((row) => row.game === game.id) }))
    .filter((entry) => entry.rows.length > 0)
    .sort((a, b) => b.rows.length - a.rows.length);

  const mostPlayers = games[0].rows.length;
  const mostPlayed = games.filter((entry) => entry.rows.length === mostPlayers).map((entry) => entry.game.name);

  const lines = [
    `📊 Resumen del ${shortDay(day)}`,
    "",
    `🎮 Más jugado: ${joinNames(mostPlayed)} (${people(mostPlayers)})`,
  ];

  for (const { game, rows: gameRows } of games) {
    const mean = average(gameRows);
    lines.push("", `${game.emoji} ${game.name} — ${people(gameRows.length)}${mean === null ? "" : ` · promedio ${mean}`}`);

    const size = gameRows.length >= PODIUM_MIN_PLAYERS ? 3 : 1;
    podium(gameRows, game.direction, size).forEach((place, i) => {
      lines.push(`   ${MEDALS[i]} ${joinNames(place.names)} — ${place.display}`);
    });

    const streak = longestCurrentStreak(valid, game.id, day);
    if (streak) lines.push(`   🔥 Racha: ${joinNames(streak.names)}, ${streak.days} días`);
  }

  lines.push("", "🏆 Ranking histórico");
  historicalRanking(valid, day).forEach((entry, i) => {
    lines.push(`   ${MEDALS[i]} ${joinNames(entry.names)} — ${i === 0 ? matches(entry.games) : entry.games}`);
  });

  return lines.join("\n");
}
```

- [ ] **Step 4: Correr los tests y el typecheck**

Run: `npx vitest run test/summary.test.ts && npx tsc`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/summary.ts test/summary.test.ts
git commit -m "feat: armar el texto del resumen diario

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
git log -1 --format='%ae | %ce'
```

---

### Task 7: Telegram, webhook y cron

**Files:**

- Create: `src/telegram.ts`, `src/index.ts`
- Test: `test/telegram.test.ts`, `test/index.test.ts`

**Interfaces:**

- Consumes: `Env` (Task 1), `dayInArgentina` (Task 1), `parseResult` (Task 3), `saveResult`, `loadResults` (Task 4), `buildSummary` (Task 6).
- Produces:
  - `interface TelegramUpdate { update_id: number; message?: TelegramMessage; edited_message?: TelegramMessage }`
  - `interface TelegramMessage { message_id: number; date: number; chat: { id: number }; from?: TelegramUser; text?: string }`
  - `interface TelegramUser { id: number; is_bot: boolean; first_name: string; username?: string }`
  - `chunkText(text: string, limit?: number): string[]` — límite por defecto 4096, parte por `"\n\n"`
  - `sendMessage(token: string, chatId: number, text: string): Promise<void>` — manda cada chunk; tira error si Telegram responde no-OK
  - `default export` del Worker con `fetch` y `scheduled`

- [ ] **Step 1: Escribir los tests de `telegram.ts` (fallan)**

`test/telegram.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { chunkText, sendMessage } from "../src/telegram";

afterEach(() => vi.restoreAllMocks());

describe("chunkText", () => {
  it("deja el texto entero si entra", () => {
    expect(chunkText("a\n\nb", 10)).toEqual(["a\n\nb"]);
  });

  it("parte por párrafos sin pasarse del límite", () => {
    expect(chunkText("aaaa\n\nbbbb\n\ncc", 10)).toEqual(["aaaa\n\nbbbb", "cc"]);
  });

  it("corta un párrafo que solo ya no entra", () => {
    expect(chunkText("abcdefghij", 4)).toEqual(["abcd", "efgh", "ij"]);
  });
});

describe("sendMessage", () => {
  it("manda un POST por chunk a la API de Telegram", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response("{}"));
    await sendMessage("tok", -1001, "hola");
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://api.telegram.org/bottok/sendMessage");
    expect(JSON.parse(String(init?.body))).toEqual({ chat_id: -1001, text: "hola" });
  });

  it("tira error si Telegram responde con error", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response("bad", { status: 400 }));
    await expect(sendMessage("tok", -1001, "hola")).rejects.toThrow("sendMessage 400");
  });
});
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `npx vitest run test/telegram.test.ts`
Expected: FAIL porque `../src/telegram` no existe.

- [ ] **Step 3: Implementar `src/telegram.ts`**

```ts
export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
}

export interface TelegramMessage {
  message_id: number;
  date: number;
  chat: { id: number };
  from?: TelegramUser;
  text?: string;
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
```

- [ ] **Step 4: Correr los tests de telegram**

Run: `npx vitest run test/telegram.test.ts`
Expected: PASS.

- [ ] **Step 5: Escribir los tests del Worker (fallan)**

`test/index.test.ts`:

```ts
import { createScheduledController, env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import type { Env } from "../src/env";
import worker from "../src/index";
import type { TelegramMessage, TelegramUpdate } from "../src/telegram";
import { FIXTURES } from "./fixtures/games";

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

const CHAT = -1001;
const testEnv: Env = { ...env, GROUP_CHAT_ID: String(CHAT) };
// 2026-09-24 15:00 en Argentina
const DATE = Date.UTC(2026, 8, 24, 18, 0) / 1000;
const boludle = FIXTURES.find((f) => f.id === "boludle")!.text;

let fetchSpy: MockInstance<typeof fetch>;

beforeEach(() => {
  fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response("{}"));
});

afterEach(() => vi.restoreAllMocks());

function message(overrides: Partial<TelegramMessage> = {}): TelegramMessage {
  return {
    message_id: 1,
    date: DATE,
    chat: { id: CHAT },
    from: { id: 42, is_bot: false, first_name: "Cindy" },
    text: boludle,
    ...overrides,
  };
}

// Los handlers no usan ctx, así que se llaman solo con (request, env).
function post(update: TelegramUpdate, secret = "test-secret") {
  return worker.fetch(
    new IncomingRequest("https://bot.test/webhook", {
      method: "POST",
      headers: { "X-Telegram-Bot-Api-Secret-Token": secret, "content-type": "application/json" },
      body: JSON.stringify(update),
    }),
    testEnv,
  );
}

async function storedRows() {
  return (await env.DB.prepare("SELECT user_id, user_name, game, puzzle, day FROM results").all()).results;
}

function sentTexts(): string[] {
  return fetchSpy.mock.calls.map(([, init]) => JSON.parse(String(init?.body)).text);
}

describe("webhook", () => {
  it("guarda un resultado del grupo", async () => {
    const response = await post({ update_id: 1, message: message() });
    expect(response.status).toBe(200);
    expect(await storedRows()).toEqual([
      { user_id: 42, user_name: "Cindy", game: "boludle", puzzle: "1683", day: "2026-09-24" },
    ]);
  });

  it("usa el día de envío como puzzle cuando el juego no trae número", async () => {
    const sizeItUp = FIXTURES.find((f) => f.id === "size-it-up")!.text;
    await post({ update_id: 1, message: message({ text: sizeItUp }) });
    expect((await storedRows())[0]).toMatchObject({ game: "size-it-up", puzzle: "2026-09-24" });
  });

  it("ignora el duplicado", async () => {
    await post({ update_id: 1, message: message() });
    await post({ update_id: 2, message: message({ message_id: 2 }) });
    expect(await storedRows()).toHaveLength(1);
  });

  it("rechaza un secreto inválido", async () => {
    const response = await post({ update_id: 1, message: message() }, "otro");
    expect(response.status).toBe(401);
    expect(await storedRows()).toHaveLength(0);
  });

  it("ignora otros chats, charla normal, ediciones, bots y mensajes sin autor", async () => {
    await post({ update_id: 1, message: message({ chat: { id: -2002 } }) });
    await post({ update_id: 2, message: message({ text: "buen día gente" }) });
    await post({ update_id: 3, edited_message: message() });
    await post({ update_id: 4, message: message({ from: { id: 1087968824, is_bot: true, first_name: "Group" } }) });
    await post({ update_id: 5, message: message({ from: undefined }) });
    expect(await storedRows()).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("responde 200 aunque el body sea inválido", async () => {
    const response = await worker.fetch(
      new IncomingRequest("https://bot.test/webhook", {
        method: "POST",
        headers: { "X-Telegram-Bot-Api-Secret-Token": "test-secret" },
        body: "no es json",
      }),
      testEnv,
    );
    expect(response.status).toBe(200);
  });

  it("devuelve 404 fuera de POST /webhook", async () => {
    const response = await worker.fetch(new IncomingRequest("https://bot.test/"), testEnv);
    expect(response.status).toBe(404);
  });
});

describe("/resumen", () => {
  it("manda el resumen del día en curso", async () => {
    await post({ update_id: 1, message: message() });
    await post({ update_id: 2, message: message({ message_id: 2, text: "/resumen" }) });
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy.mock.calls[0][0]).toBe("https://api.telegram.org/bottest-token/sendMessage");
    expect(sentTexts()[0]).toContain("📊 Resumen del 24/09");
  });

  it("acepta /resumen@NombreDelBot y avisa si no jugó nadie", async () => {
    await post({ update_id: 1, message: message({ text: "/resumen@ResumenJuegosBot" }) });
    expect(sentTexts()).toEqual(["Hoy todavía no jugó nadie."]);
  });
});

describe("cron", () => {
  async function runCron() {
    // 02:59 UTC del 25/09 = 23:59 del 24/09 en Argentina
    await worker.scheduled(
      createScheduledController({ scheduledTime: Date.UTC(2026, 8, 25, 2, 59), cron: "59 2 * * *" }),
      testEnv,
    );
  }

  it("manda el resumen del día que termina", async () => {
    await post({ update_id: 1, message: message() });
    await runCron();
    expect(sentTexts()[0]).toContain("📊 Resumen del 24/09");
  });

  it("no manda nada si ese día no jugó nadie", async () => {
    await runCron();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: Correr y verificar que fallan**

Run: `npx vitest run test/index.test.ts`
Expected: FAIL porque `../src/index` no existe.

- [ ] **Step 7: Implementar `src/index.ts`**

```ts
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
```

- [ ] **Step 8: Correr toda la suite y el typecheck**

Run: `npm test && npx tsc`
Expected: todo PASS y `tsc` sin errores. El test de body inválido loguea un `webhook error` en consola: es esperado.

- [ ] **Step 9: Probar local con `wrangler dev`**

Run (en una terminal): `npx wrangler dev --test-scheduled`

En otra:

```bash
npx wrangler d1 migrations apply resumen-juegos --local
curl -s -X POST http://localhost:8787/webhook -H 'X-Telegram-Bot-Api-Secret-Token: x' -d '{}' -w '%{http_code}\n'
```

Expected: `401` (localmente `WEBHOOK_SECRET` no está definido, así que cualquier secreto es inválido). Confirma que el Worker levanta y enruta. Cortar `wrangler dev`.

- [ ] **Step 10: Commit**

```bash
git add src/telegram.ts src/index.ts test/telegram.test.ts test/index.test.ts
git commit -m "feat: webhook de Telegram, comando /resumen y cron diario

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
git log -1 --format='%ae | %ce'
```

---

### Task 8: Deploy con las cuentas personales

Esta task la hace la usuaria con acompañamiento: incluye crear cuentas, loguearse en el browser y cargar secretos. El agente no corre comandos `--remote`, `deploy` ni `secret put` sin que ella lo confirme en el momento.

**Files:**

- Modify: `wrangler.toml` (`database_id`, `GROUP_CHAT_ID`)

- [ ] **Step 1: Crear el bot en Telegram (cuenta personal)**

1. Hablarle a **@BotFather**: `/newbot`, elegir nombre y username. Guardar el token en un lugar seguro (no en el repo).
2. `/setprivacy` → elegir el bot → **Disable**.
3. Agregar el bot al grupo. Si ya estaba agregado antes de apagar el privacy mode, sacarlo y volverlo a agregar para que tome el cambio.
4. Convertir el grupo a supergrupo **antes** de sacar el id: en la config del grupo, poner "Historial del chat para nuevos miembros" en **Visible**. Así el id ya queda en su forma final (`-100…`) y no cambia después.

- [ ] **Step 2: Obtener el id del grupo**

Mandar cualquier mensaje en el grupo y correr (con el token en la variable, sin guardarlo en el historial de otro lado):

```bash
read -s TOKEN
curl -s "https://api.telegram.org/bot$TOKEN/getUpdates" | python3 -m json.tool | grep -A3 '"chat"'
```

Expected: un `"id": -100...`. Ese es el `GROUP_CHAT_ID`. `getUpdates` solo funciona mientras no haya webhook configurado.

- [ ] **Step 3: Loguear Wrangler con la cuenta personal de Cloudflare**

1. Si no hay cuenta, crearla en `dash.cloudflare.com` con `cindylevi@gmail.com`. En el browser, verificar que no haya una sesión de Cloudflare de otra cuenta abierta.
2. Run: `npx wrangler login`
3. Run: `npx wrangler whoami`

Expected: muestra la cuenta personal (`cindylevi@gmail.com`). Si muestra otra, `npx wrangler logout` y repetir.

- [ ] **Step 4: Crear la base D1 y aplicar la migración**

```bash
npx wrangler d1 create resumen-juegos
```

Copiar el `database_id` que imprime al `wrangler.toml` y poner el `GROUP_CHAT_ID` del Step 2 en `[vars]`. Después:

```bash
npx wrangler d1 migrations apply resumen-juegos --remote
```

Expected: `0001_results.sql` aplicada.

- [ ] **Step 5: Deployar y cargar los secretos**

```bash
npm test
npx wrangler deploy
npx wrangler secret put BOT_TOKEN        # pegar el token de BotFather
openssl rand -hex 32                     # copiar el valor
npx wrangler secret put WEBHOOK_SECRET   # pegar ese valor
```

Expected: el deploy imprime la URL `https://resumen-juegos-bot.<subdominio>.workers.dev` y el cron `59 2 * * *`. Si es el primer deploy, Wrangler pide elegir el subdominio de `workers.dev`.

- [ ] **Step 6: Registrar el webhook**

```bash
read -s TOKEN; read -s SECRET
curl -s "https://api.telegram.org/bot$TOKEN/setWebhook" \
  -d "url=https://resumen-juegos-bot.<subdominio>.workers.dev/webhook" \
  -d "secret_token=$SECRET" \
  -d 'allowed_updates=["message"]'
curl -s "https://api.telegram.org/bot$TOKEN/getWebhookInfo"
```

Expected: `{"ok":true,...}` y `getWebhookInfo` con la URL y sin `last_error_message`.

- [ ] **Step 7: Prueba de punta a punta**

1. En otra terminal: `npx wrangler tail`.
2. Pegar un resultado real en el grupo (por ejemplo el de Boludle).
3. Run: `npx wrangler d1 execute resumen-juegos --remote --command "SELECT user_name, game, puzzle, display, day FROM results"`
4. Mandar `/resumen` en el grupo.

Expected: la fila aparece en D1 y el bot responde con el resumen. `wrangler tail` no muestra errores.

- [ ] **Step 8: Commit y push a GitHub personal**

```bash
git add wrangler.toml
git commit -m "chore: configurar D1 y grupo de producción

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
git log --format='%h %ae | %ce'        # todos cindylevi@gmail.com
git remote -v                           # git@github-tesis:cindylevi/telegram-bot.git
git push -u origin main
```

Expected: el push pasa por la key de tesis (cuenta `cindylevi`). El repo en GitHub conviene que sea privado: el `wrangler.toml` tiene el id del grupo.
