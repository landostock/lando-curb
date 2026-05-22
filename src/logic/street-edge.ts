import type { Point } from "../types";
import { isAdjacent } from "../util/geometry";

/** Game-rule edge: one road segment spans exactly one neighboring cell step. */
export const isStreetEdge = (a: Point, b: Point): boolean =>
  isAdjacent(a, b);
