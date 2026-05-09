import { colors } from "../gfx/colors";
import { createElement, createSvgElement } from "../gfx/svg-utils";
import { session } from "../state";

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
    background: ${colors.ui}
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
  gridToggleButton.style.cssText = `position:absolute;bottom:16px;right:16px;padding:0;pointer-events:all;`;
  gridToggleButton.style.width = "48px";
  gridToggleButton.style.height = "48px";
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
    bottom: 16px;
    background: ${colors.ui};
  `;
  gridToggleTooltip.style.height = "48px";
  gridToggleTooltip.style.width = "96px";
  gridToggleTooltip.style.transition = `all .5s`;

  motorwayIndicator.style.cssText = `
    position: absolute;
    display: grid;
    place-items: center;
    bottom: 104px;
    left: 20px;
    border-radius: 20px;
    background: ${colors.ui};
    cursor: pointer;
    pointer-events: all;
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

  motorwayIndicator.addEventListener("click", () => {
    if (session.motorways > 0) setMotorwayMode(!motorwayMode);
  });

  bridgeIndicator.style.cssText = `
    position: absolute;
    display: grid;
    place-items: center;
    bottom: 188px;
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

  uiContainer.append(
    scoreCounters,
    clock,
    pauseButton,
    pathTilesIndicator,
    motorwayIndicator,
    bridgeIndicator,
    gridRedToggleTooltip,
    gridRedToggleButton,
    gridToggleTooltip,
    gridToggleButton,
  );
};

export const resetHudCounters = (): void => {
  pathTilesIndicatorCount.innerText = String(session.paths);
  pickupCount.innerText = "0";
  resetUpgradeCharge();
};

export const hideGameHud = (): void => {
  clock.style.opacity = "0";
  pathTilesIndicator.style.opacity = "0";
  pauseButton.style.opacity = "0";
};
