import type { Pixel } from "../types";

const BEZIER_STEPS = 18;
const STRAIGHT_STEPS = 8;
const MIN_POINT_DISTANCE = 0.08;
const RAIL_SPACING = 0.09;
const CORNER_RADIUS = 0.42;
const MIN_CORNER_LEG = 0.16;

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

const appendCubic = (
  rail: Pixel[],
  from: Pixel,
  c1: Pixel,
  c2: Pixel,
  to: Pixel,
  steps: number,
): void => {
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    rail.push({
      x:
        mt * mt * mt * from.x +
        3 * mt * mt * t * c1.x +
        3 * mt * t * t * c2.x +
        t * t * t * to.x,
      y:
        mt * mt * mt * from.y +
        3 * mt * mt * t * c1.y +
        3 * mt * t * t * c2.y +
        t * t * t * to.y,
    } as Pixel);
  }
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
  let cursor = cleanPoints[0]!;

  for (let i = 1; i < cleanPoints.length - 1; i++) {
    const prev = cleanPoints[i - 1]!;
    const corner = cleanPoints[i]!;
    const next = cleanPoints[i + 1]!;
    const inDx = corner.x - prev.x;
    const inDy = corner.y - prev.y;
    const outDx = next.x - corner.x;
    const outDy = next.y - corner.y;
    const inLen = Math.hypot(inDx, inDy);
    const outLen = Math.hypot(outDx, outDy);

    if (inLen < MIN_CORNER_LEG || outLen < MIN_CORNER_LEG) {
      lerp(rail, cursor, corner, STRAIGHT_STEPS);
      cursor = corner;
      continue;
    }

    const inUx = inDx / inLen;
    const inUy = inDy / inLen;
    const outUx = outDx / outLen;
    const outUy = outDy / outLen;
    const radius = Math.min(CORNER_RADIUS, inLen * 0.48, outLen * 0.48);
    const pre = {
      x: corner.x - inUx * radius,
      y: corner.y - inUy * radius,
    } as Pixel;
    const post = {
      x: corner.x + outUx * radius,
      y: corner.y + outUy * radius,
    } as Pixel;

    lerp(rail, cursor, pre, Math.max(2, Math.ceil(inLen / RAIL_SPACING)));
    appendCubic(
      rail,
      pre,
      {
        x: pre.x + inUx * radius * 0.55,
        y: pre.y + inUy * radius * 0.55,
      } as Pixel,
      {
        x: post.x - outUx * radius * 0.55,
        y: post.y - outUy * radius * 0.55,
      } as Pixel,
      post,
      BEZIER_STEPS,
    );
    cursor = post;
  }

  const end = cleanPoints.at(-1)!;
  const finalDistance = Math.hypot(end.x - cursor.x, end.y - cursor.y);
  lerp(
    rail,
    cursor,
    end,
    Math.max(2, Math.ceil(finalDistance / RAIL_SPACING)),
  );
  return resampleRail(rail);
}
