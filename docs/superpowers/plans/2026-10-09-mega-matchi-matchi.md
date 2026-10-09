# MEGA matchi matchi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separar el matchi matchi en común (mismo puntaje) y MEGA (mismo puntaje y mismo detalle), anunciar el MEGA con una foto generada, y dejar que cada persona elija por privado la foto que usa el bot.

**Architecture:** La clasificación vive en `src/stats.ts` (resumen y `/detalle`) y en `findTwins` de `src/store.ts` (aviso en vivo); las dos usan `display` como clave común y `pattern + display` como clave MEGA. La foto se arma como HTML en `src/mega.ts`, se convierte a PNG con el binding `BROWSER` de Browser Rendering (`src/render.ts`) y se manda con `sendPhoto` desde `src/announce.ts`, en `ctx.waitUntil`, con el texto como respaldo. `/mifoto` guarda un `file_id` de Telegram en D1 (`src/photoStore.ts`).

**Tech Stack:** TypeScript, Cloudflare Workers + D1 + Browser Rendering (Quick Actions), Telegram Bot API, Vitest con `@cloudflare/vitest-pool-workers`.

**Spec:** `docs/specs/2026-10-09-mega-matchi-matchi-design.md`

## Global Constraints

- Todo con cuentas personales: git `user.email` = `cindylevi@gmail.com` (verificar con `git log -1 --format='%ae'` después de cada commit), push por el remote `github-tesis`, Cloudflare personal. Nada de `gh` en este repo.
- El token del bot vive en `.dev.vars`; nunca imprimirlo. Las URLs `https://api.telegram.org/file/bot<token>/…` nunca salen del Worker.
- Plan gratis de Workers: 10 ms de CPU por request (esperar un `fetch` o el render no cuenta) y 10 minutos de navegador por día.
- `quickAction` requiere `compatibility_date` `2026-03-24` o posterior.
- Prototipo aprobado, en `.mega-prototype/` (ignorada por git en `.git/info/exclude`, no se commitea porque tiene la foto de Rafa): `mega.html` y `v8.png` (diseño final), `foca.jpg` (foca recortada) y `rafa.jpg` (foto de prueba). `$SCRATCH` = el scratchpad de la sesión, para lo descartable.
- Textos del bot en castellano rioplatense, con el tono de los mensajes existentes.
- Comentarios en el código: en castellano, cortos, explicando el porqué, como el resto del repo.
- Imagen: 1080 × 1080; "MEGA" en Bungee y "Matchi Matchi" en Lobster con relleno de brillitos; corazón dividido en franjas verticales (máximo 6); ocho focas fijas y asimétricas dentro del lienzo.
- Juegos: la Trivia (`trivia`) nunca tiene MEGA; Magnitudle y Originle no tienen detalle; Size It Up y MapTap comparan las rondas.

## Review Focus

- **Emojis y fuentes en el Chrome de Cloudflare:** el navegador remoto corre en Linux y puede no tener fuente de emojis; los adornos se dibujan con SVG, no con emojis, y las tipografías de Google Fonts tienen que estar cargadas antes de la captura (`waitUntil: "networkidle0"`). Test en la Task 5: el HTML no contiene emojis y enlaza Bungee y Lobster.
- **Nombres con caracteres de HTML o que empiezan con emoji:** la inicial sale de la primera letra o número del nombre y se escapa (`<`, `&`, comillas). Test en la Task 5.
- **Falla la foto de una sola persona:** si `getFile` o la descarga fallan para alguien, esa persona va con su inicial y el mega sale igual con foto (no cae al texto). Test en la Task 7.
- **Más de 6 personas en un mega:** la imagen muestra 6 franjas y el epígrafe nombra a todas. Test en la Task 7.
- **`/mifoto` con la imagen mandada como archivo:** Telegram la manda como `document`, no como `photo`; el bot avisa que la mande como foto en vez de quedarse callado. Test en la Task 6.

---

### Task 1: Spike de Browser Rendering y de las herramientas

Confirmar, antes de escribir código del bot, que `quickAction("screenshot")` acepta `html` desde un Worker deployado, y que los tests siguen corriendo con la `compatibility_date` nueva y el binding `[browser]`. El Worker de prueba es descartable.

**Files:**

- Create (descartable, fuera del repo): `$SCRATCH/mega-spike/wrangler.toml`, `$SCRATCH/mega-spike/index.ts`
- Modify: `wrangler.toml`
- Modify: `src/env.ts`

**Interfaces:**

- Produces: `Env.BROWSER: BrowserRun` (tipo de `@cloudflare/workers-types`) y el binding `BROWSER` en `wrangler.toml`.

- [ ] **Step 1: Armar el Worker de prueba**

`$SCRATCH` es el scratchpad de la sesión que ejecuta el plan; los archivos del prototipo están en `.mega-prototype/` (ver Global Constraints). `index.ts` recibe el HTML por POST y devuelve la captura:

```ts
export default {
  async fetch(request: Request, env: { BROWSER: BrowserRun }): Promise<Response> {
    if (request.method !== "POST") return new Response("POST con el HTML", { status: 405 });
    return env.BROWSER.quickAction("screenshot", {
      html: await request.text(),
      viewport: { width: 1080, height: 1080 },
      gotoOptions: { waitUntil: "networkidle0" },
      screenshotOptions: { type: "png" },
    });
  },
};
```

`wrangler.toml`:

```toml
name = "mega-spike"
main = "index.ts"
compatibility_date = "2026-10-01"

[browser]
binding = "BROWSER"
```

- [ ] **Step 2: Deployar y pedir la captura del prototipo aprobado**

Run:

```bash
cd $SCRATCH/mega-spike && npx -y wrangler@4.139.0 deploy
curl -s -X POST --data-binary @.mega-prototype/mega.html https://mega-spike.<subdominio>.workers.dev -o .mega-prototype/spike.png -w '%{http_code} %{size_download}\n'
```

Expected: `200` y un PNG de más de 100 KB. Mirarlo con Read: tiene que verse igual que `v8.png` (tipografías Bungee y Lobster cargadas). Anotar si los emojis ✨💖 se ven o salen como cuadraditos (confirma la decisión de dibujarlos con SVG).

Si devuelve 400 diciendo que `html` no se acepta: frenar y avisar a la usuaria; el plan B es la API REST (`/accounts/<id>/browser-run/screenshot`) con un token de API con permiso `Browser Rendering - Edit`, guardado como secret.

- [ ] **Step 3: Borrar el Worker de prueba**

Run: `cd $SCRATCH/mega-spike && npx -y wrangler@4.139.0 delete --force`
Expected: `Successfully deleted mega-spike`.

- [ ] **Step 4: Sumar el binding y la fecha en el repo**

`wrangler.toml`: cambiar `compatibility_date = "2025-04-01"` por `compatibility_date = "2026-10-01"` y agregar al final:

```toml
[browser]
binding = "BROWSER"
```

`src/env.ts`:

```ts
export interface Env {
  DB: D1Database;
  BROWSER: BrowserRun;
  BOT_TOKEN: string;
  WEBHOOK_SECRET: string;
  GROUP_CHAT_ID: string;
}
```

- [ ] **Step 5: Correr los tests y el typecheck**

Run: `npx tsc --noEmit && npx vitest run 2>&1 | grep -E "Tests|FAIL|Error"`
Expected: `Tests  159 passed`.

Si Miniflare falla por la fecha ("compatibility date … is in the future") o por el binding `[browser]`: actualizar `@cloudflare/vitest-pool-workers` a la última versión cuyo `peerDependencies.vitest` acepte la `vitest` instalada (`npm view @cloudflare/vitest-pool-workers@latest peerDependencies`) y volver a correr. Si sigue fallando, frenar y reportar el error exacto antes de pasar a la Task 2: los tests inyectan su propio `BROWSER` (Task 7), así que lo único que tiene que andar es que Miniflare arranque.

- [ ] **Step 6: Commit**

```bash
git add wrangler.toml src/env.ts package.json package-lock.json vitest.config.ts
git commit -m "chore: binding de Browser Rendering para la foto del MEGA matchi matchi"
```

---

### Task 2: Clasificación en el resumen y en /detalle

**Files:**

- Modify: `src/games/types.ts`, `src/games/trivia.ts`, `src/games/index.ts`
- Modify: `src/stats.ts:267-329`
- Modify: `src/summary.ts:52-53`
- Modify: `src/profile.ts:102-109`
- Test: `test/stats.test.ts` (bloque `describe("matchi matchi")`), `test/summary.test.ts:95-106`, `test/profile.test.ts:97-111`, `test/index.test.ts:470`

**Interfaces:**

- Produces:
  - `Game.mega?: false`
  - `hasMega(gameId: string): boolean` en `src/games/index.ts`
  - `twinGroups(valid: StoredResult[], game: string, day: string): { mega: string[][]; common: string[][] }`
  - `twinsToday(valid, userId, day): { name: string; games: { game: string; mega: boolean }[] }[]`
  - `historicTwin` sin cambios de firma.

