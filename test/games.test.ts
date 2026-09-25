import { describe, expect, it } from "vitest";
import { GAMES, listGames, parseResults } from "../src/games";

const single = (text: string) => {
  const matches = parseResults(text);
  return matches.length === 1 ? matches[0] : null;
};
import { FIXTURES } from "./fixtures/games";

describe("parseResults", () => {
  it.each(FIXTURES.map((f) => [f.id, f.expected.display, f] as const))(
    "%s %s",
    (_id, _display, fixture) => {
      const match = single(fixture.text);
      expect(match?.game.id).toBe(fixture.id);
      expect(match?.result).toEqual(fixture.expected);
    },
  );

  it("ignora la charla normal del grupo", () => {
    expect(single("alguien jugó el 4x3 hoy? a mí me fue horrible")).toBeNull();
    expect(single("")).toBeNull();
  });

  it("cada fixture matchea con un solo juego", () => {
    for (const fixture of FIXTURES) {
      const matching = GAMES.filter((game) => game.parse(fixture.text) !== null).map((g) => g.id);
      expect(matching, fixture.text).toEqual([fixture.id]);
    }
  });

  it("parsea aunque haya comentario antes y después", () => {
    const boludle = FIXTURES.find((f) => f.id === "boludle")!;
    const trivia = FIXTURES.find((f) => f.id === "trivia")!;
    expect(single(`uff hoy me costó\n${boludle.text}\njaja`)?.result).toEqual(boludle.expected);
    expect(single(`${trivia.text}\nla última era imposible`)?.result).toEqual(trivia.expected);
  });

  it("lee varios resultados en un mismo mensaje, cada uno con su puntaje", () => {
    const oneByGame = GAMES.map((game) => FIXTURES.find((f) => f.id === game.id)!);
    const text = [...oneByGame].reverse().map((f) => f.text).join("\n\n");
    expect(parseResults(text).map((m) => [m.game.id, m.result])).toEqual(
      oneByGame.map((f) => [f.id, f.expected]),
    );
  });

  it("no confunde menciones sueltas con resultados", () => {
    expect(single("hoy saqué 4/6 en el boludle")).toBeNull();
    expect(single("pasen el link de catfishing.net")).toBeNull();
    expect(single("che, size it up hoy: Overall Score 3 jaja")).toBeNull();
  });
});

describe("listGames", () => {
  it("lista cada juego con su emoji y su link", () => {
    const lines = listGames().split("\n");
    expect(lines[0]).toBe(`🎮 Juegos que reconozco (${GAMES.length})`);
    expect(lines[1]).toBe("");
    expect(lines.slice(2)).toHaveLength(GAMES.length);
    expect(lines).toContain("🟦 4x3 — https://4x3.fun");
    expect(lines).toContain("🦐 Krillion — https://krillion.io");
    for (const line of lines.slice(2)) expect(line).toMatch(/ — https:\/\/\S+$/);
  });
});
