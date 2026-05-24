import { seconds, TIMING } from "./timing";

export interface BusinessParkDemandProfile {
  /** Permanent BP personality: higher means this park wants more visits overall. */
  baseIntensity: number;
  /** Local sine pulse amplitude around the base intensity. */
  pulseAmplitude: number;
  /** Pulse period in ticks; intentionally per-BP to avoid global sync. */
  pulsePeriod: number;
  /** Random phase offset in ticks. */
  pulsePhase: number;
  /** How strongly this BP reacts to macro rush pressure. */
  rushAffinity: number;
  /** How strongly this BP reacts to spatial demand waves. */
  localWaveAffinity: number;
  /** How much poor service quality feeds back into new pressure. */
  performanceSensitivity: number;
  /** Individual patience: higher values drain the warning timer faster. */
  timerDrainMultiplier: number;
  /** Individual gratitude: higher values recover more timer on arrival. */
  serviceRewardMultiplier: number;
}

export interface DemandProfileConfig {
  baseIntensityRange: [number, number];
  pulseAmplitudeRange: [number, number];
  pulsePeriodRange: [number, number];
  rushAffinityRange: [number, number];
  localWaveAffinityRange: [number, number];
  performanceSensitivityRange: [number, number];
  timerDrainMultiplierRange: [number, number];
  serviceRewardMultiplierRange: [number, number];
}

export interface LocalDemandWaveConfig {
  enabled: boolean;
  startTick: number;
  maxActive: number;
  spawnChancePerDemandTick: number;
  durationRange: [number, number];
  radiusRange: [number, number];
  intensityRange: [number, number];
  rushSpawnBoost: number;
  rushIntensityBoost: number;
  affectedColorChance: number;
  centerJitterRadius: number;
  falloffPower: number;
}

export interface DemandPerformanceConfig {
  reactionStrength: number;
  timerStressWeight: number;
  unservedStressWeight: number;
  activeFulfillmentRelief: number;
  maxStress: number;
  minMultiplier: number;
  maxMultiplier: number;
}

export interface DemandFactorConfig {
  minParkFactor: number;
  maxParkFactor: number;
  meanFactorMin: number;
  meanFactorMax: number;
  macroRushBaselineShare: number;
}

export interface DemandStackLimitConfig {
  /** Max visible/actual demand per BP at the beginning. */
  initialMax: number;
  /** Late-game max demand per BP. Usually matches the pin cap. */
  finalMax: number;
  /** Tick where the cap starts growing. */
  growthStartTick: number;
  /** Ticks from growthStartTick until finalMax is reached. */
  growthDuration: number;
}

export interface DemandModelConfig {
  profile: DemandProfileConfig;
  localWaves: LocalDemandWaveConfig;
  performance: DemandPerformanceConfig;
  factors: DemandFactorConfig;
  stackLimit: DemandStackLimitConfig;
}

export const readDemandStackLimit = (
  limit: DemandStackLimitConfig,
  tick: number,
): number => {
  const progress =
    limit.growthDuration <= 0
      ? 1
      : Math.max(
          0,
          Math.min(1, (tick - limit.growthStartTick) / limit.growthDuration),
        );
  const eased = progress * progress * (3 - 2 * progress);
  return Math.round(limit.initialMax + (limit.finalMax - limit.initialMax) * eased);
};

export const DEFAULT_DEMAND_MODEL: DemandModelConfig = {
  profile: {
    baseIntensityRange: [0.74, 1.34],
    pulseAmplitudeRange: [0.06, 0.34],
    pulsePeriodRange: [seconds(38), seconds(112)],
    rushAffinityRange: [0.25, 1.35],
    localWaveAffinityRange: [0.45, 1.45],
    performanceSensitivityRange: [0.35, 1.25],
    timerDrainMultiplierRange: [0.85, 1.18],
    serviceRewardMultiplierRange: [0.9, 1.18],
  },
  localWaves: {
    enabled: true,
    startTick: TIMING.difficulty.rushStart,
    maxActive: 3,
    spawnChancePerDemandTick: 0.0015,
    durationRange: [seconds(35), seconds(85)],
    radiusRange: [4.5, 8.5],
    intensityRange: [0.32, 0.92],
    rushSpawnBoost: 0.75,
    rushIntensityBoost: 0.3,
    affectedColorChance: 0.65,
    centerJitterRadius: 2.2,
    falloffPower: 1.7,
  },
  performance: {
    reactionStrength: 0.42,
    timerStressWeight: 1.1,
    unservedStressWeight: 0.34,
    activeFulfillmentRelief: 0.12,
    maxStress: 2.4,
    minMultiplier: 0.65,
    maxMultiplier: 1.85,
  },
  factors: {
    minParkFactor: 0.35,
    maxParkFactor: 2.75,
    meanFactorMin: 0.78,
    meanFactorMax: 1.85,
    macroRushBaselineShare: 0.12,
  },
  stackLimit: {
    initialMax: 3,
    finalMax: 12,
    growthStartTick: seconds(90),
    growthDuration: seconds(18 * 60),
  },
};
