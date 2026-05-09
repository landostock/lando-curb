import { playRemoveThup } from "../audio";
import type { Street } from "../entities/street";
import { commuters, session, streets } from "../state";
import type { Cell } from "../types";
import {
  bridgeIndicator,
  bridgeIndicatorCount,
  motorwayIndicatorCount,
  pathTilesIndicatorCount,
} from "../ui/ui";
import { isAdjacent } from "../util/geometry";
import { findRoute, streetMatchesEdge } from "./find-route";
import { commitStreetChanges } from "./orchestrator";

const streetTouchesCell = (street: Street, { x, y }: Cell): boolean => {
  const [p0, p1] = street.points;
  return (x === p0.x && y === p0.y) || (x === p1.x && y === p1.y);
};

/**
 * Invariant: a street stays pending while any non-home commuter's home↔workplace round
 * trip would break without it. When every active commuter has an alternative, removal
 * is safe — `findRoute` cannot subsequently return `undefined` for them.
 */
const isStreetStillNeeded = (street: Street): boolean => {
  for (const c of commuters) {
    if (c.state === "home") continue;

    const homeCell = c.parent! as unknown as Cell;
    const workCells = c.workplace.points;

    const outbound = findRoute({
      from: homeCell,
      to: workCells,
      exclude: street,
    });
    if (!outbound) return true;
    const homeBound = findRoute({
      from: outbound.at(-1)!,
      to: [homeCell],
      exclude: street,
    });
    if (!homeBound) return true;
  }
  return false;
};

export const removePath = (cell: Cell, prevCell?: Cell): void => {
  // Edge mode: dragging from an adjacent cell — remove only the street between them.
  // Otherwise (single click, same cell, or non-adjacent jump): remove every street at `cell`.
  const useEdgeMode = !!prevCell && isAdjacent(prevCell, cell);

  const streetsToRemove = streets.filter((path) => {
    if (path.points[0].locked || path.points[1].locked) return false;
    return useEdgeMode
      ? streetMatchesEdge(path, prevCell, cell)
      : streetTouchesCell(path, cell);
  });

  if (!streetsToRemove.length) return;

  for (const streetToRemove of streetsToRemove) {
    if (streetToRemove.pendingRemoval) continue;
    streetToRemove.markPendingRemoval();
  }

  // Streets only marked pending — don't flush atWork commuters yet.
  commitStreetChanges();
};

export const cleanupPendingStreets = (): void => {
  const pending = streets.filter((s) => s.pendingRemoval);
  if (!pending.length) return;

  const toRemove = pending.filter((s) => !isStreetStillNeeded(s));
  if (!toRemove.length) return;

  toRemove.forEach((s) => {
    if (s.bridge) {
      session.bridges++;
      bridgeIndicatorCount.innerText = String(session.bridges);
      bridgeIndicator.style.opacity = "1";
    } else if (s.motorway) {
      session.motorways++;
      motorwayIndicatorCount.innerText = String(session.motorways);
    } else {
      session.paths++;
      pathTilesIndicatorCount.innerText = String(session.paths);
    }
    s.remove();
    playRemoveThup();
  });
  commitStreetChanges();
};