- [ ] **Step 1: Reemplazar los tests de stats**

Reemplazar todo el bloque `describe("matchi matchi", …)` de `test/stats.test.ts` por:

```ts
describe("matchi matchi", () => {
  let nextMessage = 1000;
  const play = (
    userId: number,
    userName: string,
    game: string,
    day: string,
    display: string,
    pattern: string | null,
    messageId = nextMessage++,
  ) => result({ userId, userName, game, day, display, pattern, messageId });

  const A = "⬜🟨⬜⬜🟨\n🟩🟩🟩🟩🟩";
  const B = "🟨⬜⬜⬜🟨\n🟩🟩🟩🟩🟩";

  it("MEGA es mismo puntaje y misma grilla; común, mismo puntaje", () => {
    const rows = [
      play(1, "Cindy", "boludle", D, "4/6", A),
      play(2, "Rafa", "boludle", D, "4/6", A),
      play(3, "Tomer", "boludle", D, "4/6", B),
      play(4, "Lu", "boludle", D, "5/6", A),
    ];
    expect(twinGroups(rows, "boludle", D)).toEqual({ mega: [["Cindy", "Rafa"]], common: [["Cindy", "Rafa", "Tomer"]] });
  });

  it("un MEGA solo no se repite como común", () => {
    const rows = [play(1, "Cindy", "boludle", D, "4/6", A), play(2, "Rafa", "boludle", D, "4/6", A)];
    expect(twinGroups(rows, "boludle", D)).toEqual({ mega: [["Cindy", "Rafa"]], common: [] });
  });

  it("en la Trivia solo hay común aunque la grilla sea igual", () => {
    const rows = [play(1, "Cindy", "trivia", D, "5/7", "🟩🟩🟥"), play(2, "Rafa", "trivia", D, "5/7", "🟩🟩🟥")];
    expect(twinGroups(rows, "trivia", D)).toEqual({ mega: [], common: [["Cindy", "Rafa"]] });
  });

  it("sin detalle guardado coincidir el puntaje es común", () => {
    const rows = [play(1, "Cindy", "size-it-up", D, "185", ""), play(2, "Rafa", "size-it-up", D, "185", "")];
    expect(twinGroups(rows, "size-it-up", D)).toEqual({ mega: [], common: [["Cindy", "Rafa"]] });
  });

  it("con las mismas rondas Size It Up es MEGA", () => {
    const rounds = "🟥🟥⬜️⬜️⬜️ 43\n🟥🟥🟥🟥⬜️ 74";
    const rows = [play(1, "Cindy", "size-it-up", D, "185", rounds), play(2, "Rafa", "size-it-up", D, "185", rounds)];
    expect(twinGroups(rows, "size-it-up", D).mega).toEqual([["Cindy", "Rafa"]]);
  });

  it("los resultados guardados sin grilla no cuentan", () => {
    const rows = [play(1, "Cindy", "boludle", D, "4/6", null), play(3, "Lu", "boludle", D, "4/6", null)];
    expect(twinGroups(rows, "boludle", D)).toEqual({ mega: [], common: [] });
  });

  it("un ft (mismo mensaje) no es matchi matchi, salvo con alguien de afuera", () => {
    const pair = [play(1, "Rafa", "krillion", D, "255", "🐟🫧", 50), play(2, "WinnaZ", "krillion", D, "255", "🐟🫧", 50)];
    expect(twinGroups(pair, "krillion", D)).toEqual({ mega: [], common: [] });
    expect(twinsToday(pair, 1, D)).toEqual([]);
    expect(historicTwin(pair, 1)).toBeNull();

    const withOutsider = [...pair, play(3, "Tomer", "krillion", D, "255", "🐟🫧", 51)];
    expect(twinGroups(withOutsider, "krillion", D)).toEqual({ mega: [["Rafa", "WinnaZ", "Tomer"]], common: [] });
    expect(twinsToday(withOutsider, 1, D)).toEqual([{ name: "Tomer", games: [{ game: "krillion", mega: true }] }]);
  });

  it("hoy lista con quién y en qué juegos, marcando los MEGA; el histórico cuenta los dos", () => {
    const rows = [
      play(1, "Cindy", "boludle", D, "4/6", A),
      play(2, "Rafa", "boludle", D, "4/6", A),
      play(1, "Cindy", "trivia", D, "5/7", "🟩🟩🟥"),
      play(2, "Rafa", "trivia", D, "5/7", "🟩🟥🟩"),
      play(1, "Cindy", "trivia", "2026-09-23", "3/7", "🟩🟥🟥"),
      play(3, "Lu", "trivia", "2026-09-23", "3/7", "🟥🟩🟥"),
    ];
    expect(twinsToday(rows, 1, D)).toEqual([
      { name: "Rafa", games: [{ game: "boludle", mega: true }, { game: "trivia", mega: false }] },
    ]);
    expect(historicTwin(rows, 1)).toEqual({ names: ["Rafa"], times: 2 });
    expect(historicTwin(rows, 3)).toEqual({ names: ["Cindy"], times: 1 });
    expect(historicTwin(rows, 5)).toBeNull();
  });
});
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `npx vitest run test/stats.test.ts 2>&1 | grep -E "Tests|FAIL"`
Expected: FAIL en los tests de `matchi matchi` (hoy `twinGroups` devuelve un array).

- [ ] **Step 3: `mega` en los juegos**

`src/games/types.ts`, dentro de `interface Game`, después de `grid?: false;`:

```ts
  // false = nunca hay MEGA matchi matchi (en la Trivia coincidir en la grilla es fácil).
  mega?: false;
```

`src/games/trivia.ts`: agregar `mega: false,` después de `direction`.

`src/games/index.ts`, después de `gameByCommand`:

```ts
export function hasMega(gameId: string): boolean {
  return GAMES.find((game) => game.id === gameId)?.mega !== false;
}
```

- [ ] **Step 4: Reescribir la clasificación en `src/stats.ts`**

Agregar `import { hasMega } from "./games";` arriba. Reemplazar desde el comentario `// Clave para comparar resultados idénticos` hasta el final de `historicTwin` por:

```ts
// Matchi matchi: el mismo resultado. null = guardado antes de que existiera la grilla: no se compara.
function matchKey(row: StoredResult): string | null {
  return row.pattern === null ? null : row.display;
}

// MEGA: además el mismo detalle (grilla o rondas), en los juegos que lo admiten.
function megaKey(row: StoredResult): string | null {
  if (row.pattern === null || row.pattern === "" || !hasMega(row.game)) return null;
  return `${row.pattern}=${row.display}`;
}

function latestNames(valid: StoredResult[]): Map<number, string> {
  const names = new Map<number, { name: string; at: number }>();
  for (const row of valid) {
    const current = names.get(row.userId);
    if (!current || row.createdAt >= current.at) names.set(row.userId, { name: row.userName, at: row.createdAt });
  }
  return new Map([...names].map(([userId, { name }]) => [userId, name]));
}

// Grupos con la misma clave. Un ft solo (todos del mismo mensaje) no cuenta: hace falta otro mensaje.
function groupsBy(rows: StoredResult[], key: (row: StoredResult) => string | null): StoredResult[][] {
  const groups = new Map<string, StoredResult[]>();
  for (const row of rows) {
    const value = key(row);
    if (value !== null) groups.set(value, [...(groups.get(value) ?? []), row]);
  }
  return [...groups.values()].filter((group) => new Set(group.map((row) => row.messageId)).size > 1);
}

// Quienes coincidieron en un juego un día. Un común que es exactamente un MEGA se muestra solo como MEGA.
export function twinGroups(valid: StoredResult[], game: string, day: string): { mega: string[][]; common: string[][] } {
  const names = latestNames(valid);
  const rows = valid.filter((row) => row.game === game && row.day === day);
  const toNames = (group: StoredResult[]) => group.map((row) => names.get(row.userId)!);
  const allMega = (group: StoredResult[]) => {
    const key = megaKey(group[0]);
    return key !== null && group.every((row) => megaKey(row) === key);
  };
  return {
    mega: groupsBy(rows, megaKey).map(toNames),
    common: groupsBy(rows, matchKey).filter((group) => !allMega(group)).map(toNames),
  };
}

// Con quién coincidió cada resultado de una persona, y si fue MEGA.
function coincidences(valid: StoredResult[], userId: number, day?: string): { userId: number; game: string; mega: boolean }[] {
  const found: { userId: number; game: string; mega: boolean }[] = [];
  for (const mine of valid) {
    if (mine.userId !== userId || (day !== undefined && mine.day !== day)) continue;
    const key = matchKey(mine);
    if (key === null) continue;
    const mega = megaKey(mine);
    for (const other of valid) {
      if (
        other.userId !== userId &&
        other.messageId !== mine.messageId &&
        other.game === mine.game &&
        other.day === mine.day &&
        matchKey(other) === key
      ) {
        found.push({ userId: other.userId, game: mine.game, mega: mega !== null && megaKey(other) === mega });
      }
    }
  }
  return found;
}

export function twinsToday(
  valid: StoredResult[],
  userId: number,
  day: string,
): { name: string; games: { game: string; mega: boolean }[] }[] {
  const names = latestNames(valid);
  const byUser = new Map<number, { game: string; mega: boolean }[]>();
  for (const { userId: other, game, mega } of coincidences(valid, userId, day)) {
    byUser.set(other, [...(byUser.get(other) ?? []), { game, mega }]);
  }
  return [...byUser]
    .map(([other, games]) => ({ name: names.get(other)!, games }))
    .sort((a, b) => b.games.length - a.games.length);
}

export function historicTwin(valid: StoredResult[], userId: number): { names: string[]; times: number } | null {
  const names = latestNames(valid);
  const counts = new Map<number, number>();
  for (const { userId: other } of coincidences(valid, userId)) counts.set(other, (counts.get(other) ?? 0) + 1);
  const most = Math.max(0, ...counts.values());
  if (most === 0) return null;
  return { names: [...counts].filter(([, times]) => times === most).map(([other]) => names.get(other)!), times: most };
}
```

