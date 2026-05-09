import { board } from "../board";
import { colors } from "../gfx/colors";
import { businessParks, houses, trees } from "../state";
import type { Cell, Direction, Point, Rect } from "../types";
import { pickRandom, shuffle, weightedRandom } from "../util/random";
import { isAreaFree } from "./placement-obstacles";
import { TIMING } from "./timing";

// ─── Random placement ────────────────────────────────────────────────────────

export const getRandomPosition = ({
  width = 1,
  height = 1,
  anchor = {
    x: board.x + board.width / 2,
    y: board.y + board.height / 2,
    width: 0,
    height: 0,
  },
  minDistance = 0,
  maxDistance = 99,
  maxNumAttempts = 9,
  avoidTrees = true,
  extra = { x: 0, y: 0 },
}: {
  width?: number;
  height?: number;
  anchor?: Rect;
  minDistance?: number;
  maxDistance?: number;
  maxNumAttempts?: number;
  avoidTrees?: boolean;
  extra?: Point;
} = {}): Cell | undefined => {
  for (let attempt = 0; attempt < maxNumAttempts; attempt++) {
    const minX = Math.max(board.x, anchor.x - maxDistance);
    const maxX = Math.min(
      board.x + board.width - width + 1,
      anchor.x + anchor.width + maxDistance - width + 1,
    );
    const minY = Math.max(board.y, anchor.y - maxDistance);
    const maxY = Math.min(
      board.y + board.height - height + 1,
      anchor.y + anchor.height + maxDistance - height + 1,
    );

    const x = Math.floor(minX + Math.random() * (maxX - minX));
    const y = Math.floor(minY + Math.random() * (maxY - minY));
    const ex = x + extra.x;
    const ey = y + extra.y;

    // Too close to anchor
    if (
      x < anchor.x + anchor.width + minDistance - 1 &&
      x > anchor.x - minDistance - width + 1 &&
      y < anchor.y + anchor.height + minDistance - 1 &&
      y > anchor.y - minDistance - height + 1
    )
      continue;

    // Extra cell (startPath's outside endpoint) off the board
    if (
      ex < board.x ||
      ex > board.x + board.width - 1 ||
      ey < board.y ||
      ey > board.y + board.height - 1
    )
      continue;

    if (
      !isAreaFree({
        rect: { x, y, width, height } as Rect<Cell>,
        extra,
        avoidTrees,
      })
    )
      continue;

    return { x, y } as Cell;
  }

  return undefined;
};

// ─── Config ──────────────────────────────────────────────────────────────────

export interface ParkTypeConfig {
  color: string;
  /** Per-tick demand accumulation rate */
  demandRate: number;
  /** Fixed parking bay count (3 for normal, more for double parks) */
  parkingCapacity: number;
}

export interface SpawnEra {
  /** Era activates when totalUpdateCount >= startTick */
  startTick: number;
  /** House spawn attempts per cycle */
  housesPerCycle: number;
  /** Park spawn attempts per cycle */
  parkSpawnsPerCycle: number;
  /** Probability of a second house spawning in the same slot */
  burstChance: number;
  /** Only try to add a new park if houses > parks * this (0 = always try) */
  parkHouseRatioGate: number;
  /** Maximum number of distinct park type colors allowed in this era */
  maxActiveParkTypes: number;
  /** Demand rush wave amplitude */
  rushAmplitude: number;
  /** Demand spike chance per tick */
  demandSpikeChance: number;
  /** Demand spike intensity range [min, max] */
  demandSpikeRange: [number, number];
  /** Chance of spawning a double (two-color) park instead of a single */
  doubleParkChance: number;
}

export interface SpawningConfig {
  /** Park types in introduction order */
  parkTypes: ParkTypeConfig[];

  initialLoopLength: number;
  minLoopLength: number;
  loopCompressionPerCycle: number;

  /** Random jitter range for phase offsets (0..jitterRange) */
  jitterRange: number;

  /** House distance from anchor: max = min(base + parkCount, cap) */
  houseMaxDistanceBase: number;
  houseMaxDistanceCap: number;

  /** Max placement attempts before giving up */
  parkMaxPlacementAttempts: number;

