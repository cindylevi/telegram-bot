import { describe, expect, it } from "vitest";
import { FOCA } from "../src/assets/foca";
import { megaHtml } from "../src/mega";

const photo = (n: number) => `data:image/jpeg;base64,FOTO${n}`;
const bubbles = (html: string) => html.match(/class="bubble[ "]/g)?.length ?? 0;
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

  it("hasta 6 en el corazón; sin más gente no hay fila de abajo", () => {
    const six = Array.from({ length: 6 }, (_, i) => ({ name: `P${i}`, photo: photo(i) }));
    const html = megaHtml(six);
    expect(stripes(html)).toBe(6);
    expect(bubbles(html)).toBe(0);
    expect(html).not.toContain('class="crowd"');
  });

  it("de la 7 a la 12 van en la fila de abajo, y más no entran", () => {
    const people = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `P${i}`, photo: i === 7 ? null : photo(i) }));
    const nine = megaHtml(people(9));
    expect(stripes(nine)).toBe(6);
    expect(bubbles(nine)).toBe(3);
    expect(nine).toContain('class="crowd"');
    expect(nine).toContain(`url('${photo(6)}')`);
    expect(nine).toMatch(/class="bubble initial"[^>]*>P<\/div>/);
    const fourteen = megaHtml(people(14));
    expect(stripes(fourteen)).toBe(6);
    expect(bubbles(fourteen)).toBe(6);
    expect(fourteen).not.toContain(photo(12));
  });

  it("ocho focas, las tipografías y ningún emoji (el Chrome remoto puede no tener fuente de emojis)", () => {
    const html = megaHtml([{ name: "Rafa", photo: photo(1) }]);
    expect(html.split(FOCA).length - 1).toBe(8);
    expect(html).toContain("family=Bungee&family=Lobster");
    expect(html).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it("marca #fonts-ready cuando cargan las tipografías (el render espera esa marca)", () => {
    const html = megaHtml([{ name: "Rafa", photo: photo(1) }]);
    expect(html).toContain("document.fonts.ready.then(");
    expect(html).toContain('id="fonts-ready"');
  });
});