`src/games/index.ts` solo importa los módulos de cada juego, así que importarlo desde `stats.ts` no arma un ciclo.

- [ ] **Step 5: Correr los tests de stats**

Run: `npx vitest run test/stats.test.ts 2>&1 | grep -E "Tests|FAIL"`
Expected: PASS.

- [ ] **Step 6: Tests de resumen, perfil e index con el formato nuevo**

En `test/summary.test.ts`, reemplazar el test `"muestra los matchi matchi de cada juego"` por:

```ts
  it("muestra los MEGA y los matchi matchi de cada juego", () => {
    const boludle = (userId: number, userName: string, display: string, pattern: string) =>
      result({ userId, userName, game: "boludle", day: D, display, pattern });
    const rows = [
      boludle(1, "Cindy", "4/6", "🟩🟩🟥"),
      boludle(2, "Rafa", "4/6", "🟩🟩🟥"),
      boludle(3, "Lu", "4/6", "🟩🟥🟩"),
      boludle(4, "Juan", "5/6", "🟩🟥🟩"),
    ];
    const summary = buildSummary(rows, D)!;
    expect(summary).toContain("   💖 MEGA matchi matchi: Cindy y Rafa\n   👯 Matchi matchi: Cindy, Rafa y Lu");
  });
```

En `test/profile.test.ts`, en `"muestra el matchi matchi de hoy y el histórico"`, cambiar la última expectativa por:

```ts
    expect(text).toContain("👯 Matchi matchi de hoy: Rafa (🎓 La Trivia del Día, 📐 Size It Up)");
```

(se mantiene: la Trivia no es MEGA y Size It Up con `pattern = ""` tampoco), y agregar un test:

```ts
  it("marca con 💖 los MEGA de hoy", () => {
    const grid = "⬜🟨⬜⬜🟨";
    const rows = [
      result({ userId: 1, userName: "Cindy", game: "boludle", day: D, display: "4/6", pattern: grid }),
      result({ userId: 2, userName: "Rafa", game: "boludle", day: D, display: "4/6", pattern: grid }),
    ];
    expect(buildProfile(rows, cindy, D, true)).toContain("👯 Matchi matchi de hoy: Rafa (🧉 Boludle 💖)");
  });
```

En `test/index.test.ts:470`, cambiar `"Matchi matchi (Twinning): Cindy y Rafa"` por `"matchi matchi: Cindy y Rafa"` (cubre las dos líneas, MEGA y común).

- [ ] **Step 7: Resumen y perfil**

`src/summary.ts`, reemplazar las dos líneas de `twins` por:

```ts
    const twins = twinGroups(valid, game.id, day);
    if (twins.mega.length > 0) lines.push(`   💖 MEGA matchi matchi: ${twins.mega.map(joinNames).join(" · ")}`);
    if (twins.common.length > 0) lines.push(`   👯 Matchi matchi: ${twins.common.map(joinNames).join(" · ")}`);
```

`src/profile.ts`, en el bloque de `twinsToday`:

```ts
  const twins = twinsToday(valid, player.userId, day);
  if (twins.length > 0) {
    const label = ({ game: id, mega }: { game: string; mega: boolean }) => {
      const game = GAMES.find((g) => g.id === id)!;
      return `${game.emoji} ${game.name}${mega ? " 💖" : ""}`;
    };
    lines.push(`👯 Matchi matchi de hoy: ${twins.map((t) => `${t.name} (${t.games.map(label).join(", ")})`).join(" · ")}`);
  }
```

- [ ] **Step 8: Correr todo**

Run: `npx tsc --noEmit && npx vitest run 2>&1 | grep -E "Tests|FAIL"`
Expected: todos pasan.

- [ ] **Step 9: Commit**

```bash
git add src/games src/stats.ts src/summary.ts src/profile.ts test
git commit -m "feat: separar MEGA matchi matchi del matchi matchi común en el resumen y /detalle"
```

---

### Task 3: Rondas de Size It Up y MapTap como detalle

**Files:**

- Modify: `src/games/sizeItUp.ts`, `src/games/maptap.ts`, `src/games/index.ts` (`parseResults`), `src/games/types.ts` (comentario de `pattern`)
- Test: `test/fixtures/games.ts`, `test/games.test.ts`

**Interfaces:**

- Consumes: `ParsedResult.pattern?: string`.
- Produces: si un parser devuelve `pattern`, `parseResults` lo respeta.

- [ ] **Step 1: Fixtures con las rondas esperadas**

En `test/fixtures/games.ts`, al fixture de `size-it-up` cambiarle `expected` por:

```ts
    expected: {
      puzzle: null,
      score: 185,
      display: "185",
      pattern: "🟥🟥⬜️⬜️⬜️ 43\n🟥🟥🟥🟥⬜️ 74\n🟥🟥⬜️⬜️⬜️ 30\n🟥🟥⬜️⬜️⬜️ 30\n⬜️⬜️⬜️⬜️⬜️ 8",
    },
```

y al de `maptap`:

```ts
    expected: { puzzle: "09-29", score: 873, display: "873", pattern: "87🎓 92🏆 92🏆 82🌟 88🎉" },
```

Los fixtures pasan por `parseResults` en `test/games.test.ts` (`single`), así que el `pattern` final se verifica ahí.

- [ ] **Step 2: Correr y ver que fallan**

Run: `npx vitest run test/games.test.ts 2>&1 | grep -E "Tests|FAIL"`
Expected: FAIL en `size-it-up 185` y `maptap 873` (pattern `""`).

- [ ] **Step 3: Parsers**

`src/games/sizeItUp.ts`:

```ts
import type { Game } from "./types";

const SCORE = /^\s*Size It Up\s*\n\s*Overall Score\s*:?\s*(\d+)/im;
// Cada ronda: los cuadraditos y su puntaje ("🟥🟥⬜️⬜️⬜️ 43"). Son el detalle del MEGA matchi matchi.
const ROUND = /^[^\p{L}\p{N}\s]+\s+\d+$/u;

export const sizeItUp: Game = {
  id: "size-it-up",
  name: "Size It Up",
  emoji: "📐",
  url: "https://magnitudle.com/size-it-up",
  direction: "higher",
  parse(text) {
    const score = text.match(SCORE);
    if (!score) return null;
    const lines = text
      .slice((score.index ?? 0) + score[0].length)
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "");
    const end = lines.findIndex((line) => !ROUND.test(line));
    const pattern = (end === -1 ? lines : lines.slice(0, end)).join("\n");
    return { puzzle: null, score: Number(score[1]), display: score[1], pattern };
  },
};
```

`src/games/maptap.ts`, en `parse`, antes del `return`:

```ts
    // "87🎓 92🏆 92🏆 82🌟 88🎉": el puntaje de cada ronda, el detalle del MEGA matchi matchi.
    const pattern = match[0].split("\n").map((line) => line.trim()).find((line) => ROUNDS.test(line)) ?? "";
    return { puzzle, score: Number(score), display: score, pattern };
```

y arriba, junto a `RESULT`:

```ts
const ROUNDS = /^(?:\d+[^\s\d]+\s*)+$/u;
```

- [ ] **Step 4: `parseResults` respeta el detalle del parser**

En `src/games/index.ts`, dentro de `parseResults`, reemplazar el cálculo de `pattern` por:

```ts
    const grid = () =>
      lines
        .slice(starts[i], end)
        .map((line) => line.trim())
        .filter((line) => GRID_LINE.test(line))
        .join("\n");
    const pattern = match.result.pattern ?? (match.game.grid === false ? "" : grid());
```