  /** Ticks (at 15fps) of unfulfilled demand before game over */
  demandTimerMax: number;
  /** Ticks added to timer per successful commuter arrival */
  commuterTimerBonus: number;
  /** Ticks recovered per tick when demand === 0 */
  demandTimerRecovery: number;
  /** Max demand pins visible on a park; exceeding this forces the warn display */
  demandPinCap: number;

  /** Demand-coupled bonus house: average demand ratio threshold */
  demandCoupledThreshold: number;
  /** Demand-coupled bonus house only fires after this tick */
  demandCoupledStartTick: number;

  /** effectiveCapacity = base + log2(parkCount) */
  demandCapacityBase: number;
  /** Linear demand scaling: tick / this */
  demandLinearScaleDivisor: number;

  rushCycleLengthInitial: number;
  rushCycleLengthMin: number;
  /** Rush cycle shortens by 1 frame every this many ticks */
  rushCycleShrinkRate: number;
  /** Rush multiplier starts after this tick */
  rushStartTick: number;

  /** Chance of picking a random park for demand instead of the lowest-fill one */
  demandRandomTargetChance: number;

  /** Ticks between trending nomination attempts */
  trendingInterval: number;
  /** Trending challenge window in ticks */
  trendingWindow: number;
  /** Demand burst applied when a park starts trending */
  trendingDemandBurst: number;
  /** Minimum ticks a park must be alive (non-appearing) before it can trend */
  trendingMinAge: number;
  /** Weight multiplier for popular parks in demand targeting */
  popularDemandWeight: number;

  eras: SpawnEra[];
}

export const DEFAULT_CONFIG: SpawningConfig = {
  parkTypes: [
    { color: colors.car1, demandRate: 1 / 170, parkingCapacity: 3 },
    { color: colors.car2, demandRate: 1 / 180, parkingCapacity: 3 },
    { color: colors.car3, demandRate: 1 / 190, parkingCapacity: 3 },
  ],

  initialLoopLength: TIMING.spawnCycle,
  minLoopLength: TIMING.spawnCycle,
  loopCompressionPerCycle: 0,
  jitterRange: 200,

  houseMaxDistanceBase: 2,
  houseMaxDistanceCap: 6,

  parkMaxPlacementAttempts: 32,

  demandTimerMax: 600,
  commuterTimerBonus: 90,
  demandTimerRecovery: 3,
  demandPinCap: 12,

  demandCoupledThreshold: 0.6,
  demandCoupledStartTick: TIMING.difficulty.demandCoupledStart,

  demandCapacityBase: 2,
  demandLinearScaleDivisor: 50000,

  rushCycleLengthInitial: TIMING.difficulty.rushCycleInitial,
  rushCycleLengthMin: TIMING.difficulty.rushCycleMin,
  rushCycleShrinkRate: TIMING.difficulty.rushCycleShrinkRate,
  rushStartTick: TIMING.difficulty.rushStart,

  demandRandomTargetChance: 0.3,

  trendingInterval: TIMING.difficulty.trendingInterval,
  trendingWindow: TIMING.difficulty.trendingWindow,
  trendingDemandBurst: 6,
  trendingMinAge: TIMING.difficulty.trendingMinAge,
  popularDemandWeight: 2,

  eras: [
    {
      startTick: 0,
      housesPerCycle: 2,
      parkSpawnsPerCycle: 1,
      burstChance: 0,
      parkHouseRatioGate: 0,
      maxActiveParkTypes: 2,
      rushAmplitude: 1,
      demandSpikeChance: 0,
      demandSpikeRange: [1, 1],
      doubleParkChance: 0,
    },
    {
      startTick: TIMING.difficulty.era2Start,
      housesPerCycle: 2,
      parkSpawnsPerCycle: 1,
      burstChance: 0,
      parkHouseRatioGate: 2,
      maxActiveParkTypes: 3,
      rushAmplitude: 1.2,
      demandSpikeChance: 0,
      demandSpikeRange: [1.5, 2],
      doubleParkChance: 0,
    },
    {
      startTick: TIMING.difficulty.era3Start,
      housesPerCycle: 2,
      parkSpawnsPerCycle: 1,
      burstChance: 0.1,
      parkHouseRatioGate: 3,
      maxActiveParkTypes: 3,
      rushAmplitude: 1.5,
      demandSpikeChance: 0.05,
      demandSpikeRange: [1.5, 2.5],
      doubleParkChance: 0.25,
    },
    {
      startTick: TIMING.difficulty.era4Start,
      housesPerCycle: 3,
      parkSpawnsPerCycle: 2,
      burstChance: 0.2,
      parkHouseRatioGate: 3,
      maxActiveParkTypes: 3,
      rushAmplitude: 2.0,
      demandSpikeChance: 0.05,
      demandSpikeRange: [1.5, 3],
      doubleParkChance: 0.25,
    },
  ],
};

