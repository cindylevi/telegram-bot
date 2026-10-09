import { describe, expect, it } from "vitest";
import {
  average,
  bestEver,
  comparePuzzles,
  currentStreaks,
  goldMedals,
  historicTwin,
  longestStreakEver,
  historicalRanking,
  longestCurrentStreak,
  podium,
  twinGroups,
  twinsToday,
  validResults,
} from "../src/stats";
import { result } from "./helpers";

const D = "2026-09-24";

describe("comparePuzzles", () => {
  it("compara números como números y el resto como texto", () => {
    expect(comparePuzzles("1000", "999")).toBeGreaterThan(0);
    expect(comparePuzzles("2026-09-24", "2026-09-23")).toBeGreaterThan(0);
    expect(comparePuzzles("S20-Q02", "S20-Q02")).toBe(0);
  });
});

describe("validResults", () => {
  it("se queda con el puzzle más jugado del día y descarta los de archivo", () => {
    const rows = [
      result({ userId: 1, game: "boludle", day: D, puzzle: "1683" }),
      result({ userId: 2, game: "boludle", day: D, puzzle: "1683" }),
      result({ userId: 3, game: "boludle", day: D, puzzle: "1678" }),
    ];
    expect(validResults(rows).map((r) => r.userId)).toEqual([1, 2]);
  });

  it("si empatan, gana el puzzle más nuevo", () => {
    const rows = [
      result({ userId: 1, game: "boludle", day: D, puzzle: "999" }),
      result({ userId: 2, game: "boludle", day: D, puzzle: "1000" }),
    ];
    expect(validResults(rows).map((r) => r.puzzle)).toEqual(["1000"]);
  });

  it("decide por separado para cada juego y cada día", () => {
    const rows = [
      result({ userId: 1, game: "boludle", day: D, puzzle: "1683" }),
      result({ userId: 1, game: "poople", day: D, puzzle: "405" }),
      result({ userId: 1, game: "boludle", day: "2026-09-23", puzzle: "1682" }),
    ];
    expect(validResults(rows)).toHaveLength(3);
  });
});

describe("podium", () => {
  it("en juegos higher gana el más alto", () => {
    const rows = [
      result({ userId: 1, userName: "Ana", game: "4x3", day: D, score: 140, display: "140" }),
      result({ userId: 2, userName: "Cindy", game: "4x3", day: D, score: 161, display: "161" }),
    ];
    expect(podium(rows, "higher", 3)).toEqual([
      { score: 161, tiebreak: null, names: ["Cindy"], display: "161" },
      { score: 140, tiebreak: null, names: ["Ana"], display: "140" },
    ]);
  });

  it("en juegos lower gana el más bajo y los empates comparten lugar", () => {
    const rows = [
      result({ userId: 1, userName: "Ana", game: "boludle", day: D, score: 5, display: "5/6" }),
      result({ userId: 2, userName: "Juan", game: "boludle", day: D, score: 4, display: "4/6" }),
      result({ userId: 3, userName: "Lu", game: "boludle", day: D, score: 4, display: "4/6" }),
    ];
    expect(podium(rows, "lower", 3)).toEqual([
      { score: 4, tiebreak: null, names: ["Juan", "Lu"], display: "4/6" },
      { score: 5, tiebreak: null, names: ["Ana"], display: "5/6" },
    ]);
  });

  it("con el mismo puntaje desempata por tiebreak (menor gana) y sin tiebreak va atrás", () => {
    const rows = [
      result({ userId: 1, userName: "SinTiempo", game: "mc", day: D, score: 0, display: "0", tiebreak: null }),
      result({ userId: 2, userName: "Lento", game: "mc", day: D, score: 0, display: "0", tiebreak: 900 }),
      result({ userId: 3, userName: "Rapido", game: "mc", day: D, score: 0, display: "0", tiebreak: 300 }),
      result({ userId: 4, userName: "Empate", game: "mc", day: D, score: 0, display: "0", tiebreak: 300 }),
    ];
    expect(podium(rows, "lower", 3).map((p) => p.names)).toEqual([["Rapido", "Empate"], ["Lento"], ["SinTiempo"]]);
  });

  it("deja afuera los fails y respeta el tamaño", () => {
    const rows = [
      result({ userId: 1, game: "boludle", day: D, score: null, display: "X/6" }),
      result({ userId: 2, game: "boludle", day: D, score: 5 }),
      result({ userId: 3, game: "boludle", day: D, score: 3 }),
    ];
    expect(podium(rows, "lower", 1).map((p) => p.score)).toEqual([3]);
    expect(podium([rows[0]], "lower", 3)).toEqual([]);
  });
});

