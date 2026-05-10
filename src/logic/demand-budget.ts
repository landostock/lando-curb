import type { BusinessPark } from "../entities/business-park";
import { businessParks, commuters, session } from "../state";
import type { Cell } from "../types";
import { findRoute, routeCrossesPending } from "./find-route";
import { getCurrentEra, getSpawningConfig } from "./spawning";

const SPIKE_COOLDOWN = 120;
const QUIET_TICK_THRESHOLD = 15 * 20;

let budgets = new Map<
  string,
  {
    accumulator: number;
    demandRate: number;
    spikeCooldown: number;
    quietTicks: number;
  }
>();

export function initDemandBudgets(): void {
  budgets = new Map();
  for (const pt of getSpawningConfig().parkTypes) {
    budgets.set(pt.color, {
      accumulator: 0,
      demandRate: pt.demandRate,
      spikeCooldown: 0,
      quietTicks: 0,
    });
  }
}

export function resetDemandBudgets(): void {
  for (const b of budgets.values()) {
    b.accumulator = 0;
    b.spikeCooldown = 0;
    b.quietTicks = 0;
  }
}

export function tickDemandBudgets(tick: number): void {
  const cfg = getSpawningConfig();
  const era = getCurrentEra(tick);

  for (const bp of businessParks) {
    for (const t of bp.types) {
      if (!budgets.has(t)) {
        const pt = cfg.parkTypes.find((p) => p.color === t);
        budgets.set(t, {
          accumulator: 0,
          demandRate: pt?.demandRate ?? 1 / 225,
          spikeCooldown: 0,
          quietTicks: 0,
        });
      }
    }
  }

  const rushLen = Math.max(
    cfg.rushCycleLengthMin,
    cfg.rushCycleLengthInitial - Math.floor(tick / cfg.rushCycleShrinkRate),
  );
  const rush =
    tick > cfg.rushStartTick
      ? 1 +
        Math.max(0, Math.sin(((tick % rushLen) / rushLen) * Math.PI * 2)) *
          era.rushAmplitude
      : 1;

  for (const [color, b] of budgets) {
    const parks = businessParks.filter(
      (bp) => bp.hasType(color) && !bp.appearing,
    );
    if (!parks.length) continue;

    let spike = 1;
    if (b.spikeCooldown > 0) b.spikeCooldown--;
    else if (Math.random() < era.demandSpikeChance) {
      spike =
        era.demandSpikeRange[0] +
        Math.random() * (era.demandSpikeRange[1] - era.demandSpikeRange[0]);
      b.spikeCooldown = SPIKE_COOLDOWN;
    }

    const idle = commuters.filter(
      (c) => c.state === "home" && c.type === color,
    ).length;
    const capacity = cfg.demandCapacityBase + Math.log2(parks.length);
    const pressure = readPressure(parks);
    const director = updateDirector({
      pressure,
      budget: b,
      idle,
      parks: parks.length,
      tick,
    });

    b.accumulator +=
      (capacity + tick / cfg.demandLinearScaleDivisor) *
      rush *
      spike *
      director.multiplier *
      b.demandRate *
      Math.min(1.25, idle / 2);

    while (b.accumulator >= 1) {
      b.accumulator--;
      addDirectedDemand(
        parks,
        color,
        director.burst,
        cfg.demandRandomTargetChance,
      );
    }
  }
}

interface PressureSnapshot {
  avgTimerRatio: number;
  unservedDemand: number;
  warningParks: number;
  emptyParks: number;
}

interface DirectorInput {
  pressure: PressureSnapshot;
  budget: {
    quietTicks: number;
  };
  idle: number;
  parks: number;
  tick: number;
}

interface DirectorState {
  multiplier: number;
  burst: number;
}

function readPressure(parks: BusinessPark[]): PressureSnapshot {
  const active = parks.filter((bp) => !bp.appearing);
  if (!active.length) {
    return {
      avgTimerRatio: 1,
      unservedDemand: 0,
      warningParks: 0,
      emptyParks: 0,
    };
  }

  const cfg = getSpawningConfig();
  const unservedDemand = active.reduce(
    (sum, bp) => sum + Math.max(0, bp.demand - bp.activeFulfillmentCount),
    0,
  );
  const timerTotal = active.reduce(
    (sum, bp) => sum + bp.demandTimer / cfg.demandTimerMax,
    0,
  );

  return {
    avgTimerRatio: timerTotal / active.length,
    unservedDemand,
    warningParks: active.filter((bp) => bp.hasWarn).length,
    emptyParks: active.filter((bp) => bp.demand === 0).length,
  };
}