let activeConfig: SpawningConfig = DEFAULT_CONFIG;
export const getSpawningConfig = (): SpawningConfig => activeConfig;
export const setSpawningConfig = (c: SpawningConfig): void => {
  activeConfig = c;
};

// ─── Spawn factory ───────────────────────────────────────────────────────────
// The game wires in real entity constructors; the sim wires in lightweight stubs.

export interface ParkProps {
  x: number;
  y: number;
  width: number;
  height: number;
  borderColor: string;
  borderColors?: string[];
  relativePathPoints: Array<Point & { locked: boolean }>;
  delay: number;
  parkingCapacity: number;
}

export interface HouseProps {
  x: number;
  y: number;
  type: string;
  facing: Direction;
  style?: string;
}

export interface SpawnFactory {
  createPark(props: ParkProps): void;
  createHouse(props: HouseProps): void;
}

let factory: SpawnFactory | undefined;

export const setSpawnFactory = (f: SpawnFactory): void => {
  factory = f;
};

// ─── Module state ────────────────────────────────────────────────────────────

export let spawningLoopLength = DEFAULT_CONFIG.initialLoopLength;

/** Map-supplied hook to flavour house styles by position. Default = no style. */
let houseStylePicker: (x: number) => string | undefined = () => undefined;

export const setHouseStylePicker = (
  picker: (x: number) => string | undefined,
): void => {
  houseStylePicker = picker;
};

interface CycleAction {
  phase: number;
  kind: "park" | "houseNearBp" | "houseNearFriend" | "demandCoupled";
}
let cycleActions: CycleAction[] = [];
let houseFailed = false;
let houseRetryPhases: number[] = [];

export const getSpawningTelemetry = () => ({
  loopLength: spawningLoopLength,
  plannedActions: cycleActions.map((a) => ({ ...a })),
  houseFailed,
  houseRetryPhases: [...houseRetryPhases],
});

const DIRECTIONS: Direction[] = [
  { x: 0, y: -1 } as Direction,
  { x: 1, y: 0 } as Direction,
  { x: 0, y: 1 } as Direction,
  { x: -1, y: 0 } as Direction,
];

// ─── Utility helpers ─────────────────────────────────────────────────────────

const countOfType = (type: string): { houses: number; parks: number } => ({
  houses: houses.filter((h) => h.type === type).length,
  parks: businessParks.filter((p) => p.hasType(type)).length,
});

const activeColorsSet = (): Set<string> =>
  new Set(businessParks.flatMap((bp) => bp.types));

/** Remove trees sitting on the most-recently-added park's footprint. */
const pruneTreesUnderNewestPark = (): void => {
  const newPark = businessParks.at(-1);
  if (!newPark) return;
  for (const t of trees.filter((t) =>
    newPark.points.some((p) => p.x === t.x && p.y === t.y),
  )) {
    t.remove();
  }
};

// ─── Era ─────────────────────────────────────────────────────────────────────

export const getCurrentEra = (tick: number): SpawnEra =>
  activeConfig.eras.findLast((e) => tick >= e.startTick) ??
  activeConfig.eras[0]!;

// ─── Park type selection ─────────────────────────────────────────────────────

/** Returns the next un-introduced park type if it's allowed in this era. */
const pickNewParkType = (era: SpawnEra): ParkTypeConfig | undefined => {
  const active = activeColorsSet();
  if (active.size >= era.maxActiveParkTypes) return undefined;
  return activeConfig.parkTypes.find((pt) => !active.has(pt.color));
};

