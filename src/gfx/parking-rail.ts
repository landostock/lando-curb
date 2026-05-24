import type { Pixel } from "../types";

const BEZIER_STEPS = 18;
const STRAIGHT_STEPS = 8;
const MIN_POINT_DISTANCE = 0.08;
const RAIL_SPACING = 0.09;
const PATH_TENSION = 0.34;

const lerp = (rail: Pixel[], from: Pixel, to: Pixel, steps: number): void => {
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    rail.push({
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
    } as Pixel);
  }
};

const compactPoints = (points: Pixel[]): Pixel[] => {
  const compacted: Pixel[] = [];
  for (const point of points) {
    const last = compacted.at(-1);
    if (
      !last ||
      Math.hypot(point.x - last.x, point.y - last.y) >= MIN_POINT_DISTANCE
    ) {
      compacted.push(point);
    }
  }

  const end = points.at(-1);
  if (end && compacted.at(-1) !== end) compacted.push(end);
  return compacted;
};

const resampleRail = (rail: Pixel[], spacing = RAIL_SPACING): Pixel[] => {
  if (rail.length <= 1) return rail;

  const sampled: Pixel[] = [rail[0]!];
  let carry = spacing;
  let cursor = rail[0]!;

  for (let i = 1; i < rail.length; i++) {
    const target = rail[i]!;
    let dx = target.x - cursor.x;
    let dy = target.y - cursor.y;
    let len = Math.hypot(dx, dy);

    while (len >= carry && len > 0.0001) {
      const t = carry / len;
      const point = {
        x: cursor.x + dx * t,
        y: cursor.y + dy * t,
      } as Pixel;
      sampled.push(point);
      cursor = point;
      dx = target.x - cursor.x;
      dy = target.y - cursor.y;
      len = Math.hypot(dx, dy);
      carry = spacing;
    }

    carry -= len;
    cursor = target;
  }

  const end = rail.at(-1)!;
  const last = sampled.at(-1)!;
  if (Math.hypot(end.x - last.x, end.y - last.y) > 0.001) sampled.push(end);
  else sampled[sampled.length - 1] = end;

  return sampled;
};

export function computeParkingRail(
  start: Pixel,
  corner: Pixel,
  end: Pixel,
  turnRadius = 3.2,
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
    return resampleRail(rail);
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
  return resampleRail(rail);
}

export function computeParkingPathRail(points: Pixel[]): Pixel[] {
  const cleanPoints = compactPoints(points);
  if (cleanPoints.length <= 2) return resampleRail([...cleanPoints]);

  const rail: Pixel[] = [cleanPoints[0]!];

  for (let i = 0; i < cleanPoints.length - 1; i++) {
    const p1 = cleanPoints[i]!;
    const p2 = cleanPoints[i + 1]!;
    const p0 =
      cleanPoints[i - 1] ??
      ({
        x: p1.x * 2 - p2.x,
        y: p1.y * 2 - p2.y,
      } as Pixel);
    const p3 =
      cleanPoints[i + 2] ??
      ({
        x: p2.x * 2 - p1.x,
        y: p2.y * 2 - p1.y,
      } as Pixel);

    const distance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const steps = Math.max(12, Math.ceil(distance / (RAIL_SPACING * 0.75)));
    for (let j = 1; j <= steps; j++) {
      const t = j / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      const h00 = 2 * t3 - 3 * t2 + 1;
      const h10 = t3 - 2 * t2 + t;
      const h01 = -2 * t3 + 3 * t2;
      const h11 = t3 - t2;
      const m1x = (p2.x - p0.x) * PATH_TENSION;
      const m1y = (p2.y - p0.y) * PATH_TENSION;
      const m2x = (p3.x - p1.x) * PATH_TENSION;
      const m2y = (p3.y - p1.y) * PATH_TENSION;
      rail.push({
        x: h00 * p1.x + h10 * m1x + h01 * p2.x + h11 * m2x,
        y: h00 * p1.y + h10 * m1y + h01 * p2.y + h11 * m2y,
      } as Pixel);
    }
  }

  return resampleRail(rail);
}
