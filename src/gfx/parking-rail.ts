import type { Pixel } from "../types";

const BEZIER_STEPS = 8;
const STRAIGHT_STEPS = 5;

const lerp = (rail: Pixel[], from: Pixel, to: Pixel, steps: number): void => {
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    rail.push({
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
    } as Pixel);
  }
};

export function computeParkingRail(
  start: Pixel,
  corner: Pixel,
  end: Pixel,
  turnRadius = 1.5,
): Pixel[] {
  const inDx = corner.x - start.x,
    inDy = corner.y - start.y;
  const inLen = Math.sqrt(inDx * inDx + inDy * inDy);
  const outDx = end.x - corner.x,
    outDy = end.y - corner.y;
  const outLen = Math.sqrt(outDx * outDx + outDy * outDy);

  const rail: Pixel[] = [start];

  if (inLen < turnRadius * 0.5 || outLen < turnRadius * 0.5) {
    lerp(rail, start, end, STRAIGHT_STEPS * 2);
    return rail;
  }

  const R = Math.min(turnRadius, inLen * 0.8, outLen * 0.8);
  const pre = {
    x: corner.x - (inDx / inLen) * R,
    y: corner.y - (inDy / inLen) * R,
  } as Pixel;
  const post = {
    x: corner.x + (outDx / outLen) * R,
    y: corner.y + (outDy / outLen) * R,
  } as Pixel;

  lerp(rail, start, pre, STRAIGHT_STEPS);

  for (let i = 1; i <= BEZIER_STEPS; i++) {
    const t = i / BEZIER_STEPS,
      mt = 1 - t;
    rail.push({
      x: mt * mt * pre.x + 2 * mt * t * corner.x + t * t * post.x,
      y: mt * mt * pre.y + 2 * mt * t * corner.y + t * t * post.y,
    } as Pixel);
  }

  lerp(rail, post, end, STRAIGHT_STEPS);
  return rail;
}