En `src/games/types.ts`, el comentario de `pattern` pasa a:

```ts
  // Detalle del resultado: la grilla de emojis o, si el parser lo da, las rondas (Size It Up, MapTap).
  // "" si no trae. Si el parser no lo da, lo completa parseResults con la grilla.
```

- [ ] **Step 5: Correr todo**

Run: `npx tsc --noEmit && npx vitest run 2>&1 | grep -E "Tests|FAIL"`
Expected: todos pasan (incluido `"lee varios resultados en un mismo mensaje"`).

- [ ] **Step 6: Commit**

```bash
git add src/games test/fixtures/games.ts
git commit -m "feat: las rondas de Size It Up y MapTap cuentan para el MEGA matchi matchi"
```

---

### Task 4: Aviso en vivo: MEGA o común

El MEGA se anuncia por ahora con el epígrafe como texto; la Task 7 lo cambia por la foto. El aviso corre en `ctx.waitUntil`.

**Files:**

- Create: `src/announce.ts`
- Modify: `src/store.ts` (`findTwins`), `src/index.ts`
- Test: `test/store.test.ts`, `test/index.test.ts`

**Interfaces:**

- Consumes: `hasMega` (Task 2).
- Produces:
  - `interface Twin { userId: number; userName: string; mega: boolean }` y `findTwins(db, result: NewResult): Promise<Twin[]>` en `src/store.ts`.
  - `interface MegaPerson { userId: number; name: string }`, `megaCaption(game: Game, people: MegaPerson[]): string` y `announceMega(env: Env, chatId: number, game: Game, people: MegaPerson[]): Promise<void>` en `src/announce.ts`.
  - `shareResult` en `src/index.ts` devuelve `Player[]` (los compañeros guardados).

- [ ] **Step 1: Tests de `findTwins`**

En `test/store.test.ts`, reemplazar los tests `"encuentra a quienes tienen el mismo resultado en el mismo puzzle"`, `"con la misma grilla pero distinto puntaje no es matchi matchi"`, `"sin grilla compara el puntaje exacto"` y `"los del mismo ft (mismo mensaje) no son matchi matchi"` por:

```ts
  it("encuentra a quienes tienen el mismo puntaje y marca los MEGA", async () => {
    const boludle = { ...base, puzzle: "1683", display: "4/6", pattern: "🟩🟩🟥" };
    await saveResult(env.DB, { ...boludle, messageId: 1, userId: 1, userName: "Cindy" });
    await saveResult(env.DB, { ...boludle, messageId: 2, userId: 2, userName: "Rafa", pattern: "🟩🟥🟩" });
    await saveResult(env.DB, { ...boludle, messageId: 3, userId: 3, userName: "Lu", display: "5/6" });
    await saveResult(env.DB, { ...boludle, messageId: 4, userId: 4, userName: "Viejo", pattern: null });
    await saveResult(env.DB, { ...boludle, messageId: 5, userId: 5, userName: "Otro día", puzzle: "1682" });
    expect(await findTwins(env.DB, { ...boludle, messageId: 6, userId: 6 })).toEqual([
      { userId: 1, userName: "Cindy", mega: true },
      { userId: 2, userName: "Rafa", mega: false },
    ]);
  });

  it("en la Trivia y sin detalle nunca es MEGA", async () => {
    const trivia = { ...base, game: "trivia", puzzle: "2026-09-24", display: "2/3", pattern: "🟩🟩🟥" };
    await saveResult(env.DB, { ...trivia, messageId: 1, userId: 1, userName: "Cindy" });
    expect(await findTwins(env.DB, { ...trivia, messageId: 2, userId: 2 })).toEqual([{ userId: 1, userName: "Cindy", mega: false }]);

    const size = { ...base, game: "size-it-up", puzzle: "2026-09-24", display: "185", pattern: "" };
    await saveResult(env.DB, { ...size, messageId: 3, userId: 1, userName: "Cindy" });
    expect(await findTwins(env.DB, { ...size, messageId: 4, userId: 2 })).toEqual([{ userId: 1, userName: "Cindy", mega: false }]);
  });

  it("los del mismo ft (mismo mensaje) no son matchi matchi", async () => {
    const boludle = { ...base, display: "4/6", pattern: "🟩🟩🟥" };
    await saveResult(env.DB, { ...boludle, userId: 1, userName: "Cindy" });
    expect(await findTwins(env.DB, { ...boludle, userId: 2 })).toEqual([]);
  });
```

- [ ] **Step 2: Tests del webhook**

En `test/index.test.ts`:

1. Cambiar el import de `cloudflare:test` por `import { createExecutionContext, createScheduledController, env, waitOnExecutionContext } from "cloudflare:test";` y `post` por:

```ts
// Los avisos que tardan (la foto del MEGA) corren en ctx.waitUntil: se espera a que terminen.
async function post(update: TelegramUpdate, secret = "test-secret") {
  const ctx = createExecutionContext();
  const response = await worker.fetch(
    new IncomingRequest("https://bot.test/webhook", {
      method: "POST",
      headers: { "X-Telegram-Bot-Api-Secret-Token": secret, "content-type": "application/json" },
      body: JSON.stringify(update),
    }),
    testEnv,
    ctx,
  );
  await waitOnExecutionContext(ctx);
  return response;
}
```

2. Reemplazar el bloque `describe("aviso de matchi matchi", …)` por:

```ts
describe("aviso de matchi matchi", () => {
  const rafa = { id: 2, is_bot: false, first_name: "Rafa" };
  const juan = { id: 3, is_bot: false, first_name: "Juan" };
  const otraGrilla = boludle.replace("⬜🟨⬜⬜🟨", "🟨⬜⬜⬜🟨");

  it("misma grilla y mismo puntaje es MEGA", async () => {
    await post({ update_id: 1, message: message() });
    expect(sent()).toEqual([]);
    await post({ update_id: 2, message: message({ message_id: 2, from: rafa }) });
    expect(sentTexts()).toEqual(["💖 ¡MEGA MATCHI MATCHI de Cindy y Rafa en 🧉 Boludle!"]);
  });

  it("mismo puntaje con otra grilla es matchi matchi común", async () => {
    await post({ update_id: 1, message: message() });
    await post({ update_id: 2, message: message({ message_id: 2, from: rafa, text: otraGrilla }) });
    expect(sentTexts()).toEqual(["👯 ¡Cindy y Rafa hicieron matchi matchi en 🧉 Boludle!"]);
  });

  it("si se suma alguien vuelve a avisar con los del MEGA", async () => {
    await post({ update_id: 1, message: message() });
    await post({ update_id: 2, message: message({ message_id: 2, from: rafa, text: otraGrilla }) });
    await post({ update_id: 3, message: message({ message_id: 3, from: juan }) });
    expect(sentTexts().at(-1)).toBe("💖 ¡MEGA MATCHI MATCHI de Cindy y Juan en 🧉 Boludle!");
  });

  it("no avisa si el puntaje es distinto ni si reenvían el mismo resultado", async () => {
    const otroPuntaje = boludle.replace("#1683 4/6", "#1683 5/6");
    await post({ update_id: 1, message: message() });
    await post({ update_id: 2, message: message({ message_id: 2, from: rafa, text: otroPuntaje }) });
    await post({ update_id: 3, message: message({ message_id: 3 }) });
    expect(sent()).toEqual([]);
  });
});
```

3. En `describe("ft")`, el último test pasa a esperar:

```ts
    expect(sentTexts().at(-1)).toBe("💖 ¡MEGA MATCHI MATCHI de Cindy, Rafa y Tomer en 🧉 Boludle!");
```

- [ ] **Step 3: Correr y ver que fallan**

Run: `npx vitest run test/store.test.ts test/index.test.ts 2>&1 | grep -E "Tests|FAIL"`
Expected: FAIL en los tests nuevos.

- [ ] **Step 4: `findTwins` con el nivel**

En `src/store.ts`, agregar `import { hasMega } from "./games";` y reemplazar `findTwins`:

```ts
export interface Twin {
  userId: number;
  userName: string;
  mega: boolean;
}

// Quienes ya mandaron el mismo puntaje en el mismo puzzle y día; MEGA si además coincide el detalle.
// Los del mismo ft (mismo mensaje) no cuentan.
export async function findTwins(db: D1Database, result: NewResult): Promise<Twin[]> {
  if (result.pattern === null) return [];
  const { results } = await db
    .prepare(
      `SELECT user_id, user_name, pattern FROM results
       WHERE chat_id = ? AND game = ? AND puzzle = ? AND day = ? AND user_id <> ? AND message_id <> ?
         AND display = ? AND pattern IS NOT NULL
       ORDER BY created_at, id`,
    )
    .bind(result.chatId, result.game, result.puzzle, result.day, result.userId, result.messageId, result.display)
    .all<{ user_id: number; user_name: string; pattern: string }>();
  const megaPossible = result.pattern !== "" && hasMega(result.game);
  return results.map((row) => ({
    userId: row.user_id,
    userName: row.user_name,
    mega: megaPossible && row.pattern === result.pattern,
  }));
}
```

