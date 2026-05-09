import type { Cell, Pixel } from "../types";
import { toSvgPoint } from "./svg-utils";

export interface RailState {
  rail: Pixel[];
  index: number;
  t: number;
}

export function computeLanePath(route: Cell[]): Pixel[] {
  const lanePath: Pixel[] = [];

  for (let i = 0; i < route.length - 1; i++) {
    const { x: cx, y: cy } = toSvgPoint(route[i]!);

    let outX = route[i + 1]!.x - route[i]!.x;
    let outY = route[i + 1]!.y - route[i]!.y;
    const outLen = Math.sqrt(outX * outX + outY * outY);
    if (outLen > 0) {
      outX /= outLen;
      outY /= outLen;
    }

    let dirX = outX,
      dirY = outY;

    if (i > 0) {
      let inX = route[i]!.x - route[i - 1]!.x;
      let inY = route[i]!.y - route[i - 1]!.y;
      const inLen = Math.sqrt(inX * inX + inY * inY);
      if (inLen > 0) {
        inX /= inLen;
        inY /= inLen;
      }

      const avgX = inX + outX,
        avgY = inY + outY;
      const avgLen = Math.sqrt(avgX * avgX + avgY * avgY);
      if (avgLen > 0.001) {
        dirX = avgX / avgLen;
        dirY = avgY / avgLen;
      }
    }

    // Right-hand perpendicular offset
    lanePath.push({ x: cx - dirY, y: cy + dirX } as Pixel);
  }

  // Last waypoint: cell center (no offset) for clean arrival
  lanePath.push(toSvgPoint(route[route.length - 1]!));
  return lanePath;
}

export function computeRoadRail(lanePath: Pixel[]): Pixel[] {
  if (lanePath.length < 2) return [...lanePath];

  const turnRadius = 2.5;
  const BEZIER_STEPS = 6;
  const rail: Pixel[] = [lanePath[0]!];

  for (let i = 1; i < lanePath.length - 1; i++) {
    const prev = lanePath[i - 1]!;
    const curr = lanePath[i]!;
    const next = lanePath[i + 1]!;

    const inDx = curr.x - prev.x,
      inDy = curr.y - prev.y;
    const inLen = Math.sqrt(inDx * inDx + inDy * inDy);
    const outDx = next.x - curr.x,
      outDy = next.y - curr.y;
    const outLen = Math.sqrt(outDx * outDx + outDy * outDy);

    if (inLen < 0.001 || outLen < 0.001) {
      rail.push(curr);
      continue;
    }

    const inNx = inDx / inLen,
      inNy = inDy / inLen;
    const outNx = outDx / outLen,
      outNy = outDy / outLen;

    if (Math.abs(inNx * outNy - inNy * outNx) < 0.05) {
      rail.push(curr);
      continue;
    }

    const R = Math.min(turnRadius, inLen * 0.4, outLen * 0.4);
    const pre = { x: curr.x - inNx * R, y: curr.y - inNy * R } as Pixel;
    const post = { x: curr.x + outNx * R, y: curr.y + outNy * R } as Pixel;

    rail.push(pre);
    for (let j = 1; j <= BEZIER_STEPS; j++) {
      const t = j / BEZIER_STEPS,
        mt = 1 - t;
      rail.push({
        x: mt * mt * pre.x + 2 * mt * t * curr.x + t * t * post.x,
        y: mt * mt * pre.y + 2 * mt * t * curr.y + t * t * post.y,
      } as Pixel);
    }
  }

  rail.push(lanePath[lanePath.length - 1]!);
  return rail;
}

export function getRailCurvature(
  rail: Pixel[],
  index: number,
  lookahead: number,
): number {
  let maxAngle = 0;
  const end = Math.min(index + lookahead, rail.length - 2);
  for (let i = index; i < end; i++) {
    const a = rail[i]!,
      b = rail[i + 1]!;
    const c = rail[Math.min(i + 2, rail.length - 1)]!;
    const dx1 = b.x - a.x,
      dy1 = b.y - a.y;
    const dx2 = c.x - b.x,
      dy2 = c.y - b.y;
    maxAngle = Math.max(
      maxAngle,
      Math.atan2(Math.abs(dx1 * dy2 - dy1 * dx2), dx1 * dx2 + dy1 * dy2),
    );
  }
  return maxAngle;
}

export function advanceOnRail(
  state: RailState,
  speed: number,
): { x: number; y: number; dx: number; dy: number; done: boolean } {
  const lastIdx = state.rail.length - 2;

  let budget = speed;
  while (budget > 0 && state.index <= lastIdx) {
    const a = state.rail[state.index]!;
    const b = state.rail[state.index + 1]!;
    const segLen = Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
    if (segLen < 0.0001) {
      state.index++;
      state.t = 0;
      continue;
    }
    const available = (1 - state.t) * segLen;
    if (budget < available) {
      state.t += budget / segLen;
      budget = 0;
    } else {
      budget -= available;
      state.index++;
      state.t = 0;
    }
  }

  if (state.index > lastIdx) {
    const end = state.rail[state.rail.length - 1]!;
    return { x: end.x, y: end.y, dx: 0, dy: 0, done: true };
  }

  const a = state.rail[state.index]!;
  const b = state.rail[state.index + 1]!;
  const segDx = b.x - a.x,
    segDy = b.y - a.y;
  const segLen = Math.sqrt(segDx * segDx + segDy * segDy);

  return {
    x: a.x + segDx * state.t,
    y: a.y + segDy * state.t,
    dx: segLen > 0 ? (segDx / segLen) * 0.001 : 0,
    dy: segLen > 0 ? (segDy / segLen) * 0.001 : 0,
    done: false,
  };
}