/** Returns the active type with the best house:park ratio, if > 1. */
const pickExistingTypeForExpansion = (): ParkTypeConfig | undefined => {
  const active = activeConfig.parkTypes.filter((pt) =>
    businessParks.some((bp) => bp.hasType(pt.color)),
  );
  if (!active.length) return undefined;

  let best: ParkTypeConfig | undefined;
  let bestRatio = -Infinity;
  for (const pt of active) {
    const { houses: h, parks: p } = countOfType(pt.color);
    const r = h / (p || 1);
    if (r > bestRatio) {
      bestRatio = r;
      best = pt;
    }
  }
  return bestRatio >= 1 ? best : undefined;
};

// ─── Park shape ──────────────────────────────────────────────────────────────

/** Compute locked inside + outside path points for a park of `width`×`height` with the
 *  entrance on `edge` (0=top, 1=right, 2=bottom, 3=left). */
const pickEntryPoints = (
  width: number,
  height: number,
  edge: number,
): Array<Point & { locked: boolean }> => {
  const vertical = edge === 0 || edge === 2;
  const along = Math.floor(Math.random() * (vertical ? width : height));
  const insideX = edge === 1 ? width - 1 : edge === 3 ? 0 : along;
  const insideY = edge === 2 ? height - 1 : edge === 0 ? 0 : along;
  const dx = edge === 1 ? 1 : edge === 3 ? -1 : 0;
  const dy = edge === 2 ? 1 : edge === 0 ? -1 : 0;
  return [
    { x: insideX, y: insideY, locked: true },
    { x: insideX + dx, y: insideY + dy, locked: true },
  ];
};

interface ParkShape {
  width: number;
  height: number;
  relativePathPoints: Array<Point & { locked: boolean }>;
}

const parkShape = (): ParkShape => {
  const edge = Math.floor(Math.random() * 4);
  return {
    width: 2,
    height: 2,
    relativePathPoints: pickEntryPoints(2, 2, edge),
  };
};

const singleParkShape = parkShape;
const doubleParkShape = parkShape;

// ─── Park placement ──────────────────────────────────────────────────────────

/** Pick an anchor: any house of one of `types`, else the most recent park, else undefined. */
const pickParkAnchor = (types: readonly string[]): Rect | undefined => {
  const matches = houses.filter((h) => types.includes(h.type));
  return pickRandom(matches) ?? businessParks.at(-1);
};

/** Shared placement for both single and double parks. Returns true on success. */
const placePark = ({
  shape,
  anchorTypes,
  borderColor,
  borderColors,
  parkingCapacity,
  delay,
  maxNumAttempts,
}: {
  shape: ParkShape;
  anchorTypes: readonly string[];
  borderColor: string;
  borderColors?: string[];
  parkingCapacity: number;
  delay: number;
  maxNumAttempts: number;
}): boolean => {
  const pos = getRandomPosition({
    width: shape.width,
    height: shape.height,
    anchor: pickParkAnchor(anchorTypes),
    maxDistance: businessParks.length + Math.max(board.width, board.height),
    minDistance: businessParks.length ? 2 : 0,
    maxNumAttempts,
    extra: shape.relativePathPoints[1]!,
    avoidTrees: false,
  });
  if (!pos) return false;

  factory!.createPark({
    width: shape.width,
    height: shape.height,
    x: pos.x,
    y: pos.y,
    borderColor,
    borderColors,
    relativePathPoints: shape.relativePathPoints,
    delay,
    parkingCapacity,
  });
  pruneTreesUnderNewestPark();
  return true;
};

