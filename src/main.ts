/// <reference types="vite/client" />
import { GameLoop } from "kontra";

import type { AudioMode } from "./audio";
import { initAudio, startGameMusic } from "./audio";
import { BusinessPark } from "./entities/business-park";
import { House } from "./entities/house";
import { bootMenu, gameState, initGameFlow } from "./game-flow";
import { gridLockToggle } from "./input/grid-toggle";
import { initPointer } from "./input/pointer";
import { renderWorld, tickWorld } from "./logic/orchestrator";
import { setSpawnFactory } from "./logic/spawning";
import { TIMING } from "./logic/timing";
import { addBusinessPark, addHouse } from "./state";
import { initTelemetry } from "./telemetry";
import {
  audioModeButton,
  gridToggleButton,
  gridToggleTooltip,
  helpButton,
  helpCloseButton,
  helpOverlay,
  helpPanel,
  initUi,
  pauseButton,
  pauseSvgPath,
  setAudioModeButton,
} from "./ui/ui";

interface HmrData {
  initialized?: boolean;
  gameStarted?: boolean;
  totalUpdateCount?: number;
  updateCount?: number;
  renderCount?: number;
  gameOverlayHidden?: boolean;
}

declare global {
  interface Window {
    __landoLoopToken?: symbol;
  }
}

const hmrData = import.meta.hot?.data as HmrData | undefined;
const loopToken = Symbol("lando-loop");
window.__landoLoopToken = loopToken;

// On HMR reloads, restore counters saved by the previous module instance.
if (hmrData?.initialized) {
  gameState.gameStarted = hmrData.gameStarted ?? false;
  gameState.totalUpdateCount = hmrData.totalUpdateCount ?? 0;
  gameState.updateCount = hmrData.updateCount ?? 0;
  gameState.renderCount = hmrData.renderCount ?? 0;
  gameState.gameOverlayHidden = hmrData.gameOverlayHidden ?? false;
}

const loop = GameLoop({
  blur: true,
  clearCanvas: false,
  update: () => {
    if (window.__landoLoopToken === loopToken) tickWorld(loop);
  },
  render: () => {
    if (window.__landoLoopToken === loopToken) renderWorld();
  },
});

const isHmr = hmrData?.initialized === true;

// initUi injects a <style> element; initPointer adds permanent DOM listeners —
// only safe to call once, skip on hot reloads.
initTelemetry();
initAudio();

if (!isHmr) {
  initUi();
  initPointer();
}

initGameFlow(loop);
if (isHmr && gameState.gameStarted) startGameMusic();
setSpawnFactory({
  createPark: (p) => {
    addBusinessPark(new BusinessPark({ ...p }));
  },
  createHouse: (p) => {
    addHouse(new House({ ...p }));
  },
});

if (!isHmr) bootMenu();

const togglePause = (): void => {
  if (gameState.gameStarted && gameState.totalUpdateCount > TIMING.hud.pause) {
    if (loop.isStopped) {
      loop.start();
      pauseSvgPath.setAttribute("d", "M6 6 6 10M10 6 10 8 10 10");
      pauseSvgPath.style.transform = "rotate(180deg)";
    } else {
      loop.stop();
      pauseSvgPath.setAttribute("d", "M7 6 7 10M7 6 10 8 7 10");
      pauseSvgPath.style.transform = "rotate(0)";
    }
  }
};

const ac = new AbortController();
const { signal } = ac;

const isAudioMode = (mode: unknown): mode is AudioMode =>
  mode === "all" || mode === "muted" || mode === "music" || mode === "sfx";

let helpOpen = false;
let resumeAfterHelp = false;

const openHelp = (): void => {
  if (helpOpen) return;
  helpOpen = true;
  resumeAfterHelp = gameState.gameStarted && !loop.isStopped;
  if (resumeAfterHelp) loop.stop();
  helpOverlay.setAttribute("aria-hidden", "false");
  helpOverlay.style.pointerEvents = "all";
  helpOverlay.style.opacity = "1";
  helpPanel.style.transform = "translateY(0) scale(1)";
};

const closeHelp = (): void => {
  if (!helpOpen) return;
  helpOpen = false;
  helpOverlay.setAttribute("aria-hidden", "true");
  helpOverlay.style.pointerEvents = "none";
  helpOverlay.style.opacity = "0";
  helpPanel.style.transform = "translateY(10px) scale(.98)";
  if (resumeAfterHelp && gameState.gameStarted) loop.start();
  resumeAfterHelp = false;
};

pauseButton.addEventListener("click", togglePause, { signal });
gridToggleButton.addEventListener("click", gridLockToggle, { signal });
gridToggleTooltip.addEventListener("click", () => gridToggleButton.click(), {
  signal,
});
helpButton.addEventListener("click", openHelp, { signal });
helpCloseButton.addEventListener("click", closeHelp, { signal });
helpOverlay.addEventListener(
  "click",
  (event) => {
    if (event.target === helpOverlay) closeHelp();
  },
  { signal },
);
audioModeButton.addEventListener(
  "click",
  () => {
    const mode = window.__landoAudioApi?.cycleMode();
    if (mode) setAudioModeButton(mode);
  },
  { signal },
);
setAudioModeButton(window.__landoAudioApi?.currentMode() ?? "all");
window.addEventListener(
  "lando-audio-mode-change",
  (event) => {
    const { mode } = (event as CustomEvent<{ mode?: unknown }>).detail;
    if (isAudioMode(mode)) {
      setAudioModeButton(mode);
    }
  },
  { signal },
);

document.addEventListener(
  "keypress",
  (event) => {
    if (helpOpen) return;
    if (event.key === " ") {
      // Prevent double-toggling when the pause button itself has focus.
      if (event.target !== pauseButton) togglePause();
      pauseButton.style.transform = "scale(.95)";
      setTimeout(() => (pauseButton.style.transform = ""), 150);
    }
  },
  { signal },
);
document.addEventListener(
  "keydown",
  (event) => {
    if (event.key === "Escape") closeHelp();
  },
  { signal },
);

if (!isHmr) {
  setTimeout(() => {
    loop.start();
  }, 1000);
} else {
  loop.start();
}

if (import.meta.hot) {
  import.meta.hot.dispose((data) => {
    const d = data as HmrData;
    d.initialized = true;
    d.gameStarted = gameState.gameStarted;
    d.totalUpdateCount = gameState.totalUpdateCount;
    d.updateCount = gameState.updateCount;
    d.renderCount = gameState.renderCount;
    d.gameOverlayHidden = gameState.gameOverlayHidden;
    ac.abort();
    loop.stop();
    if (window.__landoLoopToken === loopToken)
      window.__landoLoopToken = undefined;
  });
  import.meta.hot.accept();
}
