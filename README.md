# Bot de resumen de juegos

Bot de Telegram (`@StatsReseteoBot`) para el grupo "eee reseteo": guarda los resultados de juegos diarios que se pegan en el grupo y todos los días a las 23:58 (hora de Argentina) publica un resumen con promedio, podio, rachas y ranking histórico.

Corre en **Cloudflare Workers** (plan gratis) con una base **D1**. El diseño completo está en `docs/specs/2026-09-24-resumen-diario-design.md`.

> **Importante:** hacer push a `main` **no** deploya. El bot que está corriendo cambia recién cuando corrés `npx wrangler deploy`.

## Cuentas

| Servicio | Cuenta |
|---|---|
| GitHub | `cindylevi`, repo privado `cindylevi/telegram-bot`, por el alias SSH `github-tesis` |
| Cloudflare | `granger.eliana@gmail.com` (Worker `resumen-juegos-bot`, base D1 `resumen-juegos`) |
| Telegram | bot `@StatsReseteoBot` (token en BotFather), grupo con id `-1002950901334` |


## Preparar la compu (una sola vez)

Si ya tenés la carpeta `~/Documents/telegram-bot` funcionando, salteá esta sección.

```bash
git clone git@github-tesis:cindylevi/telegram-bot.git ~/Documents/telegram-bot
cd ~/Documents/telegram-bot
git config user.email "cindylevi@gmail.com"
git config user.name "Cindy Levi"
npm install
npx wrangler login     # en el navegador, entrar con granger.eliana@gmail.com
npx wrangler whoami    # tiene que mostrar granger.eliana@gmail.com
```

Para correr el bot en tu compu (`npm run dev`) o registrar el webhook hace falta el archivo `.dev.vars`, que **no** está en git:

```text
BOT_TOKEN=<token de BotFather>
WEBHOOK_SECRET=<el mismo valor que está cargado en Cloudflare>
```

Si perdiste el `WEBHOOK_SECRET`, generá uno nuevo y seguí "Cambiar el token o el secreto del webhook" más abajo.

## Hacer un cambio y deployarlo

1. Traer lo último:

   ```bash
   cd ~/Documents/telegram-bot
   git pull
   ```

2. Hacer el cambio en `src/` y agregar o ajustar su test en `test/`.

3. Correr los tests y el chequeo de tipos. Tiene que pasar todo:

   ```bash
   npm test
   npx tsc
   ```

4. Si el cambio toca la base (una columna o tabla nueva), ver "Cambios en la base" **antes** de seguir.

5. Deployar:

   ```bash
   npx wrangler deploy
   ```

   Al final imprime `Current Version ID` y `schedule: 58 2 * * *`.

6. Commitear y pushear, verificando que el mail sea el personal:

   ```bash
   git add -A
   git commit -m "feat: descripción del cambio"
   git log -1 --format='%ae | %ce'   # cindylevi@gmail.com | cindylevi@gmail.com
   git push
   ```

7. Probar en el grupo, por ejemplo con `/help` o `/resumen`.

## Cambios en la base

Las migraciones están en `migrations/` y se aplican en orden por número.

1. Crear el archivo siguiente, por ejemplo `migrations/0003_algo.sql`, con el `ALTER TABLE` o el `CREATE TABLE`.
2. Correr `npm test`. Los tests aplican las migraciones en una base local.
3. Aplicarla en producción **antes** de deployar, así el código nuevo encuentra la columna:

   ```bash
   npx wrangler d1 migrations apply resumen-juegos --remote
   ```

4. Recién ahí hacer `npx wrangler deploy`.

Nunca edites una migración que ya se aplicó: hacé una nueva.

## Agregar un juego

