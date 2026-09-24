import { describe, expect, it } from "vitest";
import { GAMES, parseResult } from "../src/games";
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
});
