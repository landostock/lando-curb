import type { Commuter } from "../entities/commuter";
import { getRailCurvature } from "../gfx/pathing";
import { toSvgPoint } from "../gfx/svg-utils";
import { streets } from "../state";
import type { Point } from "../types";
import { getNearby } from "./commuter-spatial-index";
import { isIntersection, neighborCount } from "./find-route";

const MIN_ROAD_SPEED = 0.11;
const MIN_YIELD_SPEED = 0.14;
const MIN_FOLLOW_SPEED = 0.12;
const MOTORWAY_SPEED_MULTIPLIER = 5;
const MOTORWAY_FULL_BOOST_RADIUS = 2.15;
const MOTORWAY_SURFACE_RADIUS = 3.6;
const JUNCTION_BUSY_RADIUS2 = 12 * 12;
const CORRIDOR_PRESSURE_RADIUS = 14;
const CORRIDOR_LATERAL_LIMIT = 3.6;
const MOTORWAY_CORRIDOR_LATERAL_LIMIT = 2.2;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const smoothstep = (value: number): number => value * value * (3 - 2 * value);

const headingOf = (
  c: Pick<Commuter, "dx" | "dy">,
): { x: number; y: number } => {
  const len = Math.hypot(c.dx, c.dy);
  return len > 0 ? { x: c.dx / len, y: c.dy / len } : { x: 0, y: 0 };
};

interface MotorwaySpeedContext {
  boost: number;
  active: boolean;
}

const nearestSegmentPoint = (
  point: Point,
  start: Point,
  end: Point,
): { distance: number } => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len2 = dx * dx + dy * dy;
  if (len2 <= 0) return { distance: Infinity };

  const rawProgress =
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / len2;
  const progress = clamp01(rawProgress);
  const closestX = start.x + dx * progress;
  const closestY = start.y + dy * progress;
  return {
    distance: Math.hypot(point.x - closestX, point.y - closestY),
  };
};

const motorwayBoostForSegment = (
  c: Commuter,
  start: Point,
  end: Point,
): MotorwaySpeedContext | undefined => {
  const { distance } = nearestSegmentPoint(c, start, end);
  if (distance > MOTORWAY_SURFACE_RADIUS) return undefined;
  const lengthPx = Math.hypot(end.x - start.x, end.y - start.y);
  if (lengthPx <= 0) return undefined;

  const fadeWidth = MOTORWAY_SURFACE_RADIUS - MOTORWAY_FULL_BOOST_RADIUS;
  const surfaceRamp =
    distance <= MOTORWAY_FULL_BOOST_RADIUS
      ? 1
      : 1 -
        smoothstep(clamp01((distance - MOTORWAY_FULL_BOOST_RADIUS) / fadeWidth));
  const targetBoost = MOTORWAY_SPEED_MULTIPLIER * Math.max(1, lengthPx / 8);

  return {
    active: surfaceRamp > 0.05,
    boost: 1 + (targetBoost - 1) * surfaceRamp,
  };
};

const currentMotorwayContext = (c: Commuter): MotorwaySpeedContext => {
  let best: MotorwaySpeedContext | undefined;
  for (const street of streets) {
    if (!street.motorway || street.bridge || street.pendingRemoval) continue;
    const context = motorwayBoostForSegment(
      c,
      toSvgPoint(street.points[0]),
      toSvgPoint(street.points[1]),
    );
    if (context && (!best || context.boost > best.boost)) best = context;
  }
  return best ?? { active: false, boost: 1 };
};

const isOffRoadState = (c: Commuter): boolean =>
  c.state === "parking" || c.state === "unparking";

const exitIsBlocked = (c: Commuter): boolean => {
  if (c.route.length < 3) return false;
  const exitPt = toSvgPoint(c.route[1]!);
  for (const other of getNearby(exitPt.x, exitPt.y)) {
    if (other === c || isOffRoadState(other)) continue;
    if (other.prevSpeed >= MIN_FOLLOW_SPEED) continue;
    const edx = other.x - exitPt.x, edy = other.y - exitPt.y;
    if (edx * edx + edy * edy < 36) return true;
  }
  return false;
};

const applyIntersectionRules = (c: Commuter, speed: number): number => {
  const intPt = toSvgPoint(c.route[0]!);
  const myDist2 = (c.x - intPt.x) ** 2 + (c.y - intPt.y) ** 2;
  const conn = neighborCount(c.route[0]!);

  if (exitIsBlocked(c)) return Math.min(speed, MIN_YIELD_SPEED);

  let hasCompetitor = false;
  let crossTraffic = 0;
  let junctionLoad = 0;
  for (const other of getNearby(intPt.x, intPt.y)) {
    if (other === c || isOffRoadState(other)) continue;
    const otherNearJunction =
      (other.x - intPt.x) ** 2 + (other.y - intPt.y) ** 2 <
      JUNCTION_BUSY_RADIUS2;
    if (otherNearJunction) junctionLoad++;
    if (other.route.length < 2) continue;
    if (
      other.route[0]!.x !== c.route[0]!.x ||
      other.route[0]!.y !== c.route[0]!.y
    )
      continue;

    // Same direction? not a competitor.
    const cross = Math.abs(c.dx * other.dy - c.dy * other.dx);
    const dot = Math.abs(c.dx * other.dx + c.dy * other.dy);
    if (cross < dot * 0.3) continue;

    // Already past the intersection? not a competitor.
    const toIntX = intPt.x - other.x;
    const toIntY = intPt.y - other.y;
    if (other.dx * toIntX + other.dy * toIntY < 0) continue;

    hasCompetitor = true;
    crossTraffic++;

    const otherDist2 = (other.x - intPt.x) ** 2 + (other.y - intPt.y) ** 2;
    const otherWins =
      otherDist2 < myDist2 ||
      (otherDist2 === myDist2 && other.speedPersonality > c.speedPersonality) ||
      (otherDist2 === myDist2 && other.speedPersonality === c.speedPersonality && other.uid < c.uid);
    // Keep yielding visibly rolling so traffic stays fluid.
    if (otherWins) return Math.max(speed * 0.55, MIN_YIELD_SPEED);
  }

  // Cautious approach only when cross-traffic is actually present.
  if (hasCompetitor) {
    const complexity = conn > 4 ? 0.84 : conn > 3 ? 0.9 : 0.95;
    const traffic = crossTraffic > 2 ? 0.82 : crossTraffic > 1 ? 0.9 : 1;
    speed *= complexity * traffic;
  }
  if (junctionLoad >= 3 && conn > 3) speed *= junctionLoad >= 5 ? 0.8 : 0.88;
  return speed;
};

