import type { BusinessPark } from "../entities/business-park";
import { commuters } from "../state";
import type { Cell } from "../types";
import { findRoute, routeCrossesPending } from "./find-route";

const isCarLeavingSameHome = (candidate: (typeof commuters)[number]): boolean =>
  commuters.some(
    (other) =>
      other !== candidate &&
      other.parent === candidate.parent &&
      other.state === "toWork" &&
      other.railState.index < 3,
  );

const findBestDispatch = (
  bp: BusinessPark,
  excludedParents = new Set<unknown>(),
) => {
  const candidates = commuters.filter(
    (c) =>
      c.state === "home" &&
      bp.types.includes(c.type) &&
      !excludedParents.has(c.parent) &&
      !isCarLeavingSameHome(c),
  );
  if (!candidates.length) return undefined;

  let bestCommuter = candidates[0]!;
  let bestRoute: ReturnType<typeof findRoute>;
  let bestEta = Infinity;

  for (const candidate of candidates) {
    const parent = candidate.parent;
    if (!parent) continue;

    let route = findRoute({
      from: { x: parent.x, y: parent.y } as Cell,
      to: bp.points,
    });

    // Don't dispatch through streets the player is removing.
    if (route && routeCrossesPending(route)) route = undefined;
    if (!route) continue;

    const eta = route.reduce((acc, step) => acc + step.distance, 0);
    if (eta < bestEta) {
      bestEta = eta;
      bestRoute = route;
      bestCommuter = candidate;
    }
  }

  if (!bestRoute) return undefined;
  return { commuter: bestCommuter, route: bestRoute };
};

export const hasDispatchableCommuter = (bp: BusinessPark): boolean =>
  bp.availableArrivalSlots > 0 && findBestDispatch(bp) !== undefined;

/**
 * Fill a business park up to its `demand` (capped by free parking slots) by dispatching
 * home-state commuters of matching type. Picks the candidate with the lowest summed
 * `RouteStep.distance`.
 */
export const dispatchCommutersFor = (bp: BusinessPark): void => {
  const dispatchedParents = new Set<unknown>();

  while (
    bp.activeFulfillmentCount < bp.demand &&
    bp.availableArrivalSlots > 0
  ) {
    const best = findBestDispatch(bp, dispatchedParents);
    if (best) {
      best.commuter.dispatch(best.route, bp);
      bp.assignedPeople.push(best.commuter);
      dispatchedParents.add(best.commuter.parent);
    } else {
      // No candidate has a routable path this tick — graph is static, no point retrying.
      break;
    }
  }
};
