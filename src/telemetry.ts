import { board, grid } from "./board";
import { gameState } from "./game-flow";
import { svgElement } from "./gfx/svg";
import {
  getCurrentEra,
  getSpawningTelemetry,
  spawningLoopLength,
} from "./logic/spawning";
import { TIMING } from "./logic/timing";
import {
  businessParks,
  commuters,
  houses,
  lakes,
  session,
  streets,
  trees,
} from "./state";

interface TelemetrySnapshot {
  tick: number;
  gameStarted: boolean;
  counts: {
    businessParks: number;
    houses: number;
    commuters: number;
    streets: number;
    lakes: number;
    trees: number;
    entitiesForGrowth: number;
  };
  pressure: {
    totalDemand: number;
    unservedDemand: number;
    lowestDemandTimer: number | null;
    warningParks: number;
  };
  board: {
    x: number;
    y: number;
    width: number;
    height: number;
    growthRatio: number;
    nextGrowthTickIn: number;
  };
  grid: {
    width: number;
    height: number;
  };
  viewBox: string | null;
  spawning: {
    loopLength: number;
    phase: number;
    eraStartTick: number;
    upgradeCycle: number;
    plannedActions: Array<{ phase: number; kind: string }>;
    houseRetryPhases: number[];
  };
  session: {
    paths: number;
    motorways: number;
    bridges: number;
    pickups: number;
  };
  note: string;
}

interface TelemetryApi {
  snapshot: () => TelemetrySnapshot;
  setVisible: (visible: boolean) => void;
  toggle: () => void;
}

declare global {
  interface Window {
    __landoTelemetry?: TelemetryApi;
    __landoTelemetryKeyBound?: boolean;
  }
}

const maxGrowthEntities = 60;
let panel: HTMLPreElement | undefined;
let latestTick = 0;
let visible =
  new URLSearchParams(location.search).has("telemetry") ||
  localStorage.getItem("lando.telemetry") === "1";

const cloneSession = () => ({
  paths: session.paths,
  motorways: session.motorways,
  bridges: session.bridges,
  pickups: session.pickups,
});

const nextGrowthTickIn = (tick: number): number => {
  const mod = tick % 60;
  return mod === 0 ? 0 : 60 - mod;
};

const buildNote = (entityCount: number): string => {
  if (!gameState.gameStarted) return "Menu or gameover: board growth is paused.";
  if (entityCount >= maxGrowthEntities) return "Board is at maximum growth.";
  return "Board growth is driven by houses + business parks, not by time alone.";
};

export const getTelemetrySnapshot = (): TelemetrySnapshot => {
  const entityCount = houses.length + businessParks.length;
  const tick = gameState.totalUpdateCount;
  const era = getCurrentEra(tick);
  const spawning = getSpawningTelemetry();
  const demandTimers = businessParks
    .filter((bp) => !bp.appearing)
    .map((bp) => bp.demandTimer);
  const unservedDemand = businessParks.reduce(
    (sum, bp) => sum + Math.max(0, bp.demand - bp.activeFulfillmentCount),
    0,
  );

  return {
    tick,
    gameStarted: gameState.gameStarted,
    counts: {
      businessParks: businessParks.length,
      houses: houses.length,
      commuters: commuters.length,
      streets: streets.length,
      lakes: lakes.length,
      trees: trees.length,
      entitiesForGrowth: entityCount,
    },
    pressure: {
      totalDemand: businessParks.reduce((sum, bp) => sum + bp.demand, 0),
      unservedDemand,
      lowestDemandTimer: demandTimers.length ? Math.min(...demandTimers) : null,
      warningParks: businessParks.filter((bp) => bp.hasWarn).length,
    },
    board: {
      x: board.x,
      y: board.y,
      width: board.width,
      height: board.height,
      growthRatio: Math.min(1, entityCount / maxGrowthEntities),
      nextGrowthTickIn: nextGrowthTickIn(tick),
    },
    grid: {
      width: grid.width,
      height: grid.height,
    },
    viewBox: svgElement.getAttribute("viewBox"),
    spawning: {
      loopLength: spawningLoopLength,
      phase: tick % spawningLoopLength,
      eraStartTick: era.startTick,
      upgradeCycle: TIMING.upgradeCycle,
      plannedActions: spawning.plannedActions,
      houseRetryPhases: spawning.houseRetryPhases,
    },
    session: cloneSession(),
    note: buildNote(entityCount),
  };
};

