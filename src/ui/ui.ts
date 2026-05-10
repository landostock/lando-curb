import { colors } from "../gfx/colors";
import { createElement, createSvgElement } from "../gfx/svg-utils";
import { lakes, session } from "../state";
import { APP_VERSION } from "../version";

export const uiContainer = createElement();

export const scoreCounters = createElement();
export const pickupCount = createElement();

export const clock = createElement();

export const pathTilesIndicator = createElement();
export const pathTilesIndicatorCount = createElement();

export const motorwayIndicator = createElement();
export const motorwayIndicatorCount = createElement();
export let motorwayMode = false;
export const setMotorwayMode = (on: boolean): void => {
  motorwayMode = on;
  motorwayIndicator.style.background = on ? colors.motorway : colors.ui;
  motorwayIndicatorCount.style.borderColor = on ? colors.motorway : colors.ui;
};

export const bridgeIndicator = createElement();
export const bridgeIndicatorCount = createElement();

export const homeActionIndicator = createElement("button");
export const homeActionIndicatorCount = createElement();

export const developerModeButton = createElement("button");
export let developerMode = false;
let gameplayControlsVisible = false;
let developerModeButtonSuppressed = false;
let developerModeAccessGranted = false;

const updateHomeActionPosition = (): void => {
  const bridgeSlotVisible = lakes.length > 0 || session.bridges > 0;
  homeActionIndicator.style.bottom = bridgeSlotVisible ? "308px" : "212px";
};

export const updateInventoryCounters = (): void => {
  pathTilesIndicatorCount.innerText = developerMode ? "∞" : String(session.paths);
  motorwayIndicatorCount.innerText = developerMode
    ? "∞"
    : String(session.motorways);
  bridgeIndicatorCount.innerText = developerMode
    ? "∞"
    : String(session.bridges);
  homeActionIndicatorCount.innerText = developerMode
    ? "∞"
    : String(session.homeActions);
  updateHomeActionPosition();
};

const setDeveloperModeButtonState = (): void => {
  developerModeButton.innerText = developerMode ? "ON" : "DEV";
  developerModeButton.title = developerMode
    ? "Developer Mode: On"
    : "Developer Mode: Off";
  developerModeButton.setAttribute("aria-label", developerModeButton.title);
  developerModeButton.style.background = developerMode
    ? colors.motorway
    : "#f7f7f0";
  developerModeButton.style.color = developerMode ? "#fff" : colors.ui;
  developerModeButton.style.boxShadow = developerMode
    ? `0 0 0 2px #fff, 0 8px 24px ${colors.shade}`
    : `0 0 0 1px ${colors.shade2}, 0 8px 24px ${colors.shade}`;
};

export const enableDeveloperMode = ({
  skipConfirm = false,
}: { skipConfirm?: boolean } = {}): void => {
  if (developerMode) return;
  const confirmed =
    skipConfirm ||
    window.confirm(
      "Developer Mode is for testing. It gives unlimited roads, bridges, and motorways, and it cannot be turned off for this game. Resource counts and scoring are no longer comparable to a normal run. Enable Developer Mode?",
    );
  if (!confirmed) return;
  developerMode = true;
  developerModeAccessGranted = true;
  setDeveloperModeButtonState();
  updateInventoryCounters();
  updateDeveloperModeButtonVisibility();
};

export const grantDeveloperModeAccess = (): void => {
  developerModeAccessGranted = true;
  updateDeveloperModeButtonVisibility();
};

export const requestDeveloperModeAccess = (): void => {
  if (developerMode) return;
  grantDeveloperModeAccess();
};

export const resetDeveloperMode = (): void => {
  developerMode = false;
  developerModeAccessGranted = false;
  setDeveloperModeButtonState();
  updateInventoryCounters();
  updateDeveloperModeButtonVisibility();
};

const updateDeveloperModeButtonVisibility = (): void => {
  const visible =
    gameplayControlsVisible &&
    !developerModeButtonSuppressed &&
    (developerModeAccessGranted || developerMode);
  developerModeButton.style.opacity = visible ? "1" : "0";
  developerModeButton.style.visibility = visible ? "visible" : "hidden";
  developerModeButton.style.pointerEvents = visible ? "all" : "none";
};

export const pauseButton = createElement("button");
export const pauseSvgPath = createSvgElement("path");

const clockCore = createSvgElement("circle");
const clockBurst = createSvgElement("circle");
const clockPips: SVGPathElement[] = [];
let chargeCount = -1;

