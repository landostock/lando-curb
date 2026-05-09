import type { BusinessPark } from "../entities/business-park";
import { businessParks, commuters } from "../state";
import { getCurrentEra, getSpawningConfig } from "./spawning";

const SPIKE_COOLDOWN = 120;

let budgets = new Map<
  string,
  { accumulator: number; demandRate: number; spikeCooldown: number }
>();

export function initDemandBudgets(): void {
  budgets = new Map();
  for (const pt of getSpawningConfig().parkTypes) {
    budgets.set(pt.color, {
      accumulator: 0,
      demandRate: pt.demandRate,
      spikeCooldown: 0,
    });
  }
}

export function resetDemandBudgets(): void {
  for (const b of budgets.values()) {
    b.accumulator = 0;
    b.spikeCooldown = 0;
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

    b.accumulator +=
      (capacity + tick / cfg.demandLinearScaleDivisor) *
      rush *
      spike *
      b.demandRate *
      Math.min(1, idle / 2);

    while (b.accumulator >= 1) {
      b.accumulator--;
      pickPark(parks, cfg.demandRandomTargetChance).demand++;
    }
  }
}

function pickPark(parks: BusinessPark[], randomChance: number): BusinessPark {
  if (Math.random() < randomChance) {
    // Popular parks get higher weight in random selection
    const cfg = getSpawningConfig();
    const weights = parks.map((bp) =>
      bp.popular ? cfg.popularDemandWeight : 1,
    );
    const total = weights.reduce((s, w) => s + w, 0);
    let r = Math.random() * total;
    for (let i = 0; i < parks.length; i++) {
      r -= weights[i]!;
      if (r <= 0) return parks[i]!;
    }
    return parks[parks.length - 1]!;
  }
  let best = parks[0]!;
  for (let i = 1; i < parks.length; i++) {
    if (parks[i]!.demand < best.demand) best = parks[i]!;
  }
  return best;
}