const spawnPark = (
  era: SpawnEra,
  delay: number,
  maxNumAttempts: number,
): boolean => {
  // 1. Introduce a new type
  const newType = pickNewParkType(era);
  if (newType) {
    return placePark({
      shape: singleParkShape(),
      anchorTypes: [newType.color],
      borderColor: newType.color,
      parkingCapacity: newType.parkingCapacity,
      delay,
      maxNumAttempts,
    });
  }

  // 2. Expansion is ratio-gated
  if (houses.length <= businessParks.length * era.parkHouseRatioGate)
    return false;

  // 2a. Try a double park first when eligible
  const active = [...activeColorsSet()];
  if (active.length >= 2 && Math.random() < era.doubleParkChance) {
    const byPressure = active
      .map((c) => ({
        color: c,
        pressure: businessParks
          .filter((bp) => bp.hasType(c))
          .reduce((s, bp) => s + bp.demand, 0),
      }))
      .sort((a, b) => b.pressure - a.pressure);
    const [c1, c2] = [byPressure[0]!.color, byPressure[1]!.color];
    if (
      placePark({
        shape: doubleParkShape(),
        anchorTypes: [c1, c2],
        borderColor: c1,
        borderColors: [c1, c2],
        parkingCapacity: 4,
        delay,
        maxNumAttempts,
      })
    )
      return true;
  }

  // 2b. Fall back to single-park expansion
  const expandType = pickExistingTypeForExpansion();
  if (!expandType) return false;
  return placePark({
    shape: singleParkShape(),
    anchorTypes: [expandType.color],
    borderColor: expandType.color,
    parkingCapacity: expandType.parkingCapacity,
    delay,
    maxNumAttempts,
  });
};

// ─── House spawning ──────────────────────────────────────────────────────────

const houseMaxDistance = (): number =>
  Math.min(
    activeConfig.houseMaxDistanceBase + businessParks.length,
    activeConfig.houseMaxDistanceCap,
  );

const trySpawnHouse = (
  type: string,
  anchor: Rect,
  minDistance: number,
  maxDistance: number,
): boolean => {
  for (const facing of shuffle([...DIRECTIONS])) {
    const pos = getRandomPosition({
      anchor,
      minDistance,
      maxDistance,
      extra: facing,
    });
    if (pos) {
      factory!.createHouse({
        ...pos,
        type,
        facing,
        style: houseStylePicker(pos.x),
      });
      return true;
    }
  }
  return false;
};

/** For each BP, weight = 1 + avg over its types of (parkCount / (houseCount * 0.5 + 1)). */
const pickWeightedBusinessPark = () => {
  const typeBalance = (t: string): number => {
    const { houses: h, parks: p } = countOfType(t);
    return p / (h * 0.5 + 1);
  };
  const weights = businessParks.map(
    (bp) =>
      1 + bp.types.reduce((s, t) => s + typeBalance(t), 0) / bp.types.length,
  );
  return businessParks[weightedRandom(weights) ?? 0]!;
};

const trySpawnHouseNearBusinessPark = (): boolean => {
  if (!businessParks.length) return false;
  const bp = pickWeightedBusinessPark();
  const houseType = bp.types.length > 1 ? pickRandom(bp.types)! : bp.type;
  return trySpawnHouse(houseType, bp, 3, houseMaxDistance());
};

const trySpawnHouseNearFriend = (): boolean => {
  if (!businessParks.length) return false;

  // Pick the most house-starved active type
  const active = [...activeColorsSet()];
  const ratios = active.map((c) => {
    const { houses: h, parks: p } = countOfType(c);
    return p / (h + 1);
  });
  const type = active[weightedRandom(ratios) ?? 0]!;

  const sameTypeHouses = houses.filter((h) => h.type === type);
  if (!sameTypeHouses.length) {
    const typePark = pickRandom(businessParks.filter((bp) => bp.hasType(type)));
    if (!typePark) return false;
    return trySpawnHouse(type, typePark, 2, houseMaxDistance());
  }

  const friend = pickRandom(sameTypeHouses)!;
  return trySpawnHouse(
    type,
    { x: friend.x, y: friend.y, width: 1, height: 1 },
    1,
    Math.min(businessParks.length, 5),
  );
};

// ─── Cycle plan ──────────────────────────────────────────────────────────────

