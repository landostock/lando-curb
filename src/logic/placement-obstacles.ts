import { board } from "../board";
import {
  businessParks,
  houses,
  lakes,
  landmarks,
  reservedAreas,
  streets,
  trees,
} from "../state";
import type { Cell, Point, Rect } from "../types";
import { inRect } from "../util/geometry";
import { streetMatchesEdge } from "./find-route";

export const houseInCell = ({ x, y }: Cell) =>
  houses.find((yurt) => yurt.x === x && yurt.y === y);

export const samePathInBothCells = (a: Cell, b: Cell) =>
  streets.some((path) => streetMatchesEdge(path, a, b));

export const cellInLake = ({ x, y }: Cell): boolean =>
  lakes.some((pond) => pond.points.some((p) => p.x === x && p.y === y));

/** Hard obstacles — cells that no build action can ever target (out-of-bounds, landmark, BP).
 *  Lakes are NOT included: they're crossable with a bridge. Callers that can't bridge (houses,
 *  drag start) must also check `cellInLake` explicitly. */
export const cellIsBlocked = ({ x, y }: Cell): boolean => {
  if (!inRect({ x, y }, board)) return true;
  if (landmarks.some((p) => p.x === x && p.y === y)) return true;
  return businessParks.some((bp) =>
    bp.points.some((p) => p.x === x && p.y === y),
  );
};

/** True if `cell` collides with any placement-blocking game object. */
export const cellIsObstructed = (
  cell: Cell,
  { avoidTrees = true }: { avoidTrees?: boolean } = {},
): boolean => {
  const { x, y } = cell;
  if (
    lakes.some((lake) =>
      lake.avoidancePoints.some((p) => p.x === x && p.y === y),
    )
  )
    return true;
  if (reservedAreas.some((p) => p.x === x && p.y === y)) return true;
  if (businessParks.some((bp) => bp.points.some((p) => p.x === x && p.y === y)))
    return true;
  if (landmarks.some((p) => p.x === x && p.y === y)) return true;
  if (
    streets.some(
      (path) =>
        (path.points[0].x === x && path.points[0].y === y) ||
        (path.points[1].x === x && path.points[1].y === y),
    )
  )
    return true;
  if (houses.some((house) => house.x === x && house.y === y)) return true;
  if (
    houses.some(
      (house) =>
        house.x + house.facing.x === x && house.y + house.facing.y === y,
    )
  )
    return true;
  if (avoidTrees && trees.some((tree) => tree.x === x && tree.y === y))
    return true;
  return false;
};

/** Is the w×h area at `rect` free of all obstacles?
 *  Optionally checks an `extra` cell (the startPath's outside endpoint).
 *  Per-cell check — bulletproof against any ad-hoc point vs. rect logic drift. */
export const isAreaFree = ({
  rect,
  extra,
  avoidTrees = true,
}: {
  rect: Rect<Cell>;
  extra?: Point;
  avoidTrees?: boolean;
}): boolean => {
  // Collect every cell the placement would occupy.
  const cells: Cell[] = [];
  for (let dx = 0; dx < rect.width; dx++) {
    for (let dy = 0; dy < rect.height; dy++) {
      cells.push({ x: rect.x + dx, y: rect.y + dy } as Cell);
    }
  }
  if (extra) cells.push({ x: rect.x + extra.x, y: rect.y + extra.y } as Cell);

  return cells.every((c) => !cellIsObstructed(c, { avoidTrees }));
};
