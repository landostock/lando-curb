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

const cellKey = ({ x, y }: Point): string => `${x},${y}`;

export const houseInCell = ({ x, y }: Cell) =>
  houses.find((yurt) => yurt.x === x && yurt.y === y);

export const samePathInBothCells = (a: Cell, b: Cell) =>
  streets.some((path) => streetMatchesEdge(path, a, b));

export const cellInLake = ({ x, y }: Cell): boolean =>
  lakes.some((pond) => pond.points.some((p) => p.x === x && p.y === y));

const businessParkInCell = ({ x, y }: Cell) =>
  businessParks.find((bp) => bp.points.some((p) => p.x === x && p.y === y));

const isHouseDrivewayEdge = (a: Cell, b: Cell): boolean =>
  houses.some((house) => {
    const driveway = {
      x: house.x + house.facing.x,
      y: house.y + house.facing.y,
    };
    return (
      (house.x === a.x &&
        house.y === a.y &&
        driveway.x === b.x &&
        driveway.y === b.y) ||
      (house.x === b.x &&
        house.y === b.y &&
        driveway.x === a.x &&
        driveway.y === a.y)
    );
  });

const isBusinessParkDrivewayEdge = (a: Cell, b: Cell): boolean =>
  businessParks.some((bp) => {
    const [p0, p1] = bp.startPath?.points ?? [];
    return (
      p0 &&
      p1 &&
      ((p0.x === a.x && p0.y === a.y && p1.x === b.x && p1.y === b.y) ||
        (p0.x === b.x && p0.y === b.y && p1.x === a.x && p1.y === a.y))
    );
  });

export const streetSweptCells = (a: Cell, b: Cell): Cell[] => {
  const cells = [a, b];
  if (a.x !== b.x && a.y !== b.y) {
    cells.push({ x: a.x, y: b.y } as Cell, { x: b.x, y: a.y } as Cell);
  }
  return cells;
};

const cellContainsBuilding = (cell: Cell): boolean =>
  !!houseInCell(cell) || !!businessParkInCell(cell) || cellIsBlocked(cell);

export const streetWouldClipBuilding = (a: Cell, b: Cell): boolean => {
  const allowedDriveway =
    isHouseDrivewayEdge(a, b) || isBusinessParkDrivewayEdge(a, b);
  if (allowedDriveway) return false;
  if (cellContainsBuilding(a) || cellContainsBuilding(b)) return true;

  if (a.x !== b.x && a.y !== b.y) {
    const sideA = { x: a.x, y: b.y } as Cell;
    const sideB = { x: b.x, y: a.y } as Cell;
    const sideABusinessPark = businessParkInCell(sideA);
    const sideBBusinessPark = businessParkInCell(sideB);
    return !!sideABusinessPark && sideABusinessPark === sideBBusinessPark;
  }

  return false;
};

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

  if (!cells.every((c) => !cellIsObstructed(c, { avoidTrees }))) return false;

  const occupied = new Set(cells.map(cellKey));
  return !streets.some((street) =>
    streetSweptCells(street.points[0], street.points[1]).some((cell) =>
      occupied.has(cellKey(cell)),
    ),
  );
};