describe("average", () => {
  it("promedia sin fails y redondea a 1 decimal", () => {
    const scores = (...values: (number | null)[]) =>
      values.map((score, i) => result({ userId: i, game: "g", day: D, score }));
    expect(average(scores(4, 5, null))).toBe(4.5);
    expect(average(scores(1, 1, 2))).toBe(1.3);
    expect(average(scores(null))).toBeNull();
  });
});

describe("longestCurrentStreak", () => {
  const played = (userId: number, userName: string, day: string, puzzle = day) =>
    result({ userId, userName, game: "boludle", day, puzzle });

  it("cuenta los días seguidos hasta hoy", () => {
    const rows = [
      played(2, "Juan", "2026-09-22"),
      played(2, "Juan", "2026-09-23"),
      played(2, "Juan", D),
      played(1, "Cindy", "2026-09-23"),
      played(1, "Cindy", D),
    ];
    expect(longestCurrentStreak(validResults(rows), "boludle", D)).toEqual({ names: ["Juan"], days: 3 });
  });

  it("se corta si faltó un día y no muestra rachas de 1", () => {
    const rows = [played(2, "Juan", "2026-09-22"), played(2, "Juan", D)];
    expect(longestCurrentStreak(validResults(rows), "boludle", D)).toBeNull();
  });

  it("un puzzle de archivo no mantiene la racha", () => {
    const rows = [
      played(2, "Juan", "2026-09-23", "1678"),
      played(3, "Ana", "2026-09-23", "1682"),
      played(4, "Lu", "2026-09-23", "1682"),
      played(2, "Juan", D, "1683"),
    ];
    expect(longestCurrentStreak(validResults(rows), "boludle", D)).toBeNull();
  });

  it("los empates se listan juntos y solo cuenta quien jugó hoy", () => {
    const rows = [
      played(1, "Cindy", "2026-09-23"),
      played(1, "Cindy", D),
      played(2, "Juan", "2026-09-23"),
      played(2, "Juan", D),
      played(3, "Ana", "2026-09-21"),
      played(3, "Ana", "2026-09-22"),
      played(3, "Ana", "2026-09-23"),
    ];
    expect(longestCurrentStreak(validResults(rows), "boludle", D)).toEqual({
      names: ["Cindy", "Juan"],
      days: 2,
    });
  });
});

describe("historicalRanking", () => {
  it("cuenta partidas, agrupa empates y usa el nombre más reciente", () => {
    const rows = [
      result({ userId: 1, userName: "Cin", game: "boludle", day: "2026-09-23" }),
      result({ userId: 2, userName: "Juan", game: "boludle", day: "2026-09-23" }),
      result({ userId: 1, userName: "Cindy", game: "boludle", day: D }),
      result({ userId: 2, userName: "Juan", game: "poople", day: D }),
      result({ userId: 3, userName: "Ana", game: "poople", day: D }),
    ];
    expect(historicalRanking(rows, D)).toEqual([
      { names: ["Cindy", "Juan"], games: 2 },
      { names: ["Ana"], games: 1 },
    ]);
  });

  it("no cuenta días posteriores y respeta el tamaño", () => {
    const rows = [
      result({ userId: 1, game: "boludle", day: D }),
      result({ userId: 1, game: "boludle", day: "2026-09-25" }),
      result({ userId: 2, game: "boludle", day: D }),
      result({ userId: 2, game: "poople", day: D }),
    ];
    expect(historicalRanking(rows, D, 1)).toEqual([{ names: ["U2"], games: 2 }]);
  });
});

describe("bestEver", () => {
  it("devuelve el mejor puntaje de la historia con su día", () => {
    const rows = [
      result({ userId: 1, userName: "Ana", game: "boludle", day: "2026-09-21", score: 2, display: "2/6" }),
      result({ userId: 2, userName: "Juan", game: "boludle", day: D, score: 4, display: "4/6" }),
      result({ userId: 1, userName: "Ana", game: "boludle", day: D, score: 2, display: "2/6" }),
    ];
    expect(bestEver(rows, "boludle", "lower")).toEqual({ names: ["Ana"], display: "2/6", day: "2026-09-21" });
  });

  it("en empate lista a todos sin día y usa el desempate", () => {
    const rows = [
      result({ userId: 1, userName: "Ana", game: "mc", day: "2026-09-21", score: 0, display: "0", tiebreak: 100 }),
      result({ userId: 2, userName: "Juan", game: "mc", day: D, score: 0, display: "0", tiebreak: 100 }),
      result({ userId: 3, userName: "Lu", game: "mc", day: D, score: 0, display: "0", tiebreak: 200 }),
    ];
    expect(bestEver(rows, "mc", "lower")).toEqual({ names: ["Ana", "Juan"], display: "0", day: null });
  });

  it("devuelve null si nadie lo resolvió nunca", () => {
    const rows = [result({ userId: 1, game: "boludle", day: D, score: null, display: "X/6" })];
    expect(bestEver(rows, "boludle", "lower")).toBeNull();
  });
});

