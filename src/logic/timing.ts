export const TICKS_PER_SECOND = 60;

export const seconds = (value: number): number =>
  Math.round(value * TICKS_PER_SECOND);

export const minutes = (value: number): number => seconds(value * 60);

export const TIMING = {
  spawnCycle: minutes(1),
  upgradeCycle: minutes(1),
  boardGrowthCheck: seconds(1),
  demandCheck: 4,
  streetCleanupCheck: 15,
  hud: {
    score: seconds(2),
    inventory: seconds(2.5),
    clock: seconds(3),
    pause: seconds(3.5),
  },
  difficulty: {
    demandCoupledStart: minutes(5),
    rushStart: minutes(3),
    rushCycleInitial: minutes(1),
    rushCycleMin: seconds(30),
    rushCycleShrinkRate: minutes(5),
    trendingInterval: minutes(5),
    trendingWindow: minutes(1),
    trendingMinAge: minutes(4),
    era2Start: minutes(5),
    era3Start: minutes(12),
    era4Start: minutes(25),
  },
} as const;
