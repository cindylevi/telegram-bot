# MEGA matchi matchi — Diseño

**Fecha:** 2026-10-09

## Objetivo

Separar el matchi matchi en dos niveles y festejar el más difícil con una imagen:

- **Matchi matchi:** el mismo resultado (el puntaje que muestra el bot).
- **MEGA matchi matchi:** el mismo resultado y además el mismo detalle (la grilla de cuadraditos o el puntaje de cada ronda). Se anuncia con una foto: un corazón con las fotos de quienes coincidieron, rodeado de focas, y el título "MEGA Matchi Matchi" con brillitos.

Además, cada persona puede elegir por privado qué foto usa el bot para ella en los mega.

**Criterios de éxito:**

- Un mega manda la foto al grupo; un matchi común manda el texto de siempre.
- Si la foto no se puede generar, el mega sale igual como texto.
- Corre en el plan gratis de Cloudflare.
- Los ft siguen sin contar como matchi entre quienes jugaron juntos.

## Decisiones tomadas

- **Mismo resultado:** el `display` del bot (por ejemplo `4/6`, `185`, `1 error · 03:19`). En Clues by Sam el tiempo es parte del resultado.
- **Mismo detalle:** la columna `pattern`. Hoy es la grilla de emojis; en Size It Up y MapTap pasa a ser el puntaje de cada ronda.
- **Juegos sin mega:**
  - **La Trivia del Día:** solo matchi común, porque coincidir es fácil.
  - **Sin detalle** (Magnitudle, Originle): coincidir el puntaje es matchi común.
- **Juegos con mega por rondas:** Size It Up (los cinco renglones `🟥🟥⬜️⬜️⬜️ 43`) y MapTap (`87🎓 92🏆 92🏆 82🌟 88🎉`). Matchi común = mismo total; mega = mismas rondas.
- **Resultados viejos:** los guardados antes de esto tienen `pattern = ""` en Size It Up y MapTap, así que solo dan matchi común. Los de `pattern = NULL` siguen sin contar para nada.
- **ft:** dos resultados con el mismo `message_id` son un ft y no son matchi ni mega entre sí.
- **Histórico:** el "matchi matchi histórico" de `/detalle` cuenta los dos niveles. Con la regla nueva aparecen matchis comunes que antes no contaban, también en días anteriores.
- **Imagen:** HTML/CSS convertido a PNG con Browser Rendering de Cloudflare (10 minutos de navegador por día en el plan gratis). Se descartaron Gemini (la generación de imágenes no tiene cuota gratis), Cloudinary/ImageKit (otra cuenta y el diseño es difícil de lograr con capas) y los servicios de plantillas (planes gratis de 30 a 50 imágenes).

## Clasificación

Para cada grupo de resultados del mismo juego, puzzle y día con el mismo `display`:

1. Si todos salieron del mismo mensaje (un ft), no hay matchi.
2. Si el juego admite mega, el `pattern` no está vacío y hay al menos dos mensajes distintos con el mismo `pattern`, esos son **mega**.
3. El resto del grupo con al menos dos mensajes distintos es **matchi común**.

Una misma persona puede estar en un mega y en un matchi común del mismo juego a la vez: por ejemplo, Cindy y Rafa con la misma grilla y Tomer con el mismo puntaje pero otra grilla. En ese caso el resumen muestra `💖 MEGA matchi matchi: Cindy y Rafa` y `👯 Matchi matchi: Cindy, Rafa y Tomer`.

**Cambios en los juegos:**

- `Game` suma `mega?: false` para la Trivia.
- `ParsedResult.pattern` puede venir del parser: si viene, `parseResults` no lo reemplaza por la grilla. Size It Up y MapTap devuelven sus rondas ahí.

## Avisos en el grupo

Al guardar un resultado, `findTwins` pasa a devolver a los que coinciden en `display`, cada uno marcado si además coincide en `pattern` (y el juego admite mega). Los del mismo mensaje se excluyen, como hoy.

- **Hay alguno mega:** foto con el epígrafe `💖 ¡MEGA MATCHI MATCHI de Cindy y Rafa en 🧉 Boludle!`, con todos los del mega.
- **Solo comunes:** el texto de siempre, `👯 ¡Cindy y Rafa hicieron matchi matchi en 🧉 Boludle!`.
- **Se suma alguien:** se vuelve a avisar con todos: foto nueva si coincide en el detalle, texto si solo coincide en el puntaje.