describe("longestStreakEver", () => {
  const played = (userId: number, userName: string, day: string) => result({ userId, userName, game: "boludle", day });

  it("encuentra la racha más larga aunque ya se haya cortado", () => {
    const rows = [
      played(1, "Ana", "2026-09-19"),
      played(1, "Ana", "2026-09-20"),
      played(1, "Ana", "2026-09-21"),
      played(2, "Juan", "2026-09-23"),
      played(2, "Juan", D),
      played(1, "Ana", D),
    ];
    expect(longestStreakEver(rows, "boludle")).toEqual({
      names: ["Ana"],
      days: 3,
      from: "2026-09-19",
      to: "2026-09-21",
    });
  });

  it("en empate lista a todos sin fechas y no muestra rachas de 1", () => {
    const tie = [played(1, "Ana", "2026-09-20"), played(1, "Ana", "2026-09-21"), played(2, "Juan", "2026-09-23"), played(2, "Juan", D)];
    expect(longestStreakEver(tie, "boludle")).toEqual({ names: ["Ana", "Juan"], days: 2, from: null, to: null });
    expect(longestStreakEver([played(1, "Ana", D)], "boludle")).toBeNull();
  });
});

describe("currentStreaks", () => {
  const played = (userId: number, userName: string, day: string) => result({ userId, userName, game: "boludle", day });

  it("incluye las de hoy y las que siguen vivas desde ayer, de 2 días o más", () => {
    const rows = [
      played(1, "Cindy", "2026-09-22"),
      played(1, "Cindy", "2026-09-23"),
      played(2, "Juan", "2026-09-22"),
      played(2, "Juan", "2026-09-23"),
      played(2, "Juan", D),
      played(3, "Ana", "2026-09-21"),
      played(3, "Ana", "2026-09-22"),
      played(4, "Lu", D),
    ];
    expect(currentStreaks(rows, "boludle", D)).toEqual([
      { name: "Juan", days: 3, pendingToday: false },
      { name: "Cindy", days: 2, pendingToday: true },
    ]);
  });
});

describe("goldMedals", () => {
  const play = (userId: number, userName: string, day: string, score: number | null) =>
    result({ userId, userName, game: "boludle", day, score });

  it("cuenta los primeros puestos de cada día, con empates que suman oro a todos", () => {
    const rows = [
      play(1, "Rafa", "2026-09-22", 2),
      play(2, "Cindy", "2026-09-22", 3),
      play(1, "Rafa", "2026-09-23", 3),
      play(2, "Cindy", "2026-09-23", 3),
      play(1, "Rafa", D, 4),
      play(2, "Cindy", D, 5),
      play(3, "Valen", D, null),
      play(3, "Valen", "2026-09-21", 1),
    ];
    expect(goldMedals(rows, "boludle", "lower")).toEqual([
      { names: ["Rafa"], golds: 3 },
      { names: ["Cindy", "Valen"], golds: 1 },
    ]);
  });

  it("un día donde nadie lo resolvió no reparte oro", () => {
    expect(goldMedals([play(1, "Rafa", D, null)], "boludle", "lower")).toEqual([]);
  });
});