const setClockTransitions = (enabled: boolean): void => {
  for (let i = 0; i < clockPips.length; i++) {
    const pip = clockPips[i]!;
    pip.style.transition = enabled
      ? i === 11
        ? `transform .55s cubic-bezier(.2, 2.4, .3, 1), stroke .3s`
        : `transform .45s cubic-bezier(.34, 1.8, .5, 1), stroke .3s`
      : "none";
  }
  clockCore.style.transition = enabled
    ? `transform .4s cubic-bezier(.34, 1.9, .5, 1), fill .3s`
    : "none";
};

export const setUpgradeCharge = (progress: number): void => {
  if (clockPips.length < 12) return;
  const count = Math.min(12, Math.floor(progress * 12));
  if (count === chargeCount) return;
  chargeCount = count;
  for (let i = 0; i < 12; i++) {
    const lit = i < count;
    const pip = clockPips[i]!;
    pip.style.transform = lit ? "scaleY(1)" : "scaleY(0)";
    pip.setAttribute(
      "stroke",
      lit && i >= 10 ? colors.red : lit && i >= 7 ? colors.car3 : "#eee",
    );
  }
  clockCore.style.transform = count >= 9 ? "scale(1.8)" : "scale(0)";
  clockCore.setAttribute(
    "fill",
    count >= 11 ? colors.red : count >= 9 ? colors.car3 : "#eee",
  );
};

export const resetUpgradeCharge = (): void => {
  setClockTransitions(false);
  chargeCount = -1;
  setUpgradeCharge(0);
  clockCore.style.transform = "scale(0)";
  clockCore.setAttribute("fill", "#eee");
  clockBurst.style.animation = "none";
  clockBurst.style.opacity = "0";
  void clock.getBoundingClientRect();
  setClockTransitions(true);
};

export const fireUpgradeCharge = (): void => {
  clockBurst.style.animation = "none";
  void clockBurst.getBoundingClientRect();
  clockBurst.style.animation = "clockBurst .6s ease-out";
  chargeCount = -1;
};

export const gridToggleButton = createElement("button");
export const gridToggleSvg = createSvgElement("svg");
export const gridToggleSvgPath = createSvgElement("path");
export const gridToggleTooltip = createElement();

export const gridRedToggleButton = createElement("button");
export const gridRedToggleSvg = createSvgElement("svg");
export const gridRedToggleSvgPath = createSvgElement("path");
export const gridRedToggleTooltip = createElement();

export const audioModeButton = createElement("button");
export const audioModeSvg = createSvgElement("svg");
export const audioModeSvgPath = createSvgElement("path");
export const audioModeTooltip = createElement();

export const helpButton = createElement("button");
export const helpOverlay = createElement();
export const helpPanel = createElement();
export const helpCloseButton = createElement("button");
export const helpMenuButton = createElement("button");

type AudioMode = "all" | "muted" | "music" | "sfx";

const audioModeLabels: Record<AudioMode, string> = {
  all: "All",
  muted: "Mute",
  music: "Music Only",
  sfx: "Effects Only",
};

const audioModePaths: Record<AudioMode, string> = {
  all: "M3.5 7h2.2L8.8 4.4v7.2L5.7 9H3.5ZM10.7 6.1q1.2 1.9 0 3.8M12.7 4.8q2.4 3.2 0 6.4",
  muted: "M3.5 7h2.2L8.8 4.4v7.2L5.7 9H3.5ZM11 5.6l3 4.8M14 5.6l-3 4.8",
  music:
    "M6.4 11.4c-1 0-1.8-.5-1.8-1.2S5.4 9 6.4 9s1.8.5 1.8 1.2-.8 1.2-1.8 1.2ZM8.2 10.2V3.8l4 1",
  sfx: "M8 4.1v1.8M8 10.1v1.8M4.1 8h1.8M10.1 8h1.8M5.2 5.2l1.3 1.3M9.5 9.5l1.3 1.3M10.8 5.2 9.5 6.5M6.5 9.5l-1.3 1.3",
};

export const setAudioModeButton = (mode: AudioMode): void => {
  const label = audioModeLabels[mode];
  audioModeButton.title = `Audio: ${label}`;
  audioModeButton.setAttribute("aria-label", `Audio: ${label}`);
  audioModeSvgPath.setAttribute("d", audioModePaths[mode]);
  audioModeSvgPath.setAttribute(
    "stroke",
    mode === "muted" ? colors.red : mode === "all" ? colors.ui : "#2f5d70",
  );
  audioModeButton.style.background =
    mode === "muted" ? "#f7f0eb" : mode === "all" ? colors.house : "#edf7f4";
};

export const setGameplayControlsVisible = (visible: boolean): void => {
  gameplayControlsVisible = visible;
  gridToggleButton.style.opacity = visible ? "1" : "0";
  gridToggleButton.style.pointerEvents = visible ? "all" : "none";
  audioModeButton.style.opacity = visible ? "1" : "0";
  audioModeButton.style.pointerEvents = visible ? "all" : "none";
  updateDeveloperModeButtonVisibility();
  if (!visible) gridToggleTooltip.style.opacity = "0";
};

