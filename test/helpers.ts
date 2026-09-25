import type { StoredResult } from "../src/store";

let sequence = 0;

type Required = Pick<StoredResult, "userId" | "game" | "day">;

// Arma un StoredResult con defaults razonables; createdAt crece en cada llamada
// para que el orden de creación sea el orden de llegada.
export function result(fields: Required & Partial<StoredResult>): StoredResult {
  sequence += 1;
  return {
    userName: `U${fields.userId}`,
    puzzle: fields.day,
    score: 1,
    display: "1",
    createdAt: sequence,
    tiebreak: null,
    ...fields,
  };
}
