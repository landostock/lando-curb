import type { Commuter } from "../entities/commuter";
import { getRailCurvature } from "../gfx/pathing";
import { toSvgPoint } from "../gfx/svg-utils";
import { getNearby } from "./commuter-spatial-index";
import { edgeIsMotorway, isIntersection, neighborCount } from "./find-route";

const MIN_ROAD_SPEED = 0.11;
const MIN_YIELD_SPEED = 0.14;
const MIN_FOLLOW_SPEED = 0.12;
const MOTORWAY_SPEED_MULTIPLIER = 5;
const MOTORWAY_RAMP_PX = 6;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const smoothstep = (value: number): number => value * value * (3 - 2 * value);

const currentMotorwayBoost = (c: Commuter): number => {
  if (!c.lastTraversed || !c.route[0]) return 1;
  if (!edgeIsMotorway(c.lastTraversed, c.route[0])) return 1;

  const start = toSvgPoint(c.lastTraversed);
  const end = toSvgPoint(c.route[0]);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len2 = dx * dx + dy * dy;
  if (len2 <= 0) return 1;

  const progress = clamp01(((c.x - start.x) * dx + (c.y - start.y) * dy) / len2);
  const lengthPx = Math.sqrt(len2);
  const ramp = Math.min(0.45, MOTORWAY_RAMP_PX / lengthPx);
  const rampIn = smoothstep(clamp01(progress / ramp));
  const rampOut = smoothstep(clamp01((1 - progress) / ramp));
  const visualRamp = Math.min(rampIn, rampOut);
  const cellDistance = Math.hypot(
    c.route[0].x - c.lastTraversed.x,
    c.route[0].y - c.lastTraversed.y,
  );
  const targetBoost = MOTORWAY_SPEED_MULTIPLIER * cellDistance;

  return 1 + (targetBoost - 1) * visualRamp;
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

  if (exitIsBlocked(c)) return Math.min(speed, MIN_YIELD_SPEED);

  let hasCompetitor = false;
  for (const other of getNearby(intPt.x, intPt.y)) {
    if (other === c || isOffRoadState(other)) continue;
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
    const conn = neighborCount(c.route[0]!);
    speed *= conn > 4 ? 0.88 : conn > 3 ? 0.93 : 0.97;
  }
  return speed;
};

const applyFollowingDistance = (c: Commuter, speed: number): number => {
  for (const other of getNearby(c.x, c.y)) {
    if (other === c) continue;
    // Parking/unparking cars have left the road — don't let them stall traffic behind them.
    if (other.state === "parking" || other.state === "unparking") continue;
    // <=0 (not just <0) skips perpendicular cars (dot=0), preventing a just-crossed
    // winner from falsely slowing the yielder via following-distance after exiting.
    if (c.dx * other.dx + c.dy * other.dy <= 0) continue;
    const ddx = other.x - c.x, ddy = other.y - c.y;
    const dist = Math.sqrt(ddx * ddx + ddy * ddy);
    if (dist > 8) continue;
    if (ddx * c.dx + ddy * c.dy <= 0) continue;
    speed = Math.min(speed, Math.max(speed * (dist / 8), MIN_FOLLOW_SPEED));
  }
  return speed;
};

/** Desired speed for this tick: curvature-limited base, motorway boost, short-route penalty,
 *  intersection yielding/don't-block-the-box, following distance. Pure — no side effects. */
export const computeTargetSpeed = (c: Commuter): number => {
  const curvature = getRailCurvature(c.railState.rail, c.railState.index, 8);
  let speed =
    (curvature > 0.8 ? 0.18 : curvature > 0.4 ? 0.25 : 0.32) *
    c.speedPersonality;

  if (c.originalRoute.length < 3) speed *= 0.9;

  speed *= currentMotorwayBoost(c);

  if (c.route.length >= 2 && isIntersection(c.route[0]!)) {
    speed = applyIntersectionRules(c, speed);
  }

  return Math.max(MIN_ROAD_SPEED, applyFollowingDistance(c, speed));
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
