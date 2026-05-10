import { playUpgradeReadyFanfare } from "../audio";
import { growBoard } from "../board";
import { rerouteAllCommuters } from "../entities/commuter";
import { drawStreets } from "../entities/street.render";
import { checkGameOver, gameState } from "../game-flow";
import { updateGridBounds } from "../gfx/grid";
import { updateViewBox } from "../gfx/svg";
import { businessParks, commuters, houses } from "../state";
import { updateTelemetry } from "../telemetry";
import {
  clock,
  fireUpgradeCharge,
  motorwayIndicator,
  pathTilesIndicator,
  pauseButton,
  resetUpgradeCharge,
  scoreCounters,
  setGameplayControlsVisible,
  setUpgradeCharge,
} from "../ui/ui";
import { showUpgradePicker } from "../ui/upgrades";
import { pickRandom } from "../util/random";
import { updateTrafficGrid } from "./commuter-spatial-index";
import { tickDemandBudgets } from "./demand-budget";
import { updateGridData } from "./find-route";
import { cleanupPendingStreets } from "./remove-street";
import { getSpawningConfig, spawnNewObjects } from "./spawning";
import { TIMING } from "./timing";

/** Structural handle for the game loop — decouples this module from kontra. */
interface LoopControl {
  stop: () => void;
  start: () => void;
}

let upgradePickerOpen = false;
let lastUpgradeTick = -1;
let nextUpgradeTick: number | undefined;
let upgradeInterval = TIMING.upgradeCycle;
let lastGameplayTick = -1;

// ─── Street-graph commit ──────────────────────────────────────────────

/**
 * After any mutation to `streets[]` (add, mark-pending, or remove), re-render the SVG,
 * rebuild the routing graph, and reroute non-atWork commuters whose route might have
 * improved. Pass `forceAtWork = true` only when you also want to eject parked commuters
 * (e.g. admin / reset flows). Player-initiated changes use the default `false`.
 */
export const commitStreetChanges = (forceAtWork = false): void => {
  drawStreets();
  updateGridData();
  rerouteAllCommuters(forceAtWork);
};

// ─── Tick phases ──────────────────────────────────────────────────────

const revealHudMilestones = (tick: number): void => {
  if (tick === TIMING.hud.score) scoreCounters.style.opacity = "1";
  if (tick === TIMING.hud.inventory) {
    pathTilesIndicator.style.opacity = "1";
    motorwayIndicator.style.opacity = "1";
    setGameplayControlsVisible(true);
  }
  if (tick === TIMING.hud.clock) clock.style.opacity = "1";
  if (tick === TIMING.hud.pause) pauseButton.style.opacity = "1";
};

const maybeNominateTrending = (tick: number): void => {
  const cfg = getSpawningConfig();
  if (tick % cfg.trendingInterval !== 0 || tick <= cfg.trendingMinAge) return;
  if (businessParks.some((bp) => bp.trending)) return;
  const eligible = businessParks.filter(
    (bp) =>
      !bp.appearing &&
      !bp.popular &&
      !bp.trending &&
      bp.age >= cfg.trendingMinAge,
  );
  pickRandom(eligible)?.startTrending();
};

const ensureUpgradeSchedule = (tick: number): void => {
  if (nextUpgradeTick !== undefined) return;
  upgradeInterval = TIMING.upgradeCycle;
  nextUpgradeTick = tick + upgradeInterval;
};

const scheduleNextUpgrade = (tick: number): void => {
  upgradeInterval = TIMING.upgradeCycle;
  nextUpgradeTick = tick + upgradeInterval;
};

const resetUpgradeSchedule = (tick: number): void => {
  upgradePickerOpen = false;
  lastUpgradeTick = -1;
  upgradeInterval = TIMING.upgradeCycle;
  nextUpgradeTick = tick + upgradeInterval;
  resetUpgradeCharge();
};

const maybeShowUpgradePicker = (tick: number, loop: LoopControl): void => {
  ensureUpgradeSchedule(tick);
  if (nextUpgradeTick === undefined || tick < nextUpgradeTick) return;
  if (upgradePickerOpen || tick === lastUpgradeTick) return;
  lastUpgradeTick = tick;
  scheduleNextUpgrade(tick);
  loop.stop();
  fireUpgradeCharge();
  playUpgradeReadyFanfare();
  upgradePickerOpen = showUpgradePicker(() => {
    upgradePickerOpen = false;
    loop.start();
  });
  if (!upgradePickerOpen) loop.start();
};

const maybeGrowBoard = (tick: number): void => {
  if (tick % TIMING.boardGrowthCheck !== 0) return;
  const entityCount = houses.length + businessParks.length;
  growBoard(entityCount);
  updateGridBounds();
  updateViewBox(entityCount);
};

const updateClock = (tick: number): void => {
  ensureUpgradeSchedule(tick);
  if (nextUpgradeTick === undefined) return;
  const remaining = Math.max(0, nextUpgradeTick - tick);
  setUpgradeCharge(1 - remaining / upgradeInterval);
};

const runGameplayPhase = (loop: LoopControl): void => {
  const tick = gameState.totalUpdateCount;
  if (tick <= 1 || tick < lastGameplayTick) resetUpgradeSchedule(tick);
  lastGameplayTick = tick;
  spawnNewObjects(tick, 1);
  revealHudMilestones(tick);
  maybeNominateTrending(tick);
  maybeShowUpgradePicker(tick, loop);
  maybeGrowBoard(tick);
  updateClock(tick);
};

const runScheduledPhases = (): void => {
  // Quarter-rate phases — CSS transitions handle motion at browser FPS anyway.
  if (gameState.updateCount % TIMING.demandCheck === 0) {
    updateGridData();
  } else if (gameState.updateCount % TIMING.demandCheck === 1) {
    if (gameState.gameStarted) tickDemandBudgets(gameState.totalUpdateCount);
    businessParks.forEach((bp) =>
      bp.tick(gameState.gameStarted, gameState.totalUpdateCount),
    );
  }
  if (gameState.updateCount % TIMING.streetCleanupCheck === 0)
    cleanupPendingStreets();
};

// ─── Public loop callbacks ────────────────────────────────────────────

/** One frame of game logic. Wire this as the `update` callback on the GameLoop. */
export const tickWorld = (loop: LoopControl): void => {
  if (gameState.gameStarted) runGameplayPhase(loop);

  gameState.updateCount++;
  gameState.totalUpdateCount++;

  runScheduledPhases();

  if (gameState.updateCount >= 60) gameState.updateCount = 0;

  checkGameOver();
  updateTelemetry(gameState.totalUpdateCount);

  updateTrafficGrid();
  for (const c of commuters) c.update();
};

/** One frame of rendering. Wire this as the `render` callback on the GameLoop. */
export const renderWorld = (): void => {
  gameState.renderCount++;

  // Rate-limited — BP visuals transition at browser FPS via CSS anyway.
  if (gameState.renderCount % 4 === 1) {
    for (const bp of businessParks) bp.render();
  }

  if (gameState.renderCount >= 60) gameState.renderCount = 0;

  for (const c of commuters) c.render();
};
