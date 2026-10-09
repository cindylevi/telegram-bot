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

  it("marca #fonts-ready cuando cargan las tipografías (el render espera esa marca)", () => {
    const html = megaHtml([{ name: "Rafa", photo: photo(1) }]);
    expect(html).toContain("document.fonts.ready.then(");
    expect(html).toContain('id="fonts-ready"');
  });
});
