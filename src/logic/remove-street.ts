import { playRemoveThup } from "../audio";
import { challengeDisablesDelete } from "../challenge";
import type { Street } from "../entities/street";
import { commuters, session, streets } from "../state";
import type { Cell } from "../types";
import {
  bridgeIndicator,
  developerMode,
  updateInventoryCounters,
} from "../ui/ui";
import { findRoute, routeUsesStreet, streetMatchesEdge } from "./find-route";
import { commitStreetChanges } from "./orchestrator";
import { isStreetEdge } from "./street-edge";

const streetTouchesCell = (street: Street, { x, y }: Cell): boolean => {
  const [p0, p1] = street.points;
  return (x === p0.x && y === p0.y) || (x === p1.x && y === p1.y);
};

export type RemovalLayer = "motorway" | "street";

export interface RemovePathResult {
  layer?: RemovalLayer;
  removed: boolean;
}

const commuterIsOnStreet = (
  street: Street,
  c: (typeof commuters)[number],
): boolean =>
  (c.state === "toWork" || c.state === "toHome") &&
  !!c.lastTraversed &&
  !!c.route[0] &&
  streetMatchesEdge(street, c.lastTraversed, c.route[0]);

const routeIncludesStreet = (
  street: Street,
  c: (typeof commuters)[number],
): boolean => {
  if (c.state === "toWork" || c.state === "toHome") {
    return routeUsesStreet(c.route, street);
  }
  if (c.state === "unparking") {
    return !!c.pendingRoute && routeUsesStreet(c.pendingRoute, street);
  }
  return false;
};

const commuterAtWorkNeedsStreetHome = (
  street: Street,
  c: (typeof commuters)[number],
): boolean => {
  if ((c.state !== "atWork" && c.state !== "parking") || !c.destination)
    return false;
  const homeCell = c.parent! as unknown as Cell;
  return !findRoute({ from: c.destination, to: [homeCell], exclude: street });
};

const hurryCommutersHomeFor = (street: Street): void => {
  for (const c of commuters) {
    if (c.state === "atWork" && commuterAtWorkNeedsStreetHome(street, c)) {
      c.officeTimer = Math.max(c.officeTimer, 121);
    } else if (routeIncludesStreet(street, c)) {
      c.rerouteIfBetter();
    }
  }
};

const commuterStillNeedsStreet = (
  street: Street,
  c: (typeof commuters)[number],
): boolean => {
  if (c.state === "home") return false;

  if (commuterIsOnStreet(street, c)) return true;
  if (routeIncludesStreet(street, c)) return true;
  if (c.state === "toWork" && c.destination) {
    const homeCell = c.parent! as unknown as Cell;
    return !findRoute({ from: c.destination, to: [homeCell], exclude: street });
  }
  return commuterAtWorkNeedsStreetHome(street, c);
};

const isStreetStillNeeded = (street: Street): boolean => {
  for (const c of commuters) {
    if (commuterStillNeedsStreet(street, c)) return true;
  }
  return false;
};

export const removePath = (
  cell: Cell,
  prevCell?: Cell,
  layerLock?: RemovalLayer,
): RemovePathResult => {
  if (challengeDisablesDelete()) return { removed: false };
  // Edge mode: dragging from an adjacent cell — remove only the street between them.
  // Otherwise (single click, same cell, or non-adjacent jump): remove every street at `cell`.
  const useEdgeMode = !!prevCell && isStreetEdge(prevCell, cell);

  const streetsToRemove = streets.filter((path) => {
    if (path.points[0].locked || path.points[1].locked) return false;
    return useEdgeMode
      ? streetMatchesEdge(path, prevCell, cell)
      : streetTouchesCell(path, cell);
  });

  if (!streetsToRemove.length) return { removed: false };

  const motorwaysToRemove = streetsToRemove.filter((street) => street.motorway);
  if (layerLock !== "street" && motorwaysToRemove.length) {
    for (const street of motorwaysToRemove) {
      street.motorway = false;
      if (!developerMode) session.motorways++;
    }
    updateInventoryCounters();
    playRemoveThup();
    commitStreetChanges();
    return { layer: "motorway", removed: true };
  }

  if (layerLock === "motorway") return { removed: false };

  const plainStreetsToRemove = streetsToRemove.filter((street) => !street.motorway);
  if (!plainStreetsToRemove.length) return { removed: false };

  for (const streetToRemove of plainStreetsToRemove) {
    if (streetToRemove.pendingRemoval) continue;
    streetToRemove.markPendingRemoval();
    hurryCommutersHomeFor(streetToRemove);
  }

  // Streets only marked pending — don't flush atWork commuters yet.
  commitStreetChanges();
  return { layer: "street", removed: true };
};

export const cleanupPendingStreets = (): void => {
  const pending = streets.filter((s) => s.pendingRemoval);
  if (!pending.length) return;

  pending.forEach(hurryCommutersHomeFor);
  const toRemove = pending.filter((s) => !isStreetStillNeeded(s));
  if (!toRemove.length) return;

  toRemove.forEach((s) => {
    const refundResource = !s.points.some((p) => p.locked);
    if (refundResource) {
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
    }
    s.remove();
    playRemoveThup();
  });
  commitStreetChanges();
};
