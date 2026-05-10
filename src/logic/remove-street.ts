import { playRemoveThup } from "../audio";
import type { Street } from "../entities/street";
import { commuters, session, streets } from "../state";
import type { Cell } from "../types";
import {
  bridgeIndicator,
  developerMode,
  updateInventoryCounters,
} from "../ui/ui";
import { isAdjacent } from "../util/geometry";
import { findRoute, routeUsesStreet, streetMatchesEdge } from "./find-route";
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
const commuterStillNeedsStreet = (
  street: Street,
  c: (typeof commuters)[number],
): boolean => {
  if (c.state === "home") return false;

  const homeCell = c.parent! as unknown as Cell;
  const workCells = c.workplace.points;

  if (c.state === "toHome") {
    if (!routeUsesStreet(c.route, street)) return false;
    if (!c.route[0]) return true;
    return !findRoute({ from: c.route[0], to: [homeCell], exclude: street });
  }

  if (c.state === "unparking") {
    const route = c.pendingRoute;
    if (!route?.[0] || !routeUsesStreet(route, street)) return false;
    return !findRoute({ from: route[0], to: [homeCell], exclude: street });
  }

  if (c.state === "toWork") {
    const destination = c.destination;
    if (!destination) return routeUsesStreet(c.route, street);

    const returnRoute = findRoute({
      from: destination,
      to: [homeCell],
      exclude: street,
    });
    if (!returnRoute) return true;

    if (!routeUsesStreet(c.route, street)) return false;
    if (!c.route[0]) return true;
    return !findRoute({ from: c.route[0], to: workCells, exclude: street });
  }

  if (!c.destination) return true;
  return !findRoute({ from: c.destination, to: [homeCell], exclude: street });
};

const isStreetStillNeeded = (street: Street): boolean => {
  for (const c of commuters) {
    if (commuterStillNeedsStreet(street, c)) return true;
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

  const motorwaysToRemove = streetsToRemove.filter((street) => street.motorway);
  if (motorwaysToRemove.length) {
    for (const street of motorwaysToRemove) {
      street.motorway = false;
      if (!developerMode) session.motorways++;
    }
    updateInventoryCounters();
    playRemoveThup();
    commitStreetChanges();
    return;
  }

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
      if (!developerMode) session.bridges++;
      updateInventoryCounters();
      bridgeIndicator.style.opacity = "1";
    } else if (s.motorway) {
      if (!developerMode) session.motorways++;
      updateInventoryCounters();
    } else {
      if (!developerMode) session.paths++;
      updateInventoryCounters();
    }
    s.remove();
    playRemoveThup();
  });
  commitStreetChanges();
};
