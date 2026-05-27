/// <reference types="vite/client" />
import { GameLoop } from "kontra";

import type { AudioMode } from "./audio";
import { initAudio, playSpeedToggleSound, startGameMusic } from "./audio";
import { BusinessPark } from "./entities/business-park";
import { House } from "./entities/house";
import {
  bootMenu,
  gameState,
  initGameFlow,
  restartCurrentRun,
  returnToMenu,
} from "./game-flow";
import { gridLockToggle, gridRedLockToggle } from "./input/grid-toggle";
import { initPointer } from "./input/pointer";
import { renderWorld, tickWorld } from "./logic/orchestrator";
import { setSpawnFactory } from "./logic/spawning";
import { TIMING } from "./logic/timing";
import { addBusinessPark, addHouse } from "./state";
import { initTelemetry } from "./telemetry";
import { gameoverWrapper } from "./ui/gameover";
import {
  closeHomeActions,
  initHomeActions,
  isHomeActionActive,
  startHomeActionSwap,
} from "./ui/home-actions";
import {
  hideSessionMenu,
  initSessionMenu,
  isSessionMenuOpen,
  showSessionMenu,
} from "./ui/session-menu";
import {
  audioModeButton,
  canChangeGameSpeed,
  chooseGameSpeed,
  clock,
  cycleGameSpeed,
  type GameSpeed,
  gameSpeed,
  gridRedToggleButton,
  gridRedToggleTooltip,
  gridToggleButton,
  gridToggleTooltip,
  helpButton,
  helpCloseButton,
  helpMenuButton,
  helpOverlay,
  helpPanel,
  initUi,
  pauseButton,
  pauseSvgPath,
  requestDeveloperModeAccess,
  scoreCounters,
  setAudioModeButton,
  toggleDeveloperModeAccess,
} from "./ui/ui";

interface HmrData {
  initialized?: boolean;
  gameStarted?: boolean;
  totalUpdateCount?: number;
  updateCount?: number;
  renderCount?: number;
  paused?: boolean;
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
  gameState.paused = hmrData.paused ?? false;
  gameState.gameOverlayHidden = hmrData.gameOverlayHidden ?? false;
}