- [ ] **Step 5: `src/announce.ts`**

```ts
import type { Env } from "./env";
import type { Game } from "./games/types";
import { joinNames } from "./summary";
import { sendMessage } from "./telegram";

export interface MegaPerson {
  userId: number;
  name: string;
}

export function megaCaption(game: Game, people: MegaPerson[]): string {
  return `💖 ¡MEGA MATCHI MATCHI de ${joinNames(people.map((person) => person.name))} en ${game.emoji} ${game.name}!`;
}

export async function announceMega(env: Env, chatId: number, game: Game, people: MegaPerson[]): Promise<void> {
  await sendMessage(env.BOT_TOKEN, chatId, megaCaption(game, people));
}
```

- [ ] **Step 6: `src/index.ts`**

1. Imports: `import { announceMega, type MegaPerson } from "./announce";` y `type Player` desde `./profile` (`import { buildProfile, findPlayers, playerById, type Player } from "./profile";`).
2. `type Defer = (task: Promise<void>) => void;` arriba de `handleUpdate`; `handleUpdate(update, env, defer: Defer)` y en `fetch`: `async fetch(request, env, ctx)` con `await handleUpdate(await request.json<TelegramUpdate>(), env, (task) => ctx.waitUntil(task));`.
3. `saveResults(env, message, from, matches, defer)`; la llamada desde `handleUpdate` le pasa `defer`.
4. `shareResult` devuelve los guardados:

```ts
async function shareResult(env: Env, result: NewResult, partners: Player[]): Promise<Player[]> {
  const shared: Player[] = [];
  for (const partner of partners) {
    if (await saveResult(env.DB, { ...result, userId: partner.userId, userName: partner.name })) shared.push(partner);
  }
  return shared;
}
```

`sharedNote(shared.map((player) => player.name), game)` en los dos lugares que lo llaman.

5. En `saveResults`, reemplazar el bloque de `twins` por:

```ts
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
```

- [ ] **Step 7: Correr todo**

Run: `npx tsc --noEmit && npx vitest run 2>&1 | grep -E "Tests|FAIL"`
Expected: todos pasan.

- [ ] **Step 8: Commit**

```bash
git add src/announce.ts src/store.ts src/index.ts test/store.test.ts test/index.test.ts
git commit -m "feat: avisar MEGA matchi matchi aparte del matchi matchi común"
```

---

### Task 5: El HTML de la foto

**Files:**

- Create: `src/assets/foca.ts` (generado), `src/mega.ts`
- Test: `test/mega.test.ts`

**Interfaces:**

- Produces:
  - `FOCA: string` (data URI JPEG) en `src/assets/foca.ts`.
  - `interface MegaFace { name: string; photo: string | null }`, `MAX_FACES = 6`, `megaHtml(faces: MegaFace[]): string` en `src/mega.ts`.

- [ ] **Step 1: Generar la foca embebida**

La foca recortada (sin el "cream blush") está en `.mega-prototype/foca.jpg`.

```bash
printf '// La foca de los MEGA matchi matchi (recortada, sin el texto de la foto original).\nexport const FOCA =\n  "data:image/jpeg;base64,%s";\n' "$(base64 -i .mega-prototype/foca.jpg | tr -d '\n')" > src/assets/foca.ts
head -c 200 src/assets/foca.ts
```

Expected: el comentario, `export const FOCA =` y el comienzo `"data:image/jpeg;base64,/9j/`.

- [ ] **Step 2: Tests del HTML**

`test/mega.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { FOCA } from "../src/assets/foca";
import { megaHtml } from "../src/mega";

const photo = (n: number) => `data:image/jpeg;base64,FOTO${n}`;
const stripes = (html: string) => html.match(/class="half[ "]/g)?.length ?? 0;

describe("megaHtml", () => {
  it("una franja por persona, con su foto", () => {
    const html = megaHtml([{ name: "Rafa", photo: photo(1) }, { name: "WinnaZ", photo: photo(2) }]);
    expect(stripes(html)).toBe(2);
    expect(html).toContain(`url('${photo(1)}')`);
    expect(html).toContain(`url('${photo(2)}')`);
  });

  it("sin foto va la inicial, cada una con su color", () => {
    const html = megaHtml([{ name: "WinnaZ", photo: null }, { name: "Tomer", photo: null }]);
    const colors = [...html.matchAll(/class="half initial" style="background:(#[0-9a-f]{6})/g)].map((m) => m[1]);
    expect(colors).toHaveLength(2);
    expect(new Set(colors).size).toBe(2);
    expect(html).toMatch(/>W<\/div>/);
    expect(html).toMatch(/>T<\/div>/);
  });

  it("la inicial es la primera letra, escapada", () => {
    expect(megaHtml([{ name: "🦊 zorro", photo: null }])).toMatch(/>Z<\/div>/);
    expect(megaHtml([{ name: "<b>", photo: null }])).toMatch(/>B<\/div>/);
    expect(megaHtml([{ name: "🦊", photo: null }])).toMatch(/>\?<\/div>/);
  });

  it("a lo sumo 6 franjas", () => {
    const seven = Array.from({ length: 7 }, (_, i) => ({ name: `P${i}`, photo: photo(i) }));
    expect(stripes(megaHtml(seven))).toBe(6);
  });

  it("ocho focas, las tipografías y ningún emoji (el Chrome remoto puede no tener fuente de emojis)", () => {
    const html = megaHtml([{ name: "Rafa", photo: photo(1) }]);
    expect(html.split(FOCA).length - 1).toBe(8);
    expect(html).toContain("family=Bungee&family=Lobster");
    expect(html).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
```

- [ ] **Step 3: Correr y ver que fallan**

Run: `npx vitest run test/mega.test.ts 2>&1 | grep -E "Tests|FAIL|Error"`
Expected: FAIL (`src/mega` no existe).

- [ ] **Step 4: `src/mega.ts`**