La foto se genera después de responderle a Telegram (`ctx.waitUntil`), así el webhook no espera el render.

## La imagen

`src/mega.ts` arma el HTML del prototipo aprobado:

- Lienzo de 1080 × 1080, fondo rosa con destellos.
- Título: "MEGA" en Bungee y "Matchi Matchi" en Lobster, con relleno de brillitos en degradé rosa, dorado y lila. Las tipografías vienen de Google Fonts.
- Corazón en el centro, dividido en franjas verticales, una por persona, con la foto entera recortada a la franja. Máximo 6 personas en la imagen; el epígrafe nombra a todas.
- Ocho focas de distintos tamaños e inclinaciones, en posiciones fijas y asimétricas, todas dentro del lienzo. La foca (recortada, sin el texto "cream blush") va embebida en el código como base64.

**Foto de cada persona**, en este orden:

1. La que eligió con `/mifoto`.
2. Su foto de perfil de Telegram (`getUserProfilePhotos` + `getFile`).
3. Si no hay o falla (privacidad, error 400): su inicial sobre un color propio, para que dos personas sin foto no queden iguales.

El Worker descarga las fotos y las embebe en el HTML como `data:` URI. Las URLs de descarga de Telegram llevan el token del bot y nunca salen del Worker.

**Render:** binding `BROWSER` de Browser Rendering con `quickAction("screenshot", { html, viewport })`. Requiere subir `compatibility_date` a `2026-03-24` o posterior; lo primero de la implementación es un deploy de prueba que confirme que `quickAction` acepta `html` desde el Worker. Si no, se usa la API REST de screenshot, que sí lo documenta.

**Envío:** `sendPhoto` con el PNG como multipart y el epígrafe.

**Si algo falla** (cuota agotada, error del render o de Telegram): se loguea y se manda el epígrafe como texto.

## /mifoto

Solo por privado y solo para miembros del grupo, como los demás comandos por privado.

- **Elegir:** una foto con `/mifoto` como epígrafe, o `/mifoto` y después la foto. Para lo segundo, el bot recuerda por 10 minutos que esa persona pidió `/mifoto`. Responde `Listo, esa es tu foto para los mega 💖`.
- **Volver a la de perfil:** `/mifoto borrar`.
- **Qué se guarda:** el `file_id` de la foto más grande que manda Telegram; la foto no se descarga ni se copia.
- **Datos:** migración `0004_user_photos.sql` con la tabla `user_photos (user_id INTEGER PRIMARY KEY, file_id TEXT NOT NULL, updated_at INTEGER NOT NULL)` y otra para el pedido pendiente, `photo_requests (user_id INTEGER PRIMARY KEY, requested_at INTEGER NOT NULL)`.
- `TelegramMessage` suma `photo` y `caption`; `/help` suma el comando.

## Resumen y /detalle

- **Resumen:** por juego, `💖 MEGA matchi matchi: …` y `👯 Matchi matchi: …`, cada uno con sus grupos.
- **`/detalle`, matchi matchi de hoy:** los dos niveles, con 💖 en los juegos donde fue mega.
- **`/detalle`, histórico:** cuenta cualquier matchi, sin distinguir nivel.

## Tests

- **Clasificación:** mega y común en el mismo grupo, Trivia solo común, juegos sin detalle, ft sin matchi, ft con alguien de afuera, `pattern = NULL`.
- **Parsers:** Size It Up y MapTap devuelven sus rondas en `pattern`.
- **HTML:** con 2, 3 y 7 personas (tope de 6), fotos y iniciales con colores distintos.
- **Webhook,** con `BROWSER` y Telegram simulados: el mega manda `sendPhoto` con el epígrafe, el común manda texto y, si falla el render, sale el texto de respaldo.
- **/mifoto:** foto con epígrafe, comando y después foto (dentro y fuera de los 10 minutos), `borrar`, alguien que no es del grupo, y que el mega use la foto elegida.

## Fuera de alcance

- Imágenes para el matchi común.
- Sortear la posición de las focas en cada mega.
- Recalcular o reenviar los resúmenes ya mandados.
