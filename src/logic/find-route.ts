import { grid } from "../board";
import type { Street } from "../entities/street";
import { streets } from "../state";
import type { Cell } from "../types";

interface GridEdge {
  key: number;
  penalty: number;
  motorway: boolean;
}

interface GridNode extends Cell {
  neighbors: GridEdge[];
}

export interface RouteStep extends Cell {
  distance: number;
}

// Cells must satisfy 0 ≤ y < grid.height; negative coords would collide.
const nodeKey = (p: Cell): number => p.x * grid.height + p.y;

const PENDING_PENALTY = 100;

let gridMap = new Map<number, GridNode>();
// Directed edge keys for pending streets: ka * stride + kb (both directions stored).
let pendingEdgeKeys = new Set<number>();
let pendingEdgeStride = 1;

const buildGrid = (): void => {
  const map = new Map<number, GridNode>();
  const pending = new Set<number>();
  for (let x = 0; x < grid.width; x++) {
    for (let y = 0; y < grid.height; y++) {
      map.set(nodeKey({ x, y } as Cell), {
        x,
        y,
        neighbors: [],
      } as unknown as GridNode);
    }
  }
  const stride = grid.width * grid.height;
  for (const path of streets) {
    const p0 = path.points[0];
    const p1 = path.points[1];
    const penalty = path.pendingRemoval ? PENDING_PENALTY : 0;
    const motorway = path.motorway;
    const ka = nodeKey(p0), kb = nodeKey(p1);
    map.get(ka)!.neighbors.push({ key: kb, penalty, motorway });
    map.get(kb)!.neighbors.push({ key: ka, penalty, motorway });
    if (path.pendingRemoval) {
      pending.add(ka * stride + kb);
      pending.add(kb * stride + ka);
    }
  }
  gridMap = map;
  pendingEdgeKeys = pending;
  pendingEdgeStride = stride;
};

export const updateGridData = (): void => {
  buildGrid();
};

const dijkstra = (
  grid: Map<number, GridNode>,
  from: GridNode | undefined,
  to: Set<number>,
  excludeFrom?: number,
  excludeTo?: number,
): RouteStep[] | undefined => {
  if (!from || !to.size) return undefined;

  const best = new Map<number, number>();
  const prev = new Map<number, number>();
  const visited = new Set<number>();

  const fromKey = nodeKey(from);
  best.set(fromKey, 0);

  // Linear-scan priority queue — grid is ≤589 nodes
  const queue: Array<{ key: number; cost: number }> = [
    { key: fromKey, cost: 0 },
  ];

  while (queue.length) {
    let minIdx = 0;
    for (let i = 1; i < queue.length; i++) {
      if (queue[i]!.cost < queue[minIdx]!.cost) minIdx = i;
    }
    const last = queue.length - 1;
    if (minIdx !== last)
      [queue[minIdx], queue[last]] = [queue[last]!, queue[minIdx]!];
    const { key: curKey, cost } = queue.pop()!;

    if (visited.has(curKey)) continue;
    visited.add(curKey);

    if (to.has(curKey)) {
      const path: RouteStep[] = [];
      let k: number | undefined = curKey;
      while (k !== undefined) {
        const node = grid.get(k)!;
        const pk = prev.get(k);
        let distance = 0;
        if (pk !== undefined) {
          const p = grid.get(pk)!;
          const baseWeight = p.x !== node.x && p.y !== node.y ? 1.414 : 1;
          // ETA-aware: motorway segments are faster, so they contribute less to total distance.
          // Penalty is excluded — it's a routing-cost tiebreaker, not actual travel time.
          const edge = p.neighbors.find((n) => n.key === k);
          distance = baseWeight * (edge?.motorway ? 0.6 : 1);
        }
        path.unshift({ x: node.x, y: node.y, distance } as RouteStep);
        k = pk;
      }
      return path;
    }

    const node = grid.get(curKey)!;
    for (const { key: nk, penalty, motorway } of node.neighbors) {
      if (visited.has(nk)) continue;
      // Hard-skip the excluded edge (in either direction).
      if (
        (curKey === excludeFrom && nk === excludeTo) ||
        (curKey === excludeTo && nk === excludeFrom)
      )
        continue;
      const neighbor = grid.get(nk);
      if (!neighbor) continue;

      const baseWeight =
        neighbor.x !== node.x && neighbor.y !== node.y ? 1.414 : 1;
      const weight = baseWeight * (motorway ? 0.6 : 1) + penalty;
      const newCost = cost + weight;

      if (!best.has(nk) || newCost < best.get(nk)!) {
        best.set(nk, newCost);
        prev.set(nk, curKey);
        queue.push({ key: nk, cost: newCost });
      }
    }
  }

  return undefined;
};

export const findRoute = ({
  from,
  to,
  exclude,
}: {
  from: Cell;
  to: Cell[];
  /** Hard-skip this street's edge while routing — used to ask "does an alternative exist?". */
  exclude?: Street;
}): RouteStep[] | undefined => {
  const excludeFrom = exclude ? nodeKey(exclude.points[0]) : undefined;
  const excludeTo = exclude ? nodeKey(exclude.points[1]) : undefined;
  return dijkstra(
    gridMap,
    gridMap.get(nodeKey(from)),
    new Set(to.map(nodeKey)),
    excludeFrom,
    excludeTo,
  );
};

export const isIntersection = (p: Cell): boolean => {
  const node = gridMap.get(nodeKey(p));
  return !!node && node.neighbors.length > 2;
};

/** Number of street connections at a cell (0 for off-grid). */
export const neighborCount = (p: Cell): number => {
  const node = gridMap.get(nodeKey(p));
  return node ? node.neighbors.length : 0;
};

/** True when the street's two endpoints equal cells `a` and `b` (in either order). */
export const streetMatchesEdge = (
  street: Street,
  a: Cell,
  b: Cell,
): boolean => {
  const [p0, p1] = street.points;
  return (
    (p0.x === a.x && p0.y === a.y && p1.x === b.x && p1.y === b.y) ||
    (p0.x === b.x && p0.y === b.y && p1.x === a.x && p1.y === a.y)
  );
};

/** True when the edge between cells `a` and `b` is a motorway. */
export const edgeIsMotorway = (a: Cell, b: Cell): boolean => {
  const node = gridMap.get(nodeKey(a));
  if (!node) return false;
  const bKey = nodeKey(b);
  return node.neighbors.some((e) => e.key === bKey && e.motorway);
};

/** Cell-by-cell route equality. */
export const sameRoute = (a: Cell[], b: Cell[]): boolean =>
  a.length === b.length &&
  a.every((c, i) => c.x === b[i]!.x && c.y === b[i]!.y);

/** True when consecutive cells in `route` equal the street's two endpoints (in either order). */
export const routeUsesStreet = (route: Cell[], street: Street): boolean => {
  for (let i = 0; i < route.length - 1; i++) {
    if (streetMatchesEdge(street, route[i]!, route[i + 1]!)) return true;
  }
  return false;
};

export const routeCrossesPending = (route: Cell[]): boolean => {
  for (let i = 0; i < route.length - 1; i++) {
    if (pendingEdgeKeys.has(nodeKey(route[i]!) * pendingEdgeStride + nodeKey(route[i + 1]!)))
      return true;
  }
  return false;
};
