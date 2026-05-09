import type { BusinessPark } from "../entities/business-park";
import { commuters } from "../state";
import type { Cell } from "../types";
import { findRoute, routeCrossesPending } from "./find-route";

/**
 * Fill a business park up to its `demand` (capped by free parking slots) by dispatching
 * home-state commuters of matching type. Picks the candidate with the lowest summed
 * `RouteStep.distance`.
 */
export const dispatchCommutersFor = (bp: BusinessPark): void => {
  const freeBays = bp.baySlots.filter((s) => s === null).length;

  while (
    bp.activeFulfillmentCount < bp.demand &&
    bp.assignedPeople.length < freeBays
  ) {
    const candidates = commuters.filter(
      (c) => c.state === "home" && bp.types.includes(c.type),
    );
    if (!candidates.length) break;

    let bestCommuter = candidates[0]!;
    let bestRoute: ReturnType<typeof findRoute>;
    let bestEta = Infinity;

    for (const candidate of candidates) {
      let route = findRoute({
        from: { x: candidate.parent!.x, y: candidate.parent!.y } as Cell,
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

    if (bestRoute) {
      bestCommuter.dispatch(bestRoute, bp);
      bp.assignedPeople.push(bestCommuter);
    } else {
      // No candidate has a routable path this tick — graph is static, no point retrying.
      break;
    }
  }
};
