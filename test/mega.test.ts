import { describe, expect, it } from "vitest";
import { FOCA } from "../src/assets/foca";
import { megaHtml } from "../src/mega";

const photo = (n: number) => `data:image/jpeg;base64,FOTO${n}`;
const floors = (html: string) => html.match(/class="floor /g)?.length ?? 0;
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

  it("hasta 6, una sola fila de franjas", () => {
    const six = Array.from({ length: 6 }, (_, i) => ({ name: `P${i}`, photo: photo(i) }));
    const html = megaHtml(six);
    expect(stripes(html)).toBe(6);
    expect(floors(html)).toBe(0);
    expect(html).not.toContain('class="big"');
  });

  it("de 7 a 12 el corazón se parte en dos pisos, con más gente arriba; más de 12 no entran", () => {
    const people = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `P${i}`, photo: photo(i) }));
    const ten = megaHtml(people(10));
    expect(stripes(ten)).toBe(10);
    expect(floors(ten)).toBe(2);
    expect(ten).toContain('<body class="big">');
    const [top, bottom] = ten.split('class="floor bottom"');
    expect(stripes(top)).toBe(6);
    expect(stripes(bottom)).toBe(4);
    const twelve = megaHtml(people(12).map((p) => ({ ...p, photo: null })));
    expect(twelve).not.toContain("NaN");
    expect(twelve).toMatch(/font-size:\d+px/);
    const fourteen = megaHtml(people(14));
    expect(stripes(fourteen)).toBe(12);
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
