import { challengeBlocksIntersections } from "../challenge";
import type { Street } from "../entities/street";
import { streets } from "../state";
import type { Cell } from "../types";
import { samePoint } from "../util/geometry";
import { streetMatchesEdge } from "./find-route";

const activeStreets = (ignore: Street[]): Street[] =>
  streets.filter(
    (street) =>
      !street.pendingRemoval && !street.noConnect && !ignore.includes(street),
  );

const degreeAt = (cell: Cell, ignore: Street[]): number =>
  activeStreets(ignore).filter((street) =>
    street.points.some((point) => samePoint(point, cell)),
  ).length;

export const streetWouldCreateIntersection = (
  start: Cell,
  end: Cell,
  ignore: Street[] = [],
): boolean => {
  if (!challengeBlocksIntersections()) return false;
  if (
    activeStreets(ignore).some((street) => streetMatchesEdge(street, start, end))
  )
    return false;

  return degreeAt(start, ignore) >= 3 || degreeAt(end, ignore) >= 3;
};
