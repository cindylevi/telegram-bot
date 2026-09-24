import { describe, expect, it } from "vitest";
import { parseResult } from "../src/games";
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
});