const loop = GameLoop({
  blur: true,
  clearCanvas: false,
  update: () => {
    if (window.__landoLoopToken !== loopToken) return;
    for (let i = 0; i < gameSpeed; i++) {
      tickWorld(loop);
      if (loop.isStopped) break;
    }
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
  initHomeActions();
  initSessionMenu({
    onContinue: () => {
      closeInGameMenu();
    },
    onRestart: () => {
      hideSessionMenu();
      closeHomeActions();
      setPauseVisual(false);
      restartCurrentRun();
    },
    onMainMenu: () => {
      hideSessionMenu();
      closeHomeActions();
      setPauseVisual(false);
      returnToMenu();
    },
  });
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

const setPauseVisual = (paused: boolean): void => {
  if (paused) {
    pauseSvgPath.setAttribute("d", "M7 6 7 10M7 6 10 8 7 10");
    pauseSvgPath.style.transform = "rotate(0)";
  } else {
    pauseSvgPath.setAttribute("d", "M6 6 6 10M10 6 10 8 10 10");
    pauseSvgPath.style.transform = "rotate(180deg)";
  }
};

const togglePause = (): void => {
  if (gameState.gameStarted && gameState.totalUpdateCount > TIMING.hud.pause) {
    if (loop.isStopped) {
      loop.start();
      gameState.paused = false;
      setPauseVisual(false);
    } else {
      loop.stop();
      gameState.paused = true;
      setPauseVisual(true);
    }
  }
};

const openInGameMenu = ({ allowStopped = false } = {}): void => {
  if (!gameState.gameStarted || gameState.totalUpdateCount <= TIMING.hud.pause)
    return;
  if (loop.isStopped && !gameState.paused && !allowStopped) return;
  loop.stop();
  gameState.paused = true;
  setPauseVisual(true);
  showSessionMenu();
};

const closeInGameMenu = (): void => {
  hideSessionMenu();
  if (!gameState.gameStarted) return;
  loop.start();
  gameState.paused = false;
  setPauseVisual(false);
};

const toggleInGameMenu = (): void => {
  if (isSessionMenuOpen()) closeInGameMenu();
  else openInGameMenu();
};

const ac = new AbortController();
const { signal } = ac;

const isAudioMode = (mode: unknown): mode is AudioMode =>
  mode === "all" || mode === "muted" || mode === "music" || mode === "sfx";

const handleDeveloperAccessKey = (event: Event): void => {
  if (!(event instanceof KeyboardEvent)) return;
  const key = event.key.toLowerCase();
  const isDeveloperKey =
    event.code === "KeyD" ||
    key === "d" ||
    key === "∂" ||
    key === "ð";
  const shortcut =
    event.shiftKey &&
    isDeveloperKey &&
    (event.metaKey || event.ctrlKey || event.altKey);

  if (shortcut) {
    event.preventDefault();
    event.stopPropagation();
    requestDeveloperModeAccess();
    return;
  }
};

const addDeveloperAccessListener = (target: EventTarget): void => {
  target.addEventListener("keydown", handleDeveloperAccessKey, {
    capture: true,
    signal,
  });
  target.addEventListener("keyup", handleDeveloperAccessKey, {
    capture: true,
    signal,
  });
};

let helpOpen = false;
let resumeAfterHelp = false;
let developerScoreClicks = 0;
let developerScoreWindowStart = 0;
let developerScoreResetTimer: ReturnType<typeof setTimeout> | undefined;

const openHelp = (): void => {
  if (helpOpen) return;
  helpOpen = true;
  helpMenuButton.style.display =
    gameState.gameStarted ||
    gameState.gameOverlayHidden ||
    gameoverWrapper.style.display !== "none"
      ? ""
      : "none";
  resumeAfterHelp = gameState.gameStarted && !loop.isStopped;
  if (resumeAfterHelp) loop.stop();
  helpOverlay.setAttribute("aria-hidden", "false");
  helpOverlay.style.visibility = "visible";
  helpOverlay.style.transition = "opacity .24s ease";
  helpOverlay.style.pointerEvents = "all";
  helpOverlay.style.opacity = "1";
  helpPanel.style.pointerEvents = "all";
  helpPanel.style.transform = "translateY(0) scale(1)";
};

const closeHelp = (): void => {
  if (!helpOpen) return;
  helpOpen = false;
  helpOverlay.setAttribute("aria-hidden", "true");
  helpOverlay.style.pointerEvents = "none";
  helpOverlay.style.opacity = "0";
  helpOverlay.style.transition = "opacity .24s ease, visibility 0s linear .24s";
  helpOverlay.style.visibility = "hidden";
  helpPanel.style.pointerEvents = "none";
  helpPanel.style.transform = "translateY(10px) scale(.98)";
  if (resumeAfterHelp && gameState.gameStarted) loop.start();
  resumeAfterHelp = false;
};

pauseButton.addEventListener("click", togglePause, { signal });
gridToggleButton.addEventListener("click", gridLockToggle, { signal });
gridToggleTooltip.addEventListener("click", () => gridToggleButton.click(), {
  signal,
});
gridRedToggleButton.addEventListener("click", gridRedLockToggle, { signal });
gridRedToggleTooltip.addEventListener(
  "click",
  () => gridRedToggleButton.click(),
  { signal },
);

const handleClockClick = (event: Event): void => {
  if (!(event instanceof MouseEvent)) return;
  event.preventDefault();
  event.stopPropagation();
  if (!canChangeGameSpeed()) return;
  const speed = cycleGameSpeed();
  playSpeedToggleSound(speed);
};

const handleDeveloperScoreClick = (event: Event): void => {
  if (!(event instanceof MouseEvent)) return;
  event.preventDefault();
  event.stopPropagation();
  const now = performance.now();
  if (developerScoreWindowStart === 0 || now - developerScoreWindowStart > 2000) {
    developerScoreWindowStart = now;
    developerScoreClicks = 0;
  }
  developerScoreClicks += 1;
  clearTimeout(developerScoreResetTimer);
  if (developerScoreClicks >= 3) {
    developerScoreClicks = 0;
    developerScoreWindowStart = 0;
    toggleDeveloperModeAccess();
    return;
  }
  const resetDelay = Math.max(0, 2000 - (now - developerScoreWindowStart));
  developerScoreResetTimer = setTimeout(() => {
    developerScoreClicks = 0;
    developerScoreWindowStart = 0;
  }, resetDelay);
};

clock.addEventListener("click", handleClockClick, { signal });
scoreCounters.addEventListener("click", handleDeveloperScoreClick, { signal });
helpButton.addEventListener("click", openHelp, { signal });
helpCloseButton.addEventListener("click", closeHelp, { signal });
helpMenuButton.addEventListener(
  "click",
  () => {
    if (!gameState.gameStarted) {
      closeHelp();
      return;
    }
    resumeAfterHelp = false;
    closeHelp();
    openInGameMenu({ allowStopped: true });
  },
  { signal },
);
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
addDeveloperAccessListener(window);
addDeveloperAccessListener(document);
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

const isPlainShortcutEvent = (event: KeyboardEvent): boolean =>
  !helpOpen &&
  !event.repeat &&
  !event.metaKey &&
  !event.ctrlKey &&
  !event.altKey;

const shortcutKey = (event: KeyboardEvent, code: string, key: string): boolean =>
  event.code === code || event.key.toLowerCase() === key;

const shortcutDigit = (event: KeyboardEvent): GameSpeed | undefined => {
  if (event.code === "Digit1" || event.code === "Numpad1") return 1;
  if (event.code === "Digit2" || event.code === "Numpad2") return 2;
  if (event.code === "Digit3" || event.code === "Numpad3") return 3;
  return undefined;
};

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    target.isContentEditable ||
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT"
  );
};

const handleGlobalKeydown = (event: KeyboardEvent): void => {
  if (event.key === "Escape") {
    event.preventDefault();
    if (helpOpen) closeHelp();
    else toggleInGameMenu();
    return;
  }
  if (isSessionMenuOpen()) return;
  if (isEditableTarget(event.target)) return;
  if (!isPlainShortcutEvent(event)) return;

  const requestedSpeed = shortcutDigit(event);
  if (requestedSpeed && canChangeGameSpeed()) {
    event.preventDefault();
    if (requestedSpeed !== gameSpeed) {
      chooseGameSpeed(requestedSpeed);
      playSpeedToggleSound(requestedSpeed);
    }
    return;
  }

  const shortcuts = [
    {
      enabled: true,
      matches: shortcutKey(event, "KeyG", "g"),
      run: gridLockToggle,
    },
    {
      enabled: gameState.gameStarted && !isHomeActionActive(),
      matches: shortcutKey(event, "KeyD", "d"),
      run: gridRedLockToggle,
    },
    {
      enabled: gameState.gameStarted,
      matches: shortcutKey(event, "KeyS", "s"),
      run: startHomeActionSwap,
    },
  ];

  const shortcut = shortcuts.find((item) => item.enabled && item.matches);
  if (!shortcut) return;
  event.preventDefault();
  shortcut.run();
};

document.addEventListener(
  "keypress",
  (event) => {
    if (helpOpen || isSessionMenuOpen()) return;
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
  handleGlobalKeydown,
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
    d.paused = gameState.paused;
    d.gameOverlayHidden = gameState.gameOverlayHidden;
    ac.abort();
    loop.stop();
    if (window.__landoLoopToken === loopToken)
      window.__landoLoopToken = undefined;
  });
  import.meta.hot.accept();
}