function updateDirector(input: DirectorInput): DirectorState {
  const { pressure, budget, idle, parks, tick } = input;
  const calm =
    pressure.unservedDemand === 0 &&
    pressure.avgTimerRatio > 0.78 &&
    pressure.emptyParks >= Math.ceil(parks * 0.45);
  const strained =
    pressure.avgTimerRatio < 0.42 ||
    pressure.warningParks >= Math.max(2, Math.ceil(parks * 0.28));

  budget.quietTicks = calm ? budget.quietTicks + 1 : 0;

  const scorePace = 1 + Math.min(1.5, session.pickups / 1600);
  const timePace = 1 + Math.min(1.2, tick / 72000);
  const idleReady = Math.min(1.35, idle / Math.max(1, parks * 0.8));
  const quietKick =
    budget.quietTicks > QUIET_TICK_THRESHOLD
      ? 1 + Math.min(0.9, budget.quietTicks / (QUIET_TICK_THRESHOLD * 4))
      : 1;
  const relief = strained ? 0.55 : pressure.avgTimerRatio < 0.6 ? 0.78 : 1;

  const multiplier = scorePace * timePace * idleReady * quietKick * relief;
  const burst =
    calm && budget.quietTicks > QUIET_TICK_THRESHOLD
      ? Math.min(3, 1 + Math.floor(session.pickups / 900))
      : 1;

  return { multiplier, burst };
}

function addDirectedDemand(
  parks: BusinessPark[],
  color: string,
  burst: number,
  randomChance: number,
): void {
  for (let i = 0; i < burst; i++) {
    pickPark(parks, color, randomChance).demand++;
  }
}

function pickPark(
  parks: BusinessPark[],
  color: string,
  randomChance: number,
): BusinessPark {
  const reachable = parks.filter((bp) => canServePark(bp, color));
  const targets = reachable.length ? reachable : parks;

  if (Math.random() < randomChance) {
    // Popular parks get higher weight, but avoid dumping waves onto the same full pin stack.
    const cfg = getSpawningConfig();
    const weights = targets.map(
      (bp) =>
        (bp.popular ? cfg.popularDemandWeight : 1) *
        (bp.trending ? 1.8 : 1) *
        (1 / Math.max(1, bp.demand - bp.activeFulfillmentCount + 1)),
    );
    const total = weights.reduce((s, w) => s + w, 0);
    let r = Math.random() * total;
    for (let i = 0; i < targets.length; i++) {
      r -= weights[i]!;
      if (r <= 0) return targets[i]!;
    }
    return targets[targets.length - 1]!;
  }
  let best = targets[0]!;
  let bestScore = demandTargetScore(best);
  for (let i = 1; i < targets.length; i++) {
    const score = demandTargetScore(targets[i]!);
    if (score < bestScore) {
      best = targets[i]!;
      bestScore = score;
    }
  }
  return best;
}

function demandTargetScore(bp: BusinessPark): number {
  const unserved = Math.max(0, bp.demand - bp.activeFulfillmentCount);
  const trendBonus = bp.trending ? -2 : 0;
  const popularBonus = bp.popular ? -0.5 : 0;
  return bp.demand + unserved * 2 + trendBonus + popularBonus;
}

function canServePark(bp: BusinessPark, color: string): boolean {
  if (bp.appearing) return false;
  if (bp.availableArrivalSlots <= 0) return false;

  const candidates = commuters.filter(
    (c) => c.state === "home" && c.type === color,
  );

  for (const candidate of candidates) {
    const parent = candidate.parent;
    if (!parent) continue;
    const route = findRoute({
      from: { x: parent.x, y: parent.y } as Cell,
      to: bp.points,
    });
    if (route && !routeCrossesPending(route)) return true;
  }

  return false;
}
