import { describe, expect, it } from "vitest";
import { ftForBlock, ftLines, ftOnly, resolvePartners } from "../src/ft";
import { result } from "./helpers";

const D = "2026-10-08";

describe("ftLines", () => {
  it("encuentra los renglones de ft con sus nombres", () => {
    const text = "Chainle #50 · 2,811 🔗\n🟥🟧🟨\n ft Tomer, zoe y Rafa etc.\nhttps://chainle.io\nFt. @Lautaro & Facu";
    expect(ftLines(text)).toEqual([
      { line: 2, names: ["Tomer", "zoe", "Rafa"] },
      { line: 4, names: ["Lautaro", "Facu"] },
    ]);
  });

  it("acepta feat y no confunde palabras que empiezan con ft", () => {
    expect(ftLines("feat Rafa")).toEqual([{ line: 0, names: ["Rafa"] }]);
    expect(ftLines("ftw\nsoftware ft")).toEqual([]);
  });
});

describe("ftForBlock", () => {
  const fts = [{ line: 7, names: ["Rafa"] }, { line: 12, names: ["Tomer"] }];

  it("el resultado se lleva el primer ft que tiene abajo", () => {
    expect(ftForBlock(fts, 0)?.names).toEqual(["Rafa"]);
    expect(ftForBlock(fts, 8)?.names).toEqual(["Tomer"]);
    expect(ftForBlock(fts, 13)).toBeUndefined();
  });
});

describe("ftOnly", () => {
  it("devuelve los nombres si el mensaje arranca con ft", () => {
    expect(ftOnly(" ft tomer zoe etc")).toEqual(["tomer", "zoe"]);
    expect(ftOnly("hoy jugué ft Rafa")).toBeNull();
  });
});

describe("resolvePartners", () => {
  const rows = [
    result({ userId: 1, userName: "Rafa", game: "boludle", day: D }),
    result({ userId: 2, userName: "Rafael", game: "boludle", day: D }),
    result({ userId: 3, userName: "Franco", game: "boludle", day: D }),
    result({ userId: 4, userName: "Francisco", game: "boludle", day: D }),
    result({ userId: 5, userName: "Cindy", game: "boludle", day: D }),
  ];

  it("separa conocidos, desconocidos y ambiguos, sin repetir ni incluirse a uno mismo", () => {
    expect(resolvePartners(rows, ["rafa", "zoe", "Fran", "Cindy", "Rafa", "rafae"], 5)).toEqual({
      players: [{ userId: 1, name: "Rafa" }, { userId: 2, name: "Rafael" }],
      unknown: ["zoe"],
      ambiguous: [{ name: "Fran", options: ["Franco", "Francisco"] }],
    });
  });
});
