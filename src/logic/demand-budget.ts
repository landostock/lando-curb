import type { BusinessPark } from "../entities/business-park";
import { businessParks, commuters, session } from "../state";
import type { Cell } from "../types";
import { readDemandStackLimit } from "./demand-model-config";
import { findRoute, routeCrossesPending } from "./find-route";
import { getCurrentEra, getSpawningConfig } from "./spawning";

const SPIKE_COOLDOWN = 120;
const QUIET_TICK_THRESHOLD = 15 * 20;
const TAU = Math.PI * 2;

export interface LocalDemandWave {
  x: number;
  y: number;
  radius: number;
  intensity: number;
  endsAt: number;
  color?: string;
}

let budgets = new Map<
  string,
  {
    accumulator: number;
    demandRate: number;
    spikeCooldown: number;
    quietTicks: number;
  }
>();
let activeDemandWaves: LocalDemandWave[] = [];

export const getActiveDemandWaves = (): readonly LocalDemandWave[] =>
  activeDemandWaves;

export function initDemandBudgets(): void {
  budgets = new Map();
  activeDemandWaves = [];
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
  activeDemandWaves = [];
  for (const b of budgets.values()) {
    b.accumulator = 0;
    b.spikeCooldown = 0;
    b.quietTicks = 0;
  }
}

export function tickDemandBudgets(tick: number): void {
  const cfg = getSpawningConfig();
  const era = getCurrentEra(tick);
  const rushSignal = readRushSignal(tick, era.rushAmplitude);

  updateLocalDemandWaves(tick, rushSignal);

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
    const meanParkFactor = readMeanDemandFactor(parks, color, tick, rushSignal);

    b.accumulator +=
      (capacity + tick / cfg.demandLinearScaleDivisor) *
      spike *
      meanParkFactor *
      director.multiplier *
      b.demandRate *
      Math.min(1.25, idle / 2);

    while (b.accumulator >= 1) {
      const assigned = addDirectedDemand(
        parks,
        color,
        director.burst,
        cfg.demandRandomTargetChance,
        tick,
        rushSignal,
      );
      if (!assigned) {
        b.accumulator = 0.99;
        break;
      }
      b.accumulator--;
    }
  }
}

function readRushSignal(tick: number, amplitude: number): number {
  const cfg = getSpawningConfig();
  if (tick <= cfg.rushStartTick) return 0;

  const rushLen = Math.max(
    cfg.rushCycleLengthMin,
    cfg.rushCycleLengthInitial - Math.floor(tick / cfg.rushCycleShrinkRate),
  );
  return Math.max(0, Math.sin(((tick % rushLen) / rushLen) * TAU)) * amplitude;
}

function updateLocalDemandWaves(tick: number, rushSignal: number): void {
  const cfg = getSpawningConfig().demandModel.localWaves;
  activeDemandWaves = activeDemandWaves.filter((wave) => wave.endsAt > tick);
  if (
    !cfg.enabled ||
    tick < cfg.startTick ||
    activeDemandWaves.length >= cfg.maxActive
  ) {
    return;
  }

  const spawnChance =
    cfg.spawnChancePerDemandTick * (1 + rushSignal * cfg.rushSpawnBoost);
  if (Math.random() >= spawnChance) return;

  const active = businessParks.filter((bp) => !bp.appearing);
  if (!active.length) return;

  const centerPark = active[Math.floor(Math.random() * active.length)]!;
  const duration = randomRange(cfg.durationRange);
  const baseIntensity = randomRange(cfg.intensityRange);
  const jitter = cfg.centerJitterRadius;
  activeDemandWaves.push({
    x: centerPark.x + centerPark.width / 2 + (Math.random() * 2 - 1) * jitter,
    y: centerPark.y + centerPark.height / 2 + (Math.random() * 2 - 1) * jitter,
    radius: randomRange(cfg.radiusRange),
    intensity: baseIntensity * (1 + rushSignal * cfg.rushIntensityBoost),
    endsAt: tick + duration,
    color:
      Math.random() < cfg.affectedColorChance
        ? centerPark.types[Math.floor(Math.random() * centerPark.types.length)]
        : undefined,
  });
}

function randomRange([min, max]: [number, number]): number {
  return min + Math.random() * (max - min);
}

function readMeanDemandFactor(
  parks: BusinessPark[],
  color: string,
  tick: number,
  rushSignal: number,
): number {
  const cfg = getSpawningConfig().demandModel.factors;
  const mean =
    parks.reduce(
      (sum, bp) => sum + readDemandFactor(bp, color, tick, rushSignal),
      0,
    ) / parks.length;

  return clamp(mean, cfg.meanFactorMin, cfg.meanFactorMax);
}