describe("matchi matchi", () => {
  let nextMessage = 1000;
  const play = (
    userId: number,
    userName: string,
    game: string,
    day: string,
    display: string,
    pattern: string | null,
    messageId = nextMessage++,
  ) => result({ userId, userName, game, day, display, pattern, messageId });

  const A = "⬜🟨⬜⬜🟨\n🟩🟩🟩🟩🟩";
  const B = "🟨⬜⬜⬜🟨\n🟩🟩🟩🟩🟩";

  it("MEGA es mismo puntaje y misma grilla; común, mismo puntaje", () => {
    const rows = [
      play(1, "Cindy", "foximax", D, "6/8", A),
      play(2, "Rafa", "foximax", D, "6/8", A),
      play(3, "Tomer", "foximax", D, "6/8", B),
      play(4, "Lu", "foximax", D, "5/8", A),
    ];
    expect(twinGroups(rows, "foximax", D)).toEqual({ mega: [["Cindy", "Rafa"]], common: [["Cindy", "Rafa", "Tomer"]] });
  });

  it("en Boludle solo cuenta el MEGA: coincidir el puntaje es trivial", () => {
    const rows = [
      play(1, "Cindy", "boludle", D, "4/6", A),
      play(2, "Rafa", "boludle", D, "4/6", A),
      play(3, "Tomer", "boludle", D, "4/6", B),
    ];
    expect(twinGroups(rows, "boludle", D)).toEqual({ mega: [["Cindy", "Rafa"]], common: [] });
    expect(twinsToday(rows, 3, D)).toEqual([]);
    expect(historicTwin(rows, 3)).toBeNull();
    expect(twinsToday(rows, 1, D)).toEqual([{ name: "Rafa", games: [{ game: "boludle", mega: true }] }]);
  });

  it("un MEGA solo no se repite como común", () => {
    const rows = [play(1, "Cindy", "boludle", D, "4/6", A), play(2, "Rafa", "boludle", D, "4/6", A)];
    expect(twinGroups(rows, "boludle", D)).toEqual({ mega: [["Cindy", "Rafa"]], common: [] });
  });

  it("en la Trivia solo hay común aunque la grilla sea igual", () => {
    const rows = [play(1, "Cindy", "trivia", D, "5/7", "🟩🟩🟥"), play(2, "Rafa", "trivia", D, "5/7", "🟩🟩🟥")];
    expect(twinGroups(rows, "trivia", D)).toEqual({ mega: [], common: [["Cindy", "Rafa"]] });
  });

  it("sin detalle guardado coincidir el puntaje es común", () => {
    const rows = [play(1, "Cindy", "size-it-up", D, "185", ""), play(2, "Rafa", "size-it-up", D, "185", "")];
    expect(twinGroups(rows, "size-it-up", D)).toEqual({ mega: [], common: [["Cindy", "Rafa"]] });
  });

  it("con las mismas rondas Size It Up es MEGA", () => {
    const rounds = "🟥🟥⬜️⬜️⬜️ 43\n🟥🟥🟥🟥⬜️ 74";
    const rows = [play(1, "Cindy", "size-it-up", D, "185", rounds), play(2, "Rafa", "size-it-up", D, "185", rounds)];
    expect(twinGroups(rows, "size-it-up", D).mega).toEqual([["Cindy", "Rafa"]]);
  });

  it("los resultados guardados sin grilla no cuentan", () => {
    const rows = [play(1, "Cindy", "boludle", D, "4/6", null), play(3, "Lu", "boludle", D, "4/6", null)];
    expect(twinGroups(rows, "boludle", D)).toEqual({ mega: [], common: [] });
  });

  it("un ft (mismo mensaje) no es matchi matchi, salvo con alguien de afuera", () => {
    const pair = [play(1, "Rafa", "krillion", D, "255", "🐟🫧", 50), play(2, "WinnaZ", "krillion", D, "255", "🐟🫧", 50)];
    expect(twinGroups(pair, "krillion", D)).toEqual({ mega: [], common: [] });
    expect(twinsToday(pair, 1, D)).toEqual([]);
    expect(historicTwin(pair, 1)).toBeNull();

    const withOutsider = [...pair, play(3, "Tomer", "krillion", D, "255", "🐟🫧", 51)];
    expect(twinGroups(withOutsider, "krillion", D)).toEqual({ mega: [["Rafa", "WinnaZ", "Tomer"]], common: [] });
    expect(twinsToday(withOutsider, 1, D)).toEqual([{ name: "Tomer", games: [{ game: "krillion", mega: true }] }]);
  });

  it("hoy lista con quién y en qué juegos, marcando los MEGA; el histórico cuenta los dos", () => {
    const rows = [
      play(1, "Cindy", "boludle", D, "4/6", A),
      play(2, "Rafa", "boludle", D, "4/6", A),
      play(1, "Cindy", "trivia", D, "5/7", "🟩🟩🟥"),
      play(2, "Rafa", "trivia", D, "5/7", "🟩🟥🟩"),
      play(1, "Cindy", "trivia", "2026-09-23", "3/7", "🟩🟥🟥"),
      play(3, "Lu", "trivia", "2026-09-23", "3/7", "🟥🟩🟥"),
    ];
    expect(twinsToday(rows, 1, D)).toEqual([
      { name: "Rafa", games: [{ game: "boludle", mega: true }, { game: "trivia", mega: false }] },
    ]);
    expect(historicTwin(rows, 1)).toEqual({ names: ["Rafa"], times: 2 });
    expect(historicTwin(rows, 3)).toEqual({ names: ["Cindy"], times: 1 });
    expect(historicTwin(rows, 5)).toBeNull();
  });
});