const applyFollowingDistance = (
  c: Commuter,
  speed: number,
  motorwayActive: boolean,
): number => {
  const followDistance = motorwayActive ? 5.8 : 8;
  const minFollowSpeed = motorwayActive ? MIN_FOLLOW_SPEED * 1.45 : MIN_FOLLOW_SPEED;
  const heading = headingOf(c);
  for (const other of getNearby(c.x, c.y)) {
    if (other === c) continue;
    // Parking/unparking cars have left the road — don't let them stall traffic behind them.
    if (other.state === "parking" || other.state === "unparking") continue;
    // <=0 (not just <0) skips perpendicular cars (dot=0), preventing a just-crossed
    // winner from falsely slowing the yielder via following-distance after exiting.
    const otherHeading = headingOf(other);
    if (heading.x * otherHeading.x + heading.y * otherHeading.y <= 0.2) continue;
    const ddx = other.x - c.x, ddy = other.y - c.y;
    const dist = Math.sqrt(ddx * ddx + ddy * ddy);
    if (dist > followDistance) continue;
    if (ddx * heading.x + ddy * heading.y <= 0) continue;
    speed = Math.min(speed, Math.max(speed * (dist / followDistance), minFollowSpeed));
  }
  return speed;
};

const applyCorridorPressure = (
  c: Commuter,
  speed: number,
  motorwayActive: boolean,
): number => {
  let pressure = 0;
  const lateralLimit = motorwayActive
    ? MOTORWAY_CORRIDOR_LATERAL_LIMIT
    : CORRIDOR_LATERAL_LIMIT;
  const heading = headingOf(c);

  for (const other of getNearby(c.x, c.y)) {
    if (other === c || isOffRoadState(other)) continue;
    const ddx = other.x - c.x;
    const ddy = other.y - c.y;
    const dist2 = ddx * ddx + ddy * ddy;
    if (dist2 > CORRIDOR_PRESSURE_RADIUS * CORRIDOR_PRESSURE_RADIUS) continue;

    const otherHeading = headingOf(other);
    const alignment = heading.x * otherHeading.x + heading.y * otherHeading.y;
    if (alignment <= 0.25) continue;

    const forward = ddx * heading.x + ddy * heading.y;
    if (forward <= 0) continue;

    const lateral = Math.abs(heading.x * ddy - heading.y * ddx);
    if (lateral > lateralLimit) continue;

    const sameNextCell =
      !!c.route[0] &&
      !!other.route[0] &&
      c.route[0].x === other.route[0].x &&
      c.route[0].y === other.route[0].y;
    const sameDestination =
      !!c.destination &&
      !!other.destination &&
      c.destination.x === other.destination.x &&
      c.destination.y === other.destination.y;

    if (sameNextCell || sameDestination || dist2 < 8 * 8) pressure++;
  }

  if (pressure <= 1) return speed;
  if (motorwayActive) {
    if (pressure === 2) return speed * 0.95;
    if (pressure === 3) return speed * 0.9;
    return speed * 0.84;
  }
  if (pressure === 2) return speed * 0.9;
  if (pressure === 3) return speed * 0.8;
  return speed * 0.7;
};

/** Desired speed for this tick: curvature-limited base, motorway boost, short-route penalty,
 *  intersection yielding/don't-block-the-box, following distance. Pure — no side effects. */
export const computeTargetSpeed = (c: Commuter): number => {
  const curvature = getRailCurvature(c.railState.rail, c.railState.index, 8);
  let speed =
    (curvature > 0.8 ? 0.18 : curvature > 0.4 ? 0.25 : 0.32) *
    c.speedPersonality;

  if (c.originalRoute.length < 3) speed *= 0.9;

  const motorwayContext = currentMotorwayContext(c);
  speed *= motorwayContext.boost;

  if (c.route.length >= 2 && isIntersection(c.route[0]!)) {
    speed = applyIntersectionRules(c, speed);
  }

  speed = applyCorridorPressure(c, speed, motorwayContext.active);
  return Math.max(
    MIN_ROAD_SPEED,
    applyFollowingDistance(c, speed, motorwayContext.active),
  );
};

/** Mutates `c.prevSpeed` toward `target`. Snap-back alpha is higher when recovering from a
 *  deep yield so cars don't look stuck after the crossing has cleared. */
export const smoothSpeed = (c: Commuter, target: number): void => {
  const alpha =
    target < c.prevSpeed ? 0.18 :
    c.prevSpeed < target * 0.65 ? 0.38 :
    0.2;
  c.prevSpeed += (target - c.prevSpeed) * alpha;
};