function readDemandFactor(
  bp: BusinessPark,
  color: string,
  tick: number,
  rushSignal: number,
): number {
  const cfg = getSpawningConfig().demandModel;
  const profile = bp.demandProfile;
  const pulse =
    1 +
    Math.sin(((tick + profile.pulsePhase) / profile.pulsePeriod) * TAU) *
      profile.pulseAmplitude;
  const macroRush =
    1 +
    rushSignal * profile.rushAffinity * cfg.factors.macroRushBaselineShare;
  const localRush =
    1 + readLocalWavePressure(bp, color) * profile.localWaveAffinity;
  const performance = readPerformanceDemandFactor(bp);

  return clamp(
    profile.baseIntensity * pulse * macroRush * localRush * performance,
    cfg.factors.minParkFactor,
    cfg.factors.maxParkFactor,
  );
}

function readLocalWavePressure(bp: BusinessPark, color: string): number {
  const cfg = getSpawningConfig().demandModel.localWaves;
  const center = { x: bp.x + bp.width / 2, y: bp.y + bp.height / 2 };
  let pressure = 0;

  for (const wave of activeDemandWaves) {
    if (wave.color && wave.color !== color) continue;
    const distance = Math.hypot(wave.x - center.x, wave.y - center.y);
    if (distance >= wave.radius) continue;
    const falloff = (1 - distance / wave.radius) ** cfg.falloffPower;
    pressure += wave.intensity * falloff;
  }

  return pressure;
}

function readPerformanceDemandFactor(bp: BusinessPark): number {
  const cfg = getSpawningConfig();
  const performance = cfg.demandModel.performance;
  const timerRatio = clamp(bp.demandTimer / cfg.demandTimerMax, 0, 1);
  const unserved = Math.max(0, bp.demand - bp.activeFulfillmentCount);
  const stress = clamp(
    (1 - timerRatio) * performance.timerStressWeight +
      unserved * performance.unservedStressWeight -
      bp.activeFulfillmentCount * performance.activeFulfillmentRelief,
    -performance.maxStress,
    performance.maxStress,
  );

  return clamp(
    1 + stress * bp.demandProfile.performanceSensitivity * performance.reactionStrength,
    performance.minMultiplier,
    performance.maxMultiplier,
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
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
  tick: number,
  rushSignal: number,
): boolean {
  let assigned = false;
  for (let i = 0; i < burst; i++) {
    const park = pickPark(parks, color, randomChance, tick, rushSignal);
    if (!park) break;
    park.demand++;
    assigned = true;
  }
  return assigned;
}

function pickPark(
  parks: BusinessPark[],
  color: string,
  randomChance: number,
  tick: number,
  rushSignal: number,
): BusinessPark | undefined {
  const reachable = parks.filter((bp) => canServePark(bp, color));
  const demandLimit = readCurrentDemandLimit(tick);
  const targets = (reachable.length ? reachable : parks).filter(
    (bp) => bp.demand < demandLimit,
  );
  if (!targets.length) return undefined;

  if (Math.random() < randomChance) {
    // Popular parks get higher weight, but avoid dumping waves onto the same full pin stack.
    const cfg = getSpawningConfig();
    const weights = targets.map(
      (bp) =>
        readDemandFactor(bp, color, tick, rushSignal) *
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
  let bestScore = demandTargetScore(best, color, tick, rushSignal);
  for (let i = 1; i < targets.length; i++) {
    const score = demandTargetScore(targets[i]!, color, tick, rushSignal);
    if (score < bestScore) {
      best = targets[i]!;
      bestScore = score;
    }
  }
  return best;
}

function readCurrentDemandLimit(tick: number): number {
  const cfg = getSpawningConfig();
  return Math.min(
    cfg.demandPinCap,
    readDemandStackLimit(cfg.demandModel.stackLimit, tick),
  );
}

function demandTargetScore(
  bp: BusinessPark,
  color: string,
  tick: number,
  rushSignal: number,
): number {
  const unserved = Math.max(0, bp.demand - bp.activeFulfillmentCount);
  const trendBonus = bp.trending ? -2 : 0;
  const popularBonus = bp.popular ? -0.5 : 0;
  const demandFactor = readDemandFactor(bp, color, tick, rushSignal);
  return (bp.demand + unserved * 2 + trendBonus + popularBonus) / demandFactor;
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