const formatSnapshot = (s: TelemetrySnapshot): string =>
  [
    "Lando telemetry  (T hides this)",
    `tick: ${s.tick}  started: ${s.gameStarted}`,
    `entities: ${s.counts.entitiesForGrowth}/60`,
    `parks: ${s.counts.businessParks}  houses: ${s.counts.houses}  cars: ${s.counts.commuters}`,
    `demand: ${s.pressure.totalDemand}  unserved: ${s.pressure.unservedDemand}  warnings: ${s.pressure.warningParks}`,
    `lowest timer: ${s.pressure.lowestDemandTimer ?? "none"}`,
    `board: ${s.board.width}x${s.board.height} @ ${s.board.x},${s.board.y}`,
    `growth: ${(s.board.growthRatio * 100).toFixed(1)}%  next check: ${s.board.nextGrowthTickIn}`,
    `viewBox: ${s.viewBox ?? "none"}`,
    `spawn loop: ${s.spawning.phase}/${s.spawning.loopLength}  era: ${s.spawning.eraStartTick}`,
    `upgrade cycle: ${s.spawning.upgradeCycle} ticks`,
    `planned: ${
      s.spawning.plannedActions.length
        ? s.spawning.plannedActions
            .map((a) => `${a.kind}@${a.phase}`)
            .join(", ")
        : "none"
    }`,
    `retries: ${s.spawning.houseRetryPhases.join(", ") || "none"}`,
    `paths: ${s.session.paths}  motorways: ${s.session.motorways}  bridges: ${s.session.bridges}`,
    s.note,
  ].join("\n");

const ensurePanel = (): HTMLPreElement => {
  if (panel) return panel;

  const existing = document.getElementById("lando-telemetry");
  if (existing instanceof HTMLPreElement) {
    panel = existing;
    return panel;
  }

  panel = document.createElement("pre");
  panel.id = "lando-telemetry";
  panel.style.cssText = `
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 20;
    max-width: min(480px, calc(100vw - 24px));
    margin: 0;
    padding: 10px 12px;
    border: 1px solid #0005;
    border-radius: 8px;
    background: #fffe;
    color: #222;
    font: 12px/1.35 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    white-space: pre-wrap;
    pointer-events: none;
    box-shadow: 0 4px 16px #0002;
  `;
  document.body.append(panel);
  return panel;
};

const setVisible = (nextVisible: boolean): void => {
  visible = nextVisible;
  localStorage.setItem("lando.telemetry", visible ? "1" : "0");
  const el = ensurePanel();
  el.style.display = visible ? "" : "none";
  el.innerText = formatSnapshot(getTelemetrySnapshot());
};

const toggle = (): void => {
  setVisible(!visible);
};

export const initTelemetry = (): void => {
  window.__landoTelemetry = {
    snapshot: getTelemetrySnapshot,
    setVisible,
    toggle,
  };

  setVisible(visible);

  if (window.__landoTelemetryKeyBound) return;
  window.__landoTelemetryKeyBound = true;

  document.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() !== "t") return;
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement
    )
      return;
    toggle();
  });
};

export const updateTelemetry = (tick = gameState.totalUpdateCount): void => {
  latestTick = tick;
  const s = getTelemetrySnapshot();
  const el = ensurePanel();
  el.dataset.tick = String(latestTick);
  el.dataset.snapshot = JSON.stringify(s);
  if (visible) el.innerText = formatSnapshot(s);
};
