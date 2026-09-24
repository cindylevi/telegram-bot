import { describe, expect, it } from "vitest";
import { dayInArgentina, isoDate, previousDay, shortDay } from "../src/date";

const utc = (...args: [number, number, number, number, number]) => Date.UTC(...args) / 1000;

describe("dayInArgentina", () => {
  it("el cron de las 02:59 UTC cae en el día anterior (23:59 en Argentina)", () => {
    expect(dayInArgentina(utc(2026, 8, 25, 2, 59))).toBe("2026-09-24");
  });

  it("a las 03:00 UTC ya es el día siguiente en Argentina", () => {
    expect(dayInArgentina(utc(2026, 8, 25, 3, 0))).toBe("2026-09-25");
  });
});

describe("previousDay", () => {
  it("cruza fin de mes y de año", () => {
    expect(previousDay("2026-03-01")).toBe("2026-02-28");
    expect(previousDay("2026-01-01")).toBe("2025-12-31");
  });
});

describe("shortDay", () => {
  it("formatea como DD/MM", () => {
    expect(shortDay("2026-09-24")).toBe("24/09");
  });
});

describe("isoDate", () => {
  it("rellena con ceros", () => {
    expect(isoDate(2026, 9, 3)).toBe("2026-09-03");
  });
});