const buildCyclePlan = (tick: number): void => {
  const cfg = activeConfig;
  const era = getCurrentEra(tick);
  const loopLen = spawningLoopLength;
  const actionCount =
    era.parkSpawnsPerCycle +
    era.housesPerCycle +
    (tick > cfg.demandCoupledStartTick ? 1 : 0);
  const slotSize = Math.max(1, Math.floor(loopLen / (actionCount + 1)));
  const usedPhases = new Set<number>();

  cycleActions = [];

  const phaseForSlot = (slot: number): number => {
    const start = Math.min(loopLen - 1, slot * slotSize);
    const available = Math.max(1, Math.min(slotSize, loopLen - start));
    const jitter = Math.floor(Math.random() * Math.min(cfg.jitterRange, available));
    let phase = start + jitter;
    while (usedPhases.has(phase)) phase = (phase + 1) % loopLen;
    usedPhases.add(phase);
    return phase;
  };

  let slot = 0;
  for (let i = 0; i < era.parkSpawnsPerCycle; i++) {
    cycleActions.push({ phase: phaseForSlot(slot++), kind: "park" });
  }

  for (let i = 0; i < era.housesPerCycle; i++) {
    cycleActions.push({
      phase: phaseForSlot(slot++),
      kind: i % 2 === 0 ? "houseNearBp" : "houseNearFriend",
    });
  }

  if (tick > cfg.demandCoupledStartTick) {
    cycleActions.push({
      phase: phaseForSlot(slot++),
      kind: "demandCoupled",
    });
  }

  houseFailed = false;
  houseRetryPhases = [];
};

// ─── Public API ──────────────────────────────────────────────────────────────

export const resetSpawning = (): void => {
  spawningLoopLength = activeConfig.initialLoopLength;
  houseStylePicker = () => undefined;
  houseFailed = false;
  houseRetryPhases = [];
  buildCyclePlan(1);
};

export const spawnFirstBusinessPark = (delay: number): void => {
  const first = activeConfig.parkTypes[0];
  if (!first) return;
  placePark({
    shape: singleParkShape(),
    anchorTypes: [first.color],
    borderColor: first.color,
    parkingCapacity: first.parkingCapacity,
    delay,
    maxNumAttempts: 32,
  });
};

/** Run a house-spawn attempt and schedule retries if it failed. */
const runHouseAction = (
  attempt: () => boolean,
  era: SpawnEra,
  phase: number,
): void => {
  const ok = attempt();
  houseFailed = !ok;
  if (ok) {
    if (Math.random() < era.burstChance) attempt();
  } else {
    const retryGap = Math.max(1, Math.floor(spawningLoopLength / 3));
    houseRetryPhases = [
      (phase + retryGap) % spawningLoopLength,
      (phase + retryGap * 2) % spawningLoopLength,
    ];
  }
};

export const spawnNewObjects = (updateCount: number, delay: number): void => {
  const cfg = activeConfig;
  const era = getCurrentEra(updateCount);
  const phase = updateCount % spawningLoopLength;

  if (cycleActions.length === 0) buildCyclePlan(updateCount);

  if (phase === 0) {
    spawningLoopLength = Math.max(
      cfg.minLoopLength,
      spawningLoopLength - cfg.loopCompressionPerCycle,
    );
    buildCyclePlan(updateCount);
  }

  // Retry a failed house spawn from an earlier phase in this cycle.
  if (houseRetryPhases.includes(phase)) {
    houseRetryPhases = houseRetryPhases.filter((p) => p !== phase);
    if (houseFailed) {
      const ok = trySpawnHouseNearBusinessPark();
      houseFailed = !ok;
      if (ok && Math.random() < era.burstChance)
        trySpawnHouseNearBusinessPark();
    }
    return;
  }

  const action = cycleActions.find((a) => a.phase === phase);
  if (!action) return;

  switch (action.kind) {
    case "park":
      spawnPark(era, delay, cfg.parkMaxPlacementAttempts);
      break;
    case "houseNearBp":
      runHouseAction(trySpawnHouseNearBusinessPark, era, phase);
      break;
    case "houseNearFriend":
      runHouseAction(trySpawnHouseNearFriend, era, phase);
      break;
    case "demandCoupled": {
      const avgTimerRatio =
        businessParks.length === 0
          ? 1
          : businessParks.reduce(
              (s, bp) =>
                s + (bp.appearing ? 1 : bp.demandTimer / cfg.demandTimerMax),
              0,
            ) / businessParks.length;
      if (avgTimerRatio < cfg.demandCoupledThreshold) {
        trySpawnHouseNearBusinessPark();
      }
      break;
    }
  }
};