export const setDeveloperModeButtonSuppressed = (suppressed: boolean): void => {
  developerModeButtonSuppressed = suppressed;
  updateDeveloperModeButtonVisibility();
};

// eslint-disable-next-line max-lines-per-function
export const initUi = () => {
  const styles = createElement("style");
  // body has user-select: none; to prevent text being highlighted.
  // ui black and shade colours inlined to make things smaller maybe
  styles.innerText = `
    body {
      position: relative;
      font-weight: 700;
      font-family: system-ui;
      color: ${colors.ui};
      margin: 0;
      width: 100vw;
      height: 100vh;
      user-select: none;
    }
    button {
      font-weight: 700;
      font-family: system-ui;
      color: ${colors.ui};
      border: none;
      padding: 0 20px;
      font-size: 32px;
      height: 56px;
      border-radius: 64px;
      background: ${colors.house};
      transition: all .2s, bottom .5s, right .5s, opacity 1s;
      box-shadow: 0 0 0 1px ${colors.shade};
    }
    button:hover {
      box-shadow: 4px 4px 0 1px ${colors.shade};
    }
    button:active {
      transform: scale(.95);
      box-shadow: 0 0 0 1px ${colors.shade};
    }
    u, abbr {
      text-decoration-thickness: 2px;
      text-underline-offset: 2px;
    }
    @keyframes clockBurst {
      0%   { transform: scale(1);   opacity: .9; stroke-width: 2; }
      100% { transform: scale(5.5); opacity: 0;  stroke-width: 0; }
    }
    .help-copy {
      margin: 0;
      font-weight: 650;
      line-height: 1.45;
    }
    .help-kbd {
      display: inline-flex;
      min-width: 28px;
      height: 28px;
      box-sizing: border-box;
      align-items: center;
      justify-content: center;
      border-radius: 9px;
      padding: 0 7px;
      background: #fff;
      box-shadow: inset 0 0 0 1px ${colors.shade2}, 0 2px 0 ${colors.shade};
      color: ${colors.ui};
      font-size: 15px;
      font-weight: 850;
    }
    .help-pill {
      display: inline-flex;
      align-items: center;
      min-height: 28px;
      padding: 0 10px;
      border-radius: 999px;
      background: #fff;
      box-shadow: inset 0 0 0 1px ${colors.shade};
      font-size: 15px;
      font-weight: 800;
    }
    .help-shortcut {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 34px;
      padding: 3px 10px 3px 4px;
      border-radius: 999px;
      background: rgba(255,255,255,.5);
      box-shadow: inset 0 0 0 1px rgba(68,68,51,.07);
      font-size: 15px;
      font-weight: 800;
    }
  `;
  document.head.append(styles);

  uiContainer.style.cssText = `
    position: absolute;
    inset: 0;
    display: grid;
    overflow: hidden;
    pointer-events: none
  `;
  uiContainer.style.zIndex = "1";
  document.body.append(uiContainer);

  scoreCounters.style.cssText = `
    display: flex;
    align-items: center;
    gap: 8px;
    position: absolute;
    top: 16px;
    left: 16px;
    padding: 6px 14px;
    border-radius: 64px;
    background: ${colors.ui};
    color: #eee;
    font-size: 20px;
  `;
  scoreCounters.style.transition = `opacity 1s`;
  scoreCounters.style.opacity = "0";

  const pinSvg = createSvgElement("svg");
  pinSvg.setAttribute("viewBox", "0 0 12 12");
  pinSvg.style.width = "20px";
  pinSvg.style.height = "20px";
  const pinPath = createSvgElement("path");
  pinPath.setAttribute("d", "m6 11-3-3a4.24 4.24 0 1 1 6 0Z");
  pinPath.setAttribute("fill", "#fff");
  pinSvg.append(pinPath);

  pickupCount.innerText = "0";
  scoreCounters.append(pinSvg, pickupCount);

  clock.style.cssText = `
    position: absolute;
    display: grid;
    top: 16px;
    right: 16px;
    place-items: center;
    border-radius: 64px;
    background: ${colors.ui};
    cursor: pointer;
    pointer-events: none;
    touch-action: manipulation
  `;
  clock.style.width = "80px";
  clock.style.height = "80px";
  clock.style.opacity = "0";
  clock.style.transition = `opacity 1s`;

  const clockSvg = createSvgElement("svg");
  clockSvg.setAttribute("stroke-linejoin", "round");
  clockSvg.setAttribute("stroke-linecap", "round");
  clockSvg.setAttribute("viewBox", "0 0 16 16");
  clockSvg.style.width = "80px";
  clockSvg.style.height = "80px";

  for (let i = 0; i < 12; i++) {
    const group = createSvgElement("g");
    group.setAttribute("transform", `rotate(${i * 30} 8 8)`);
    const pip = createSvgElement("path");
    pip.setAttribute("fill", "none");
    pip.setAttribute("stroke", "#eee");
    pip.setAttribute("stroke-width", "1.2");
    pip.setAttribute("d", "M8 11.5 L8 14.8");
    pip.style.transformOrigin = "8px 11.5px";
    pip.style.transform = "scaleY(0)";
    pip.style.transition =
      i === 11
        ? `transform .55s cubic-bezier(.2, 2.4, .3, 1), stroke .3s`
        : `transform .45s cubic-bezier(.34, 1.8, .5, 1), stroke .3s`;
    group.append(pip);
    clockSvg.append(group);
    clockPips.push(pip);
  }

  clockCore.setAttribute("cx", "8");
  clockCore.setAttribute("cy", "8");
  clockCore.setAttribute("r", ".9");
  clockCore.setAttribute("fill", "#eee");
  clockCore.style.transformOrigin = "8px 8px";
  clockCore.style.transform = "scale(0)";
  clockCore.style.transition = `transform .4s cubic-bezier(.34, 1.9, .5, 1), fill .3s`;
  clockSvg.append(clockCore);

  clockBurst.setAttribute("cx", "8");
  clockBurst.setAttribute("cy", "8");
  clockBurst.setAttribute("r", "4");
  clockBurst.setAttribute("fill", "none");
  clockBurst.setAttribute("stroke", colors.red);
  clockBurst.setAttribute("stroke-width", "2");
  clockBurst.style.transformOrigin = "8px 8px";
  clockBurst.style.opacity = "0";
  clockSvg.append(clockBurst);

  clock.append(clockSvg);

  pathTilesIndicator.style.cssText = `
    position: absolute;
    display: grid;
    place-items: center;
    bottom: 20px;
    left: 20px;
    border-radius: 20px;
    background: ${colors.ui};
  `;
  pathTilesIndicator.style.transform = "rotate(-45deg)";
  pathTilesIndicator.style.opacity = "0";
  pathTilesIndicator.style.transition = `scale .4s cubic-bezier(.5, 2, .5, 1), opacity 1s`;
  pathTilesIndicator.style.width = "72px";
  pathTilesIndicator.style.height = "72px";
  pathTilesIndicatorCount.style.cssText = `
    position: absolute;
    display: grid;
    place-items: center;
    border-radius: 64px;
    border: 6px solid ${colors.ui};
    transform: translate(28px,28px) rotate(45deg);
    font-size: 18px;
    background: #eee;
    transition: all .5s;
  `;
  pathTilesIndicatorCount.style.width = "28px";
  pathTilesIndicatorCount.style.height = "28px";
  const pathTilesSvg = createSvgElement("svg");
  pathTilesSvg.setAttribute("viewBox", "0 0 18 18");
  pathTilesSvg.style.width = "54px";
  pathTilesSvg.style.height = "54px";
  pathTilesSvg.style.transform = "rotate(45deg)";
  const pathTilesSvgPath = createSvgElement("path");
  pathTilesSvgPath.setAttribute("fill", "none");
  pathTilesSvgPath.setAttribute("stroke", "#eee");
  pathTilesSvgPath.setAttribute("stroke-linecap", "round");
  pathTilesSvgPath.setAttribute("stroke-width", String(2));
  pathTilesSvgPath.setAttribute(
    "d",
    "M11 1h-3q-2 0-2 2t2 2h4q2 0 2 2t-2 2h-6q-2 0-2 2t2 2h4q2 0 2 2t-2 2h-3",
  );
  pathTilesSvg.append(pathTilesSvgPath);
  pathTilesIndicator.append(pathTilesSvg, pathTilesIndicatorCount);

  const pauseSvg = createSvgElement("svg");
  pauseSvg.setAttribute("viewBox", "0 0 16 16");
  pauseSvg.setAttribute("width", String(64));
  pauseSvg.setAttribute("height", String(64));
  pauseSvgPath.setAttribute("fill", colors.ui);
  pauseSvgPath.setAttribute("stroke", colors.ui);
  pauseSvgPath.setAttribute("stroke-width", String(2));
  pauseSvgPath.setAttribute("stroke-linecap", "round");
  pauseSvgPath.setAttribute("stroke-linejoin", "round");
  pauseSvgPath.setAttribute("d", "M6 6 6 10M10 6 10 8 10 10");
  pauseSvgPath.style.transition = `all .2s`;
  pauseSvgPath.style.transformOrigin = "center";
  pauseSvgPath.style.transform = "rotate(180deg)";
  pauseSvg.append(pauseSvgPath);

  pauseButton.style.cssText = `position:absolute;padding:0;pointer-events:all`;
  const layoutPauseButton = () => {
    const compact = document.body.scrollHeight < 500;
    pauseButton.style.top = compact ? "108px" : "24px";
    pauseButton.style.right = compact ? "20px" : "112px";
  };
  layoutPauseButton();
  addEventListener("resize", layoutPauseButton);
  pauseButton.style.width = "64px";
  pauseButton.style.height = "64px";
  pauseButton.style.opacity = "0";
  pauseButton.append(pauseSvg);

  gridRedToggleSvg.setAttribute("viewBox", "0 0 16 16");
  gridRedToggleSvg.setAttribute("width", String(48));
  gridRedToggleSvg.setAttribute("height", String(48));
  gridRedToggleSvgPath.setAttribute("fill", "none");
  gridRedToggleSvgPath.setAttribute("stroke", colors.red);
  gridRedToggleSvgPath.setAttribute("stroke-width", String(2));
  gridRedToggleSvgPath.setAttribute("stroke-linecap", "round");
  gridRedToggleSvgPath.setAttribute("stroke-linejoin", "round");
  gridRedToggleSvgPath.style.transition = `all .3s`;
  gridRedToggleSvgPath.style.transformOrigin = "center";
  gridRedToggleSvg.append(gridRedToggleSvgPath);
  gridRedToggleButton.append(gridRedToggleSvg);
  gridRedToggleButton.style.cssText = `position:absolute;bottom:72px;right:16px;padding:0;pointer-events:all;`;
  gridRedToggleButton.style.width = "48px";
  gridRedToggleButton.style.height = "48px";
  gridRedToggleButton.style.opacity = "0";
  gridRedToggleTooltip.style.cssText = `
    position: absolute;
    display: flex;
    right: 16px;
    align-items: center;
    color: #eee;
    font-size: 16px;
    border-radius: 64px;
    padding: 0 64px 0 16px;
    white-space: pre;
    pointer-events: all;
    bottom: 72px;
    background: ${colors.ui};
  `;
  gridRedToggleTooltip.style.height = "48px";
  gridRedToggleTooltip.style.width = "96px";
  gridRedToggleTooltip.style.opacity = "0";
  gridRedToggleTooltip.style.transition = `all .5s`;

  gridToggleSvg.setAttribute("viewBox", "0 0 16 16");
  gridToggleSvg.setAttribute("width", String(48));
  gridToggleSvg.setAttribute("height", String(48));
  gridToggleSvgPath.setAttribute("fill", "none");
  gridToggleSvgPath.setAttribute("stroke", colors.ui);
  gridToggleSvgPath.setAttribute("stroke-width", String(2));
  gridToggleSvgPath.setAttribute("stroke-linecap", "round");
  gridToggleSvgPath.setAttribute("stroke-linejoin", "round");
  gridToggleSvgPath.style.transition = `all .3s`;
  gridToggleSvgPath.style.transformOrigin = "center";
  gridToggleSvg.append(gridToggleSvgPath);
  gridToggleButton.append(gridToggleSvg);
  gridToggleButton.style.cssText = `position:absolute;bottom:128px;right:16px;padding:0;pointer-events:all;`;
  gridToggleButton.style.width = "48px";
  gridToggleButton.style.height = "48px";
  gridToggleButton.style.opacity = "0";
  gridToggleButton.style.pointerEvents = "none";
  gridToggleTooltip.style.cssText = `
    position: absolute;
    display: flex;
    right: 16px;
    align-items: center;
    color: #eee;
    font-size: 16px;
    border-radius: 64px;
    padding: 0 64px 0 16px;
    white-space: pre;
    pointer-events: all;
    bottom: 128px;
    background: ${colors.ui};
  `;
  gridToggleTooltip.style.height = "48px";
  gridToggleTooltip.style.width = "96px";
  gridToggleTooltip.style.opacity = "0";
  gridToggleTooltip.style.transition = `all .5s`;

  audioModeSvg.setAttribute("viewBox", "0 0 16 16");
  audioModeSvg.setAttribute("width", String(42));
  audioModeSvg.setAttribute("height", String(42));
  audioModeSvgPath.setAttribute("fill", "none");
  audioModeSvgPath.setAttribute("stroke", colors.ui);
  audioModeSvgPath.setAttribute("stroke-width", String(1.35));
  audioModeSvgPath.setAttribute("stroke-linecap", "round");
  audioModeSvgPath.setAttribute("stroke-linejoin", "round");
  audioModeSvgPath.style.transition = `all .2s`;
  audioModeSvg.append(audioModeSvgPath);
  audioModeButton.append(audioModeSvg);
  audioModeButton.style.cssText = `
    position:absolute;
    bottom:72px;
    right:16px;
    padding:0;
    pointer-events:all;
    display:grid;
    place-items:center;
  `;
  audioModeButton.style.width = "48px";
  audioModeButton.style.height = "48px";
  audioModeButton.style.opacity = "0";
  audioModeButton.style.pointerEvents = "none";
  audioModeButton.style.boxShadow = `0 0 0 1px ${colors.shade2}, 0 8px 24px ${colors.shade}`;
  audioModeTooltip.style.display = "none";
  setAudioModeButton("all");

  developerModeButton.style.cssText = `
    position:absolute;
    bottom:184px;
    right:16px;
    padding:0;
    pointer-events:all;
    display:grid;
    place-items:center;
    font-size:13px;
    line-height:1;
    letter-spacing:0;
    z-index:5;
  `;
  developerModeButton.style.width = "48px";
  developerModeButton.style.height = "48px";
  developerModeButton.style.opacity = "0";
  developerModeButton.style.visibility = "hidden";
  developerModeButton.style.pointerEvents = "none";
  developerModeButton.addEventListener("click", () => {
    enableDeveloperMode();
  });
  setDeveloperModeButtonState();

  helpButton.style.cssText = `
    position:absolute;
    bottom:16px;
    right:16px;
    padding:0;
    pointer-events:all;
    display:grid;
    place-items:center;
    background:#f7f7f0;
    font-size:28px;
    line-height:1;
  `;
  helpButton.style.width = "48px";
  helpButton.style.height = "48px";
  helpButton.style.opacity = "1";
  helpButton.style.boxShadow = `0 0 0 1px ${colors.shade2}, 0 8px 24px ${colors.shade}`;
  helpButton.innerText = "?";
  helpButton.title = "Rules, controls, and shortcuts";
  helpButton.setAttribute("aria-label", "Rules, controls, and shortcuts");

  helpOverlay.style.cssText = `
    position:absolute;
    inset:0;
    display:grid;
    place-items:center;
    padding:24px;
    pointer-events:none;
    opacity:0;
    background:rgba(31, 38, 24, .28);
    backdrop-filter: blur(7px) saturate(1.05);
    transition: opacity .24s ease;
  `;
  helpOverlay.style.zIndex = "4";
  helpOverlay.setAttribute("aria-hidden", "true");

  helpPanel.style.cssText = `
    width:min(680px, calc(100vw - 48px));
    max-height:calc(100vh - 48px);
    overflow:auto;
    box-sizing:border-box;
    padding:30px;
    border-radius:20px;
    background:#eef3e4;
    box-shadow:
      0 22px 70px rgba(20, 24, 16, .24),
      inset 0 0 0 1px rgba(68, 68, 51, .09);
    color:${colors.ui};
    transform:translateY(10px) scale(.98);
    transition: transform .24s ease;
  `;

  const helpTitle = createElement();
  helpTitle.innerText = "Lando Curb";
  helpTitle.style.cssText = `
    margin:0;
    font-size:36px;
    line-height:1;
    letter-spacing:0;
  `;

  const helpIntro = createElement();
  helpIntro.className = "help-copy";
  helpIntro.style.marginTop = "12px";
  helpIntro.innerText =
    "Connect houses to business parks efficiently. Every road tile matters.";

  const helpGrid = createElement();
  helpGrid.style.cssText = `
    display:grid;
    grid-template-columns:repeat(2, minmax(0, 1fr));
    gap:16px;
    margin-top:24px;
  `;

  const makeHelpBlock = (title: string, text: string): HTMLElement => {
    const block = createElement();
    block.style.cssText = `
      min-height:120px;
      padding:18px;
      border-radius:14px;
      background:rgba(255,255,255,.54);
      box-shadow:inset 0 0 0 1px rgba(68,68,51,.08);
    `;
    const heading = createElement();
    heading.innerText = title;
    heading.style.cssText = `
      font-size:17px;
      margin-bottom:8px;
    `;
    const copy = createElement();
    copy.className = "help-copy";
    copy.style.fontSize = "15px";
    copy.innerText = text;
    block.append(heading, copy);
    return block;
  };

  helpGrid.append(
    makeHelpBlock(
      "Goal",
      "Keep demand moving by building short, reliable routes from houses to matching business parks.",
    ),
    makeHelpBlock(
      "Build",
      "Drag from an existing road or driveway to place streets. Drag along an existing street to upgrade it into a motorway.",
    ),
    makeHelpBlock(
      "Remove",
      "Right-click roads to remove them when a cleaner route opens up.",
    ),
    makeHelpBlock(
      "Flow",
      "Cars slow down in tight bottlenecks and busy junctions, so efficient layouts keep the city moving.",
    ),
  );

  const helpOptions = createElement();
  helpOptions.style.cssText = `
    display:flex;
    flex-wrap:wrap;
    gap:10px;
    margin-top:22px;
  `;
  helpOptions.innerHTML = `
    <span class="help-pill">Audio: All / Mute / Music / Effects</span>
    <span class="help-pill">Grid: Auto / On</span>
    <span class="help-pill">Pause: plan safely</span>
  `;

  const helpShortcuts = createElement();
  helpShortcuts.style.cssText = `
    display:flex;
    flex-wrap:wrap;
    gap:12px;
    align-items:center;
    margin-top:24px;
  `;
  helpShortcuts.innerHTML = `
    <span class="help-shortcut"><span class="help-kbd">Space</span><span>Pause</span></span>
    <span class="help-shortcut"><span class="help-kbd">M</span><span>Mute</span></span>
    <span class="help-shortcut"><span class="help-kbd">S</span><span>New Song</span></span>
    <span class="help-shortcut"><span class="help-kbd">RMB</span><span>Remove road</span></span>
  `;

  const helpActions = createElement();
  helpActions.style.cssText = `
    display:flex;
    flex-wrap:wrap;
    gap:12px;
    margin-top:28px;
  `;

  const helpVersion = createElement();
  helpVersion.innerText = `v${APP_VERSION}`;
  helpVersion.style.cssText = `
    justify-self:end;
    margin-top:10px;
    font-size:12px;
    line-height:1;
    font-weight:800;
    color:${colors.ui};
    opacity:.52;
  `;

  helpMenuButton.innerText = "Menu";
  helpMenuButton.style.cssText = `
    height:48px;
    padding:0 22px;
    font-size:20px;
    background:#fff;
    color:${colors.ui};
    pointer-events:all;
  `;

  helpCloseButton.innerText = "Continue";
  helpCloseButton.style.cssText = `
    height:48px;
    padding:0 22px;
    font-size:20px;
    background:${colors.ui};
    color:#fff;
    pointer-events:all;
  `;

  helpActions.append(helpMenuButton, helpCloseButton);

  helpPanel.append(
    helpTitle,
    helpIntro,
    helpGrid,
    helpOptions,
    helpShortcuts,
    helpActions,
    helpVersion,
  );
  helpOverlay.append(helpPanel);

  motorwayIndicator.style.cssText = `
    position: absolute;
    display: grid;
    place-items: center;
    bottom: 116px;
	  left: 20px;
	  border-radius: 20px;
	  background: ${colors.ui};
	  cursor: default;
	  pointer-events: none;
	`;
  motorwayIndicator.style.transform = "rotate(-45deg)";
  motorwayIndicator.style.opacity = "0";
  motorwayIndicator.style.transition = `scale .4s cubic-bezier(.5, 2, .5, 1), opacity 1s, background .2s`;
  motorwayIndicator.style.width = "72px";
  motorwayIndicator.style.height = "72px";
  motorwayIndicatorCount.style.cssText = `
    position: absolute;
    display: grid;
    place-items: center;
    border-radius: 64px;
    border: 6px solid ${colors.ui};
    transform: translate(28px,28px) rotate(45deg);
    font-size: 18px;
    background: #eee;
    transition: all .5s;
  `;
  motorwayIndicatorCount.style.width = "28px";
  motorwayIndicatorCount.style.height = "28px";
  motorwayIndicatorCount.innerText = "0";
  const motorwaySvg = createSvgElement("svg");
  motorwaySvg.setAttribute("viewBox", "0 0 18 18");
  motorwaySvg.style.width = "54px";
  motorwaySvg.style.height = "54px";
  motorwaySvg.style.transform = "rotate(45deg)";
  const motorwaySvgPath = createSvgElement("path");
  motorwaySvgPath.setAttribute("fill", "none");
  motorwaySvgPath.setAttribute("stroke", colors.motorway);
  motorwaySvgPath.setAttribute("stroke-linecap", "round");
  motorwaySvgPath.setAttribute("stroke-width", String(3));
  motorwaySvgPath.setAttribute("d", "M3 7h12M3 11h12");
  motorwaySvg.append(motorwaySvgPath);
  motorwayIndicator.append(motorwaySvg, motorwayIndicatorCount);

  bridgeIndicator.style.cssText = `
    position: absolute;
    display: grid;
    place-items: center;
    bottom: 212px;
    left: 20px;
    border-radius: 20px;
    background: ${colors.ui};
  `;
  bridgeIndicator.style.transform = "rotate(-45deg)";
  bridgeIndicator.style.opacity = "0";
  bridgeIndicator.style.transition = `scale .4s cubic-bezier(.5, 2, .5, 1), opacity 1s`;
  bridgeIndicator.style.width = "72px";
  bridgeIndicator.style.height = "72px";
  bridgeIndicatorCount.style.cssText = `
    position: absolute;
    display: grid;
    place-items: center;
    border-radius: 64px;
    border: 6px solid ${colors.ui};
    transform: translate(28px,28px) rotate(45deg);
    font-size: 18px;
    background: #eee;
    transition: all .5s;
  `;
  bridgeIndicatorCount.style.width = "28px";
  bridgeIndicatorCount.style.height = "28px";
  bridgeIndicatorCount.innerText = "0";
  const bridgeSvg = createSvgElement("svg");
  bridgeSvg.setAttribute("viewBox", "0 0 18 18");
  bridgeSvg.style.width = "54px";
  bridgeSvg.style.height = "54px";
  bridgeSvg.style.transform = "rotate(45deg)";
  const bridgeSvgPath = createSvgElement("path");
  bridgeSvgPath.setAttribute("fill", "none");
  bridgeSvgPath.setAttribute("stroke", "#eee");
  bridgeSvgPath.setAttribute("stroke-linecap", "round");
  bridgeSvgPath.setAttribute("stroke-width", String(2));
  bridgeSvgPath.setAttribute("d", "M3 12h12 M3 12 Q9 5 15 12 M5 12v3 M13 12v3");
  bridgeSvg.append(bridgeSvgPath);
  bridgeIndicator.append(bridgeSvg, bridgeIndicatorCount);

  homeActionIndicator.style.cssText = `
    position: absolute;
    display: grid;
    place-items: center;
    left: 20px;
    border-radius: 20px;
    background: #f7f7f0;
    cursor: pointer;
    pointer-events: all;
    padding: 0;
  `;
  updateHomeActionPosition();
  homeActionIndicator.style.transform = "rotate(-45deg)";
  homeActionIndicator.style.opacity = "0";
  homeActionIndicator.style.transition = `scale .4s cubic-bezier(.5, 2, .5, 1), opacity 1s, background .2s`;
  homeActionIndicator.style.width = "72px";
  homeActionIndicator.style.height = "72px";
  homeActionIndicator.title = "Home Action";
  homeActionIndicator.setAttribute("aria-label", "Home Action");
  homeActionIndicatorCount.style.cssText = `
    position: absolute;
    display: grid;
    place-items: center;
    border-radius: 64px;
    border: 6px solid ${colors.ui};
    transform: translate(28px,28px) rotate(45deg);
    font-size: 18px;
    background: #eee;
    transition: all .5s;
  `;
  homeActionIndicatorCount.style.width = "28px";
  homeActionIndicatorCount.style.height = "28px";
  homeActionIndicatorCount.innerText = "0";
  const homeActionSvg = createSvgElement("svg");
  homeActionSvg.setAttribute("viewBox", "0 0 18 18");
  homeActionSvg.style.width = "54px";
  homeActionSvg.style.height = "54px";
  homeActionSvg.style.transform = "rotate(45deg)";
  const homeActionSvgPath = createSvgElement("path");
  homeActionSvgPath.setAttribute("fill", "none");
  homeActionSvgPath.setAttribute("stroke", colors.ui);
  homeActionSvgPath.setAttribute("stroke-linecap", "round");
  homeActionSvgPath.setAttribute("stroke-linejoin", "round");
  homeActionSvgPath.setAttribute("stroke-width", String(2));
  homeActionSvgPath.setAttribute("d", "M3 9.5 9 4l6 5.5M5 8.5V15h8V8.5M7.5 15v-4h3v4");
  homeActionSvg.append(homeActionSvgPath);
  homeActionIndicator.append(homeActionSvg, homeActionIndicatorCount);

  uiContainer.append(
    scoreCounters,
    clock,
    pauseButton,
    pathTilesIndicator,
    motorwayIndicator,
    bridgeIndicator,
    homeActionIndicator,
    helpOverlay,
    helpButton,
    audioModeButton,
    gridToggleTooltip,
    gridToggleButton,
  );
  document.body.append(developerModeButton);
};

export const resetHudCounters = (): void => {
  updateInventoryCounters();
  pickupCount.innerText = "0";
  resetUpgradeCharge();
};

export const hideGameHud = (): void => {
  clock.style.opacity = "0";
  clock.style.pointerEvents = "none";
  pathTilesIndicator.style.opacity = "0";
  motorwayIndicator.style.opacity = "0";
  bridgeIndicator.style.opacity = "0";
  homeActionIndicator.style.opacity = "0";
  setGameplayControlsVisible(false);
  pauseButton.style.opacity = "0";
};
