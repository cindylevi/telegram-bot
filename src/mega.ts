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

// En el Chrome de Cloudflare "networkidle0" no alcanza para que carguen Bungee y Lobster (spike de la
// Task 1): el render espera este elemento, que aparece cuando terminan de cargar las tipografías.
const FONTS_READY =
  '<script>document.fonts.ready.then(() => document.body.insertAdjacentHTML("beforeend", \'<i id="fonts-ready"></i>\'))</script>';

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
${FONTS_READY}
</body></html>`;
}