```ts
import { FOCA } from "./assets/foca";

export interface MegaFace {
  name: string;
  // data: URI de la foto, o null para usar la inicial.
  photo: string | null;
}

export const MAX_FACES = 6;

const INITIAL_COLORS = ["#e8457f", "#9b5de5", "#f15bb5", "#00a6a6", "#f77f00", "#3a86ff"];
const INITIAL_SIZES = [300, 300, 300, 150, 120, 100, 90];

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

function initial(name: string): string {
  const letter = [...name].find((char) => /[\p{L}\p{N}]/u.test(char));
  return escapeHtml(letter ? letter.toUpperCase() : "?");
}

function stripe(face: MegaFace, index: number, count: number): string {
  if (face.photo) return `<div class="half" style="background-image:url('${face.photo}')"></div>`;
  const color = INITIAL_COLORS[index % INITIAL_COLORS.length];
  return `<div class="half initial" style="background:${color};font-size:${INITIAL_SIZES[count]}px">${initial(face.name)}</div>`;
}

// Adornos dibujados con SVG: el Chrome de Cloudflare puede no tener fuente de emojis.
const HEART =
  '<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>';
const SPARKLE = '<path d="M12 0l2.6 9.4L24 12l-9.4 2.6L12 24l-2.6-9.4L0 12l9.4-2.6z"/>';
const DECORATIONS: [string, string, string, number][] = [
  [SPARKLE, "#ffd700", "left:60px;top:40px", 46],
  [SPARKLE, "#ffd700", "right:60px;top:60px", 46],
  [HEART, "#ff3d9a", "right:260px;top:290px", 46],
  [HEART, "#ff7ac4", "left:190px;top:700px", 34],
  [HEART, "#ff3d9a", "left:400px;bottom:40px", 38],
  [SPARKLE, "#ffd700", "right:120px;bottom:30px", 34],
  [SPARKLE, "#fff6c2", "right:200px;top:700px", 30],
];

const decorations = DECORATIONS.map(
  ([shape, color, position, size]) =>
    `<svg class="deco" style="${position}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}">${shape}</svg>`,
).join("");

const seals = Array.from({ length: 8 }, (_, i) => `<img class="seal s${i + 1}" src="${FOCA}">`).join("");

const STYLE = `
*{margin:0;box-sizing:border-box}
body{width:1080px;height:1080px;overflow:hidden;position:relative;font-family:'Lobster',cursive;
 background:radial-gradient(circle at 50% 55%,#fff0f6 0,#ffc8de 45%,#ff9cc4 100%)}
.sparkles{position:absolute;inset:0;background-image:
 radial-gradient(circle,#fff 0 2px,transparent 3px),radial-gradient(circle,#ffd86b 0 2px,transparent 3px),radial-gradient(circle,#fff 0 1px,transparent 2px);
 background-size:97px 89px,131px 113px,53px 61px;background-position:0 0,40px 70px,20px 10px;opacity:.9}
.title{position:absolute;top:18px;width:100%;text-align:center;line-height:1;font-size:132px}
.title span{display:block;
 background:
  radial-gradient(circle at 20% 30%,#fff 0 1.5px,transparent 2.5px) 0 0/23px 19px,
  radial-gradient(circle at 70% 60%,#fff6c2 0 1.5px,transparent 2.5px) 0 0/31px 27px,
  radial-gradient(circle at 40% 80%,#ffffff 0 1px,transparent 2px) 0 0/13px 11px,
  linear-gradient(100deg,#ff3d9a 0%,#ffd700 22%,#fff 32%,#ff7ac4 45%,#c0c0ff 58%,#ffd700 72%,#ff3d9a 100%);
 -webkit-background-clip:text;background-clip:text;color:transparent;
 -webkit-text-stroke:3px #b8005c;filter:drop-shadow(0 0 10px #fff) drop-shadow(0 6px 0 #8a0045) drop-shadow(0 0 30px #ff5fae)}
.title .mega{font-family:'Bungee',sans-serif;font-size:118px;letter-spacing:6px;margin-bottom:-4px}
.heart{position:absolute;left:50%;top:650px;width:640px;height:580px;transform:translate(-50%,-50%);display:flex;background:#ff4f9b;
 clip-path:path('M320 560 C 120 420, 0 300, 0 170 C 0 70, 80 0, 175 0 C 240 0, 295 35, 320 90 C 345 35, 400 0, 465 0 C 560 0, 640 70, 640 170 C 640 300, 520 420, 320 560 Z')}
.heart-glow{position:absolute;left:50%;top:650px;width:680px;height:620px;transform:translate(-50%,-50%);background:#fff;opacity:.85;
 clip-path:path('M340 600 C 128 450, 0 322, 0 182 C 0 75, 85 0, 186 0 C 255 0, 313 37, 340 96 C 367 37, 425 0, 494 0 C 595 0, 680 75, 680 182 C 680 322, 552 450, 340 600 Z')}
.half{flex:1;background-size:cover;background-position:center}
.half+.half{border-left:6px solid #fff}
.initial{display:flex;align-items:center;justify-content:center;color:#fff;font-family:Arial,sans-serif;font-weight:700}
.seal{position:absolute;object-fit:cover;border-radius:50%;border:7px solid #fff;box-shadow:0 0 0 4px #ff7ac4,0 8px 20px rgba(120,0,50,.35)}
.s1{width:150px;height:150px;left:22px;top:262px;transform:rotate(-14deg)}
.s2{width:215px;height:215px;left:6px;top:430px;transform:rotate(8deg) scaleX(-1)}
.s3{width:260px;height:260px;left:30px;bottom:18px;transform:rotate(-6deg)}
.s4{width:225px;height:225px;right:18px;top:268px;transform:rotate(12deg) scaleX(-1)}
.s5{width:150px;height:150px;right:44px;top:515px;transform:rotate(-10deg)}
.s6{width:200px;height:200px;right:10px;bottom:118px;transform:rotate(5deg)}
.s7{width:140px;height:140px;left:610px;bottom:10px;transform:rotate(15deg) scaleX(-1)}
.s8{width:95px;height:95px;left:250px;top:250px;transform:rotate(-20deg)}
.deco{position:absolute}`;

// La foto del MEGA matchi matchi: el diseño aprobado el 2026-10-09 (v8).
export function megaHtml(faces: MegaFace[]): string {
  const shown = faces.slice(0, MAX_FACES);
  const heart = shown.map((face, i) => stripe(face, i, shown.length)).join("");
  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Bungee&family=Lobster&display=swap" rel="stylesheet">
<style>${STYLE}</style></head><body>
<div class="sparkles"></div>
<div class="title"><span class="mega">MEGA</span><span>Matchi Matchi</span></div>
<div class="heart-glow"></div><div class="heart">${heart}</div>
${seals}${decorations}
</body></html>`;
}
```

- [ ] **Step 5: Correr los tests**

Run: `npx tsc --noEmit && npx vitest run test/mega.test.ts 2>&1 | grep -E "Tests|FAIL"`
Expected: PASS.

- [ ] **Step 6: Mirar la imagen con Chrome local**

Script de un solo uso, `$SCRATCH/tools/preview.ts`:

```ts
import { readFileSync, writeFileSync } from "node:fs";
import { megaHtml } from "/Users/clevi/Documents/telegram-bot/src/mega";

const [rafa, out] = process.argv.slice(2);
const photo = `data:image/jpeg;base64,${readFileSync(rafa).toString("base64")}`;
writeFileSync(out, megaHtml([{ name: "Rafa", photo }, { name: "WinnaZ", photo: null }]));
```

Run: `npx -y tsx $SCRATCH/tools/preview.ts .mega-prototype/rafa.jpg .mega-prototype/final.html`, y capturar con `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --window-size=1080,1080 --virtual-time-budget=5000 --user-data-dir=.mega-prototype/chrome-profile --screenshot=.mega-prototype/final.png file://$PWD/.mega-prototype/final.html` (cortar el proceso con `pkill -f chrome-profile` cuando aparezca el archivo). Comparar con `v8.png` con Read: misma composición, con corazones y destellos SVG en lugar de emojis.

- [ ] **Step 7: Commit**

```bash
git add src/assets/foca.ts src/mega.ts test/mega.test.ts
git commit -m "feat: HTML de la foto del MEGA matchi matchi"
```

---

### Task 6: /mifoto

**Files:**

- Create: `migrations/0004_user_photos.sql`, `src/photoStore.ts`
- Modify: `src/telegram.ts` (tipos), `src/index.ts`
- Test: `test/photoStore.test.ts`, `test/index.test.ts`

**Interfaces:**

- Produces (en `src/photoStore.ts`):
  - `chosenPhoto(db: D1Database, userId: number): Promise<string | null>`
  - `choosePhoto(db: D1Database, userId: number, fileId: string, now: number): Promise<void>`
  - `forgetPhoto(db: D1Database, userId: number): Promise<void>`
  - `requestPhoto(db: D1Database, userId: number, now: number): Promise<void>`
  - `takePhotoRequest(db: D1Database, userId: number, since: number): Promise<boolean>`
- `TelegramMessage` suma `photo?: { file_id: string; width: number; height: number }[]`, `caption?: string`, `document?: { file_id: string; mime_type?: string }`.

- [ ] **Step 1: Migración**

`migrations/0004_user_photos.sql`:

```sql
CREATE TABLE user_photos (
  user_id    INTEGER PRIMARY KEY,
  file_id    TEXT    NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE photo_requests (
  user_id      INTEGER PRIMARY KEY,
  requested_at INTEGER NOT NULL
);
```

- [ ] **Step 2: Tests del store**

`test/photoStore.test.ts`:

```ts
import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { choosePhoto, chosenPhoto, forgetPhoto, requestPhoto, takePhotoRequest } from "../src/photoStore";

describe("photoStore", () => {
  it("guarda, reemplaza y borra la foto elegida", async () => {
    expect(await chosenPhoto(env.DB, 1)).toBeNull();
    await choosePhoto(env.DB, 1, "foto-a", 100);
    await choosePhoto(env.DB, 1, "foto-b", 200);
    expect(await chosenPhoto(env.DB, 1)).toBe("foto-b");
    await forgetPhoto(env.DB, 1);
    expect(await chosenPhoto(env.DB, 1)).toBeNull();
  });

  it("el pedido de /mifoto vale una vez y solo si es reciente", async () => {
    await requestPhoto(env.DB, 1, 1000);
    expect(await takePhotoRequest(env.DB, 1, 1001)).toBe(false);
    await requestPhoto(env.DB, 1, 1000);
    expect(await takePhotoRequest(env.DB, 1, 900)).toBe(true);
    expect(await takePhotoRequest(env.DB, 1, 900)).toBe(false);
  });
});
```

- [ ] **Step 3: Tests del comando**

En `test/index.test.ts`, agregar:

```ts
describe("/mifoto", () => {
  const privado = { id: 42, type: "private" };
  const foto = [
    { file_id: "chica", width: 90, height: 90 },
    { file_id: "grande", width: 640, height: 640 },
  ];
  const elegida = async () => (await env.DB.prepare("SELECT file_id FROM user_photos WHERE user_id = 42").first())?.file_id;

  it("una foto con /mifoto de epígrafe queda elegida", async () => {
    await post({ update_id: 1, message: message({ chat: privado, text: undefined, caption: "/mifoto", photo: foto }) });
    expect(await elegida()).toBe("grande");
    expect(sentTexts()).toEqual(["Listo, esa es tu foto para los mega 💖"]);
  });

  it("/mifoto y después la foto, dentro de los 10 minutos", async () => {
    await post({ update_id: 1, message: message({ chat: privado, text: "/mifoto" }) });
    await post({ update_id: 2, message: message({ message_id: 2, chat: privado, date: DATE + 60, text: undefined, photo: foto }) });
    expect(await elegida()).toBe("grande");
    expect(sentTexts()).toEqual(["Mandame la foto que querés usar en los mega 💖", "Listo, esa es tu foto para los mega 💖"]);
  });

  it("una foto suelta, sin pedido o pasados los 10 minutos, se ignora", async () => {
    await post({ update_id: 1, message: message({ chat: privado, text: "/mifoto" }) });
    await post({ update_id: 2, message: message({ message_id: 2, chat: privado, date: DATE + 601, text: undefined, photo: foto }) });
    expect(await elegida()).toBeUndefined();
    expect(sentTexts()).toEqual(["Mandame la foto que querés usar en los mega 💖"]);
  });

  it("/mifoto borrar vuelve a la foto de perfil", async () => {
    await post({ update_id: 1, message: message({ chat: privado, text: undefined, caption: "/mifoto", photo: foto }) });
    await post({ update_id: 2, message: message({ message_id: 2, chat: privado, text: "/mifoto borrar" }) });
    expect(await elegida()).toBeUndefined();
    expect(sentTexts().at(-1)).toBe("Listo, vuelvo a usar tu foto de perfil.");
  });

  it("si la manda como archivo, avisa que la mande como foto", async () => {
    await post({ update_id: 1, message: message({ chat: privado, text: "/mifoto" }) });
    const document = { file_id: "archivo", mime_type: "image/jpeg" };
    await post({ update_id: 2, message: message({ message_id: 2, chat: privado, text: undefined, document }) });
    expect(await elegida()).toBeUndefined();
    expect(sentTexts().at(-1)).toBe("Mandala como foto, no como archivo 🙏");
  });

  it("en el grupo explica que es por privado", async () => {
    await post({ update_id: 1, message: message({ text: "/mifoto" }) });
    expect(sentTexts()).toEqual(["La foto se cambia por privado: escribime a mí 😉"]);
  });

  it("rechaza a quien no es del grupo", async () => {
    memberStatus = "left";
    await post({ update_id: 1, message: message({ chat: privado, text: undefined, caption: "/mifoto", photo: foto }) });
    expect(await elegida()).toBeUndefined();
    expect(sentTexts()).toEqual(["Este bot es solo para los miembros del grupo."]);
  });
});
```

Y en `describe("/help")`, sumar `"/mifoto"` a la lista de comandos que se buscan.

- [ ] **Step 4: Correr y ver que fallan**

Run: `npx vitest run test/photoStore.test.ts test/index.test.ts 2>&1 | grep -E "Tests|FAIL"`
Expected: FAIL.

- [ ] **Step 5: `src/photoStore.ts`**

```ts
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
```

- [ ] **Step 6: Tipos de Telegram**

En `TelegramMessage` de `src/telegram.ts`, después de `text?: string;`:

```ts
  // Telegram manda la misma foto en varios tamaños, de menor a mayor.
  photo?: { file_id: string; width: number; height: number }[];
  caption?: string;
  document?: { file_id: string; mime_type?: string };
```

- [ ] **Step 7: El comando en `src/index.ts`**

1. Imports: `import { choosePhoto, forgetPhoto, requestPhoto, takePhotoRequest } from "./photoStore";`.
2. Constantes: `const MY_PHOTO_COMMAND = /^\/mifoto(@\w+)?(?:\s+(\S+))?\s*$/i;` y `const PHOTO_REQUEST_SECONDS = 600;`.
3. `HELP`, después de la línea de `/detalle`: `"/mifoto — por privado, elegí la foto que uso para vos en los MEGA matchi matchi (/mifoto borrar vuelve a la de perfil)",`.
4. En `handleUpdate`, reemplazar `if (!message.text || !message.from || message.from.is_bot) return;` por:

```ts
  if (!message.from || message.from.is_bot) return;
  // Las fotos traen el texto en el epígrafe.
  const text = message.text ?? message.caption ?? "";
  const hasImage = Boolean(message.photo || message.document?.mime_type?.startsWith("image/"));
  if (!text && !hasImage) return;
```

y usar `text` en lugar de `message.text` en el resto de `handleUpdate` (incluidos `parseResults(text)` y los `.test`/`.match` de comandos). `saveResults`/`ftAfterResults` siguen leyendo `message.text!`: pasarles `text` como parámetro en lugar de leerlo del mensaje.

5. Después del chequeo de miembro por privado y antes de `SUMMARY_COMMAND`:

```ts
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
```

y la función:

```ts
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
  if (message.document) return "Mandala como foto, no como archivo 🙏";
  if (isCommand) {
    await requestPhoto(env.DB, from.id, message.date);
    return "Mandame la foto que querés usar en los mega 💖";
  }
  return null;
}
```

Ojo con el test "si la manda como archivo": `/mifoto` crea el pedido, después llega el documento sin `photo` → responde el aviso (el pedido queda vigente para cuando la mande bien).

- [ ] **Step 8: Correr todo**

Run: `npx tsc --noEmit && npx vitest run 2>&1 | grep -E "Tests|FAIL"`
Expected: todos pasan.

- [ ] **Step 9: Commit**

```bash
git add migrations/0004_user_photos.sql src/photoStore.ts src/telegram.ts src/index.ts test/photoStore.test.ts test/index.test.ts
git commit -m "feat: /mifoto para elegir la foto de los MEGA matchi matchi"
```

---

### Task 7: La foto en el aviso del MEGA

**Files:**

- Create: `src/render.ts`, `src/photos.ts`
- Modify: `src/telegram.ts`, `src/announce.ts`
- Test: `test/telegram.test.ts`, `test/index.test.ts`

**Interfaces:**

- Consumes: `megaHtml`, `MAX_FACES`, `MegaFace` (Task 5); `chosenPhoto` (Task 6); `MegaPerson`, `megaCaption` (Task 4); `Env.BROWSER` (Task 1).
- Produces:
  - `sendPhoto(token: string, chatId: number, png: ArrayBuffer, caption: string): Promise<void>`, `profilePhotoId(token: string, userId: number): Promise<string | null>`, `downloadFile(token: string, fileId: string): Promise<ArrayBuffer | null>` en `src/telegram.ts`.
  - `personPhoto(env: Env, userId: number): Promise<string | null>` en `src/photos.ts`.
  - `renderPng(browser: BrowserRun, html: string): Promise<ArrayBuffer>` en `src/render.ts`.

- [ ] **Step 1: Tests del webhook con la foto**

En `test/index.test.ts`:

1. Un `BROWSER` simulado en el `testEnv`:

```ts
const quickAction = vi.fn<(action: string, options: { html: string }) => Promise<Response>>();
const testEnv: Env = { ...env, GROUP_CHAT_ID: String(CHAT), BROWSER: { quickAction } as unknown as BrowserRun };
```

y en `beforeEach`: `quickAction.mockReset(); quickAction.mockImplementation(async () => new Response(new Uint8Array([137, 80, 78, 71])));`.

2. El `fetchSpy` de `beforeEach` sabe contestar fotos de perfil (Rafa, el usuario `2`, tiene; el resto no):

```ts
  fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
    const path = String(url);
    if (path.endsWith("/getChatMember")) {
      return new Response(JSON.stringify({ ok: true, result: { status: memberStatus } }));
    }
    if (path.endsWith("/getUserProfilePhotos")) {
      const { user_id } = JSON.parse(String(init?.body));
      const photos = user_id === 2 ? [[{ file_id: "rafa-chica" }, { file_id: "rafa-grande" }]] : [];
      return new Response(JSON.stringify({ ok: true, result: { photos } }));
    }
    if (path.endsWith("/getFile")) return new Response(JSON.stringify({ ok: true, result: { file_path: "photos/rafa.jpg" } }));
    if (path.endsWith("/photos/rafa.jpg")) return new Response(new Uint8Array([1, 2, 3]));
    return new Response("{}");
  });
```

`AQID` es `[1, 2, 3]` en base64.

3. Un helper `photos()` que lista los `sendPhoto` con su epígrafe:

```ts
function photos(): { chat_id: string; caption: string }[] {
  return fetchSpy.mock.calls
    .filter(([url]) => String(url).endsWith("/sendPhoto"))
    .map(([, init]) => {
      const form = init?.body as FormData;
      return { chat_id: String(form.get("chat_id")), caption: String(form.get("caption")) };
    });
}
```

4. Cambiar el test `"misma grilla y mismo puntaje es MEGA"` del bloque `aviso de matchi matchi` para esperar la foto en vez del texto, y agregar:

```ts
  it("el MEGA sale con foto: Rafa con su foto de perfil, Cindy con la inicial", async () => {
    await post({ update_id: 1, message: message() });
    await post({ update_id: 2, message: message({ message_id: 2, from: rafa }) });
    expect(photos()).toEqual([{ chat_id: String(CHAT), caption: "💖 ¡MEGA MATCHI MATCHI de Cindy y Rafa en 🧉 Boludle!" }]);
    expect(sent()).toEqual([]);
    const html = quickAction.mock.calls[0][1].html;
    expect(html).toContain("data:image/jpeg;base64,AQID");
    expect(html).toMatch(/>C<\/div>/);
  });

  it("usa la foto elegida con /mifoto antes que la de perfil", async () => {
    await env.DB.prepare("INSERT INTO user_photos (user_id, file_id, updated_at) VALUES (2, 'elegida', 0)").run();
    await post({ update_id: 1, message: message() });
    await post({ update_id: 2, message: message({ message_id: 2, from: rafa }) });
    const getFiles = fetchSpy.mock.calls.filter(([url]) => String(url).endsWith("/getFile"));
    expect(getFiles.map(([, init]) => JSON.parse(String(init?.body)).file_id)).toEqual(["elegida"]);
  });

  it("si falla la foto de alguien, va con su inicial y el MEGA sale igual con foto", async () => {
    fetchSpy.mockImplementation(async (url) => {
      if (String(url).endsWith("/getFile")) return new Response("{}", { status: 400 });
      if (String(url).endsWith("/getUserProfilePhotos")) {
        return new Response(JSON.stringify({ ok: true, result: { photos: [[{ file_id: "x" }]] } }));
      }
      return new Response("{}");
    });
    await post({ update_id: 1, message: message() });
    await post({ update_id: 2, message: message({ message_id: 2, from: rafa }) });
    expect(photos()).toHaveLength(1);
    expect(quickAction.mock.calls[0][1].html).toMatch(/>R<\/div>/);
  });

  it("si falla el render, el MEGA sale como texto", async () => {
    quickAction.mockImplementation(async () => new Response("sin cuota", { status: 429 }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await post({ update_id: 1, message: message() });
    await post({ update_id: 2, message: message({ message_id: 2, from: rafa }) });
    expect(photos()).toEqual([]);
    expect(sentTexts()).toEqual(["💖 ¡MEGA MATCHI MATCHI de Cindy y Rafa en 🧉 Boludle!"]);
  });

  it("con más de 6 personas la foto lleva 6 y el epígrafe nombra a todas", async () => {
    for (let id = 1; id <= 7; id++) {
      const from = { id: 100 + id, is_bot: false, first_name: `P${id}` };
      await post({ update_id: id, message: message({ message_id: id, from }) });
    }
    const last = quickAction.mock.calls.at(-1)![1].html;
    expect(last.match(/class="half[ "]/g)).toHaveLength(6);
    expect(photos().at(-1)!.caption).toBe("💖 ¡MEGA MATCHI MATCHI de P1, P2, P3, P4, P5, P6 y P7 en 🧉 Boludle!");
  });
```

5. En los tests del bloque `ft` y del aviso que esperaban el epígrafe como texto (`"si se suma alguien…"`, el último de `ft`), pasar a esperar `photos().at(-1)!.caption` con el mismo texto.

- [ ] **Step 2: Test de `sendPhoto`**

En `test/telegram.test.ts`:

```ts
describe("sendPhoto", () => {
  it("manda el PNG como multipart con el epígrafe", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"));
    await sendPhoto("t", -1, new Uint8Array([1, 2]).buffer, "💖 hola");
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://api.telegram.org/bott/sendPhoto");
    const form = init?.body as FormData;
    expect(form.get("chat_id")).toBe("-1");
    expect(form.get("caption")).toBe("💖 hola");
    expect((form.get("photo") as File).type).toBe("image/png");
    fetchSpy.mockRestore();
  });
});
```

(sumar `sendPhoto` y `vi` a los imports del archivo).

- [ ] **Step 3: Correr y ver que fallan**

Run: `npx vitest run test/telegram.test.ts test/index.test.ts 2>&1 | grep -E "Tests|FAIL"`
Expected: FAIL.

- [ ] **Step 4: `src/telegram.ts`**

```ts
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
```

- [ ] **Step 5: `src/photos.ts`**

```ts
import type { Env } from "./env";
import { chosenPhoto } from "./photoStore";
import { downloadFile, profilePhotoId } from "./telegram";

function toBase64(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < view.length; i += 0x8000) binary += String.fromCharCode(...view.subarray(i, i + 0x8000));
  return btoa(binary);
}

// La foto de alguien para el MEGA: la elegida con /mifoto o la de perfil. null = va con su inicial.
export async function personPhoto(env: Env, userId: number): Promise<string | null> {
  try {
    const fileId = (await chosenPhoto(env.DB, userId)) ?? (await profilePhotoId(env.BOT_TOKEN, userId));
    if (!fileId) return null;
    const bytes = await downloadFile(env.BOT_TOKEN, fileId);
    return bytes ? `data:image/jpeg;base64,${toBase64(bytes)}` : null;
  } catch (error) {
    console.error(`foto de ${userId}`, error);
    return null;
  }
}
```

- [ ] **Step 6: `src/render.ts`**

```ts
// HTML → PNG con Browser Rendering. Esperar la red deja cargar las tipografías de Google Fonts.
export async function renderPng(browser: BrowserRun, html: string): Promise<ArrayBuffer> {
  const response = await browser.quickAction("screenshot", {
    html,
    viewport: { width: 1080, height: 1080 },
    gotoOptions: { waitUntil: "networkidle0" },
    screenshotOptions: { type: "png" },
  });
  if (!response.ok) throw new Error(`screenshot ${response.status}: ${await response.text()}`);
  return response.arrayBuffer();
}
```

- [ ] **Step 7: `announceMega` con foto y respaldo**

Reemplazar `announceMega` en `src/announce.ts` (sumar los imports de `megaHtml`, `MAX_FACES`, `personPhoto`, `renderPng` y `sendPhoto`):

```ts
// La foto del MEGA; si algo falla (cuota del navegador, Telegram), el epígrafe sale como texto.
export async function announceMega(env: Env, chatId: number, game: Game, people: MegaPerson[]): Promise<void> {
  const caption = megaCaption(game, people);
  try {
    const faces = await Promise.all(
      people.slice(0, MAX_FACES).map(async (person) => ({ name: person.name, photo: await personPhoto(env, person.userId) })),
    );
    await sendPhoto(env.BOT_TOKEN, chatId, await renderPng(env.BROWSER, megaHtml(faces)), caption);
  } catch (error) {
    console.error("no salió la foto del MEGA", error);
    await sendMessage(env.BOT_TOKEN, chatId, caption);
  }
}
```

- [ ] **Step 8: Correr todo**

Run: `npx tsc --noEmit && npx vitest run 2>&1 | grep -E "Tests|FAIL"`
Expected: todos pasan.

- [ ] **Step 9: Commit**

```bash
git add src/telegram.ts src/photos.ts src/render.ts src/announce.ts test/telegram.test.ts test/index.test.ts
git commit -m "feat: el MEGA matchi matchi sale con foto"
```

---

### Task 8: Deploy y prueba real

**Files:**

- Modify: `docs/specs/2026-09-24-resumen-diario-design.md` (sección "Matchi matchi (Twinning)": una línea que remita a la spec nueva)

- [ ] **Step 1: Remitir desde la spec original**

Al final de la sección `## Matchi matchi (Twinning)` de la spec del 24-09, agregar:

```markdown
- Desde el 2026-10-09 hay dos niveles, matchi matchi y MEGA matchi matchi: ver `docs/specs/2026-10-09-mega-matchi-matchi-design.md`.
```

- [ ] **Step 2: Migración remota** (confirmar con la usuaria antes)

Run: `npx wrangler d1 migrations apply resumen-juegos --remote`
Expected: aplica `0004_user_photos.sql`.

- [ ] **Step 3: Deploy**

Run: `npx tsc --noEmit && npx vitest run 2>&1 | grep Tests && npx wrangler deploy 2>&1 | grep -E "Deployed|Version ID|browser"`
Expected: tests verdes, `Deployed` y el binding `BROWSER` listado.

- [ ] **Step 4: Push**

```bash
git add docs/specs/2026-09-24-resumen-diario-design.md && git commit -m "docs: remitir al spec del MEGA matchi matchi"
git log -1 --format='%ae'   # cindylevi@gmail.com
git push origin HEAD
```

- [ ] **Step 5: Prueba con la usuaria**

Pedirle que mande `/mifoto` por privado al bot con una foto y que confirme la respuesta. Para el MEGA, dejar `npx wrangler tail` corriendo en background y esperar uno real; revisar en el log que no haya `no salió la foto del MEGA`.