1. Crear `src/games/<juego>.ts` copiando uno parecido. Por ejemplo `boludle.ts` sirve para formatos "N/M" con `X` cuando no se resolvió, y `pedantle.ts` para "in N guesses".
2. Completar `id`, `name`, `emoji`, `url` y `direction` (`"higher"` si gana el puntaje más alto, `"lower"` si gana el más bajo).
3. En `parse`, usar una regex anclada al texto del juego, para no confundirlo con otros resultados del mismo mensaje.
4. Sumarlo al array `GAMES` de `src/games/index.ts`.
5. Agregar el mensaje real en `test/fixtures/games.ts`, con el puzzle, el puntaje y el `display` esperados.
6. `npm test`. El test "cada fixture matchea con un solo juego" avisa si choca con otro juego.
7. Deployar como en "Hacer un cambio y deployarlo".

`/listdles`, `/help` y `/<juego>detalle` toman el juego nuevo solos.

## Ver qué está pasando

- **Logs en vivo** (errores, avisos de grupo migrado):

  ```bash
  npx wrangler tail
  ```

- **Qué hay guardado:**

  ```bash
  npx wrangler d1 execute resumen-juegos --remote --command "SELECT user_name, game, puzzle, display, day FROM results ORDER BY id DESC LIMIT 20"
  ```

- **Si Telegram le está llegando bien al webhook:**

  ```bash
  source .dev.vars && curl -s "https://api.telegram.org/bot$BOT_TOKEN/getWebhookInfo"
  ```

  `last_error_message` tiene que estar vacío.

## Arreglos a mano

- **Corregir un puntaje** (buscar el `id` primero con la consulta de arriba):

  ```bash
  npx wrangler d1 execute resumen-juegos --remote --command "UPDATE results SET score = 0, display = '0/100' WHERE id = 25"
  ```

- **Borrar un resultado:**

  ```bash
  npx wrangler d1 execute resumen-juegos --remote --command "DELETE FROM results WHERE id = 25"
  ```

## Si algo sale mal

- **Volver a la versión anterior del bot:**

  ```bash
  npx wrangler deployments list
  npx wrangler rollback <version-id>
  ```

  Después arreglá el código, y en el próximo `wrangler deploy` queda la versión nueva.

- **El bot no responde nada:** mirar `npx wrangler tail` mientras alguien manda `/help`. Si no aparece ninguna request, revisar `getWebhookInfo`. Si aparece `mensaje de un chat desconocido`, el grupo cambió de id (ver abajo).

- **El grupo cambió de id** (Telegram lo hace si el grupo se convierte en supergrupo): el log dice el id nuevo y el SQL a correr.

  ```bash
  npx wrangler d1 execute resumen-juegos --remote --command "UPDATE results SET chat_id = <nuevo> WHERE chat_id = <viejo>"
  ```

  Después cambiar `GROUP_CHAT_ID` en `wrangler.toml`, deployar y commitear.

## Cambiar el token o el secreto del webhook

Si el token se filtró, revocalo en BotFather con `/revoke` y generá uno nuevo.

1. Actualizar `.dev.vars` con el token nuevo (y, si hace falta, un secreto nuevo: `openssl rand -hex 32`).
2. Cargarlos en Cloudflare:

   ```bash
   npx wrangler secret put BOT_TOKEN
   npx wrangler secret put WEBHOOK_SECRET
   ```

3. Volver a registrar el webhook:

   ```bash
   source .dev.vars && curl -s "https://api.telegram.org/bot$BOT_TOKEN/setWebhook" \
     --data-urlencode "url=https://resumen-juegos-bot.resumen-juegos-bot.workers.dev/webhook" \
     --data-urlencode "secret_token=$WEBHOOK_SECRET" \
     --data-urlencode 'allowed_updates=["message"]'
   ```

## Costos

El plan gratis de Cloudflare no cobra: si algún día se pasa de un límite, las requests de más fallan hasta el día siguiente, pero no hay cargos. Mientras la cuenta no se pase a Workers Paid, el costo es cero. Telegram y el repo privado de GitHub también son gratis.
