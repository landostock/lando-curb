import { grid } from "../board";
import { colors } from "../gfx/colors";
import { svgPxToDisplayPx } from "../gfx/coords";
import { clearLayers } from "../gfx/layers";
import { resetViewBox, svgElement } from "../gfx/svg";
import { createElement, createSvgElement } from "../gfx/svg-utils";
import { session, streets } from "../state";
import type { Pixel } from "../types";
import { menuBackground } from "./menu";
import {
  gridToggleButton,
  gridToggleTooltip,
  pathTilesIndicatorCount,
  pauseButton,
  scoreCounters,
  setGameplayControlsVisible,
  setHelpButtonVisible,
  uiContainer,
} from "./ui";

export const gameoverWrapper = createElement();
const gameoverHeader = createElement();
const gameoverText1 = createElement();
const gameoverText2 = createElement();
const gameoverText3 = createElement();
const gameoverButtons = createElement();
const restartButtonWrapper = createElement();
const restartButton = createElement("button");
const menuButtonWrapper = createElement();
const menuButton = createElement("button");
const scoreWrapper = createElement();
const highscoreText = createElement();
export const toggleGameoverlayButton = createElement("button");
const restoreGameoverOverlayButton = createElement("button");
const restoreGameoverOverlaySvg = createSvgElement("svg");
const restoreGameoverOverlayPath = createSvgElement("path");
const mapScoreHud = createElement();
const mapScoreText = createElement();
const mapHighscoreText = createElement();
const mapRoadText = createElement();
const mapMotorwayText = createElement();

export const initGameover = (
  startNewGame: () => void,
  gameoverToMenu: () => void,
  toggleGameoverlay: () => void,
): void => {
  gameoverWrapper.style.cssText = `
    position: absolute;
    inset: 0;
    padding: 10vmin;
    flex-direction: column;
  `;
  gameoverWrapper.style.display = "none";
  gameoverWrapper.style.pointerEvents = "none";
  gameoverWrapper.style.opacity = "0";

  gameoverHeader.style.cssText = `font-size: 72px; opacity: 0`;
  gameoverHeader.innerText = "Game Over";

  gameoverText1.style.cssText = `margin-top: 48px; font-size: 24px; opacity:0`;
  gameoverText1.innerText =
    "Too few commuters could service this business park in time.";

  gameoverText2.style.cssText = `margin-top: 16px; font-size: 24px; opacity: 0`;

  // 24px margin-top counteracts the underline in gameoverText2
  gameoverText3.style.cssText = `
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 24px;
    font-size: 24px;
  `;
  gameoverText3.style.opacity = "0";
  const layoutText3 = () => {
    const compact = document.body.scrollHeight < 500;
    gameoverText3.style.position = compact ? "absolute" : "";
    gameoverText3.style.bottom = compact ? "10vmin" : "";
    gameoverText3.style.right = compact ? "10vmin" : "";
  };
  layoutText3();
  addEventListener("resize", layoutText3);

  scoreWrapper.style.cssText = `display:inline-flex;padding:6px 12px;line-height:24px;color:#fff;border-radius:64px;background:${colors.ui}`;
  highscoreText.style.cssText = `
    flex-basis: 100%;
    margin-top: 4px;
    font-size: 18px;
    line-height: 22px;
    color: ${colors.ui};
  `;

  menuButtonWrapper.style.opacity = "0";
  restartButtonWrapper.style.opacity = "0";
  menuButtonWrapper.append(menuButton);
  restartButtonWrapper.append(restartButton);
  restartButton.innerText = "Restart";
  menuButton.innerText = "Menu";

  restartButton.addEventListener("click", startNewGame);

  menuButton.addEventListener("click", gameoverToMenu);

  toggleGameoverlayButton.innerText = "Hide Overlay";
  toggleGameoverlayButton.addEventListener("click", toggleGameoverlay);
  const toggleButtonWrapper = createElement();
  toggleButtonWrapper.append(toggleGameoverlayButton);

  gameoverButtons.append(
    restartButtonWrapper,
    menuButtonWrapper,
    toggleButtonWrapper,
  );
  gameoverButtons.style.cssText = `gap: 16px; margin-top: 48px;`;
  const layoutButtons = () => {
    const compact = document.body.scrollHeight < 500;
    gameoverButtons.style.display = compact ? "flex" : "grid";
    gameoverButtons.style.position = compact ? "absolute" : "";
    gameoverButtons.style.bottom = compact ? "10vmin" : "";
    gameoverButtons.style.left = compact ? "10vmin" : "";
  };
  layoutButtons();
  addEventListener("resize", layoutButtons);

  toggleGameoverlayButton.style.cssText = "";
  toggleGameoverlayButton.style.pointerEvents = "none";
  toggleGameoverlayButton.style.opacity = "0";
  restoreGameoverOverlaySvg.setAttribute("viewBox", "0 0 24 24");
  restoreGameoverOverlaySvg.setAttribute("width", "28");
  restoreGameoverOverlaySvg.setAttribute("height", "28");
  restoreGameoverOverlayPath.setAttribute("d", "M7 7 17 17M17 7 7 17");
  restoreGameoverOverlayPath.setAttribute("fill", "none");
  restoreGameoverOverlayPath.setAttribute("stroke", colors.ui);
  restoreGameoverOverlayPath.setAttribute("stroke-width", "3.2");
  restoreGameoverOverlayPath.setAttribute("stroke-linecap", "round");
  restoreGameoverOverlaySvg.append(restoreGameoverOverlayPath);
  restoreGameoverOverlayButton.replaceChildren(restoreGameoverOverlaySvg);
  restoreGameoverOverlayButton.title = "Show game over overlay";
  restoreGameoverOverlayButton.setAttribute(
    "aria-label",
    "Show game over overlay",
  );
  restoreGameoverOverlayButton.style.cssText = `
    position:absolute;
    display:grid;
    place-items:center;
    width:48px;
    height:48px;
    padding:0;
    right:16px;
    top:16px;
    line-height:0;
    background:#f7f7f0;
    color:${colors.ui};
    opacity:0;
    pointer-events:none;
    transition:opacity .2s;
    z-index:12;
  `;
  restoreGameoverOverlayButton.addEventListener("click", toggleGameoverlay);

  mapScoreHud.style.cssText = `
    position:absolute;
    display:grid;
    gap:4px;
    row-gap:5px;
    align-items:start;
    min-width:0;
    width:max-content;
    max-width:176px;
    padding:12px 14px;
    border-radius:10px;
    background:rgba(247,247,240,.82);
    color:${colors.ui};
    box-shadow:0 6px 18px rgba(20,24,16,.14), inset 0 0 0 1px rgba(68,68,51,.12);
    opacity:0;
    pointer-events:none;
    transition:opacity .2s;
    z-index:11;
  `;
  mapScoreText.style.cssText = `font-size:22px;line-height:1;font-weight:900;`;
  mapHighscoreText.style.cssText = `font-size:15px;line-height:1.1;font-weight:800;opacity:.78;`;
  mapRoadText.style.cssText = `font-size:14px;line-height:1.1;font-weight:800;opacity:.68;`;
  mapMotorwayText.style.cssText = `font-size:14px;line-height:1.1;font-weight:800;opacity:.68;`;
  mapScoreHud.append(
    mapScoreText,
    mapHighscoreText,
    mapRoadText,
    mapMotorwayText,
  );

  gameoverWrapper.append(
    gameoverHeader,
    gameoverText1,
    gameoverText2,
    gameoverText3,
    gameoverButtons,
  );

  document.body.append(gameoverWrapper, restoreGameoverOverlayButton, mapScoreHud);
};

export const showGameoverMapControls = (): void => {
  setHelpButtonVisible(false);
  const mapRect = svgElement.getBoundingClientRect();
  const buttonSize = restoreGameoverOverlayButton.offsetWidth || 48;
  const gap = 16;
  const rightSpace = window.innerWidth - mapRect.right;

  for (const el of [restoreGameoverOverlayButton, mapScoreHud]) {
    el.style.bottom = "";
    el.style.right = "";
    el.style.left = "";
    el.style.top = "";
  }

  const top = Math.max(gap, mapRect.top + gap);
  mapScoreHud.style.left = `${gap}px`;
  mapScoreHud.style.top = `${top}px`;

  if (rightSpace >= buttonSize + gap * 2) {
    restoreGameoverOverlayButton.style.left = `${mapRect.right + gap}px`;
  } else {
    restoreGameoverOverlayButton.style.right = "16px";
  }
  restoreGameoverOverlayButton.style.top = `${top}px`;

  mapScoreHud.style.opacity = "1";
  restoreGameoverOverlayButton.style.opacity = "1";
  restoreGameoverOverlayButton.style.pointerEvents = "all";
};

export const hideGameoverMapControls = (): void => {
  restoreGameoverOverlayButton.style.opacity = "0";
  restoreGameoverOverlayButton.style.pointerEvents = "none";
  mapScoreHud.style.opacity = "0";
};

export const showGameover = (): void => {
  const score = session.pickups;
  uiContainer.style.zIndex = "";
  setHelpButtonVisible(false);

  if (score > Number(localStorage.getItem("Lando Curb"))) {
    localStorage.setItem("Lando Curb", String(score));
  }

  menuBackground.style.display = "";
  gameoverWrapper.style.display = "flex";
  menuBackground.style.clipPath = `polygon(0 0, 100% 0, 100% 100%, 0 100%)`;
  menuBackground.style.transition = `opacity 2s 1s`;
  gameoverHeader.style.transition = `opacity .5s 2s`;
  gameoverText1.style.transition = `opacity .5s 2s`;
  gameoverText2.style.transition = `opacity .5s 2s`;
  gameoverText3.style.transition = `opacity .5s 2s`;
  restartButtonWrapper.style.transition = `opacity .5s 2.5s`;
  menuButtonWrapper.style.transition = `opacity .5s 3s`;
  toggleGameoverlayButton.style.transition = `all .2s, opacity .5s 3.5s`;
  hideGameoverMapControls();

  const previousHighscore = Number(localStorage.getItem("Lando Curb") ?? 0);
  const highscore = Math.max(score, previousHighscore);
  scoreWrapper.innerText = `Score: ${score}`;
  highscoreText.innerText = `Highscore: ${highscore}`;
  mapScoreText.innerText = `Score: ${score}`;
  mapHighscoreText.innerText = `Highscore: ${highscore}`;
  mapRoadText.innerText = `Roads: ${streets.length}`;
  mapMotorwayText.innerText = `Motorways: ${
    streets.filter((street) => street.motorway).length
  }`;

  const pickupCount = createElement("u");
  pickupCount.innerText = `${session.pickups} deliveries`;

  gameoverText2.innerHTML = "";
  gameoverText2.append(pickupCount, " completed in your city.");

  gameoverText3.innerHTML = "";
  gameoverText3.append(scoreWrapper, highscoreText);

  gridToggleButton.style.transition = `all .2s`;
  gridToggleTooltip.style.opacity = "0";
  setGameplayControlsVisible(false);
  scoreCounters.style.opacity = "0";

  setTimeout(() => {
    toggleGameoverlayButton.style.pointerEvents = ""; // Is separate from the gameoverWrapper
    gameoverWrapper.style.pointerEvents = "";
    gameoverWrapper.style.opacity = "1";
    menuBackground.style.opacity = "1";
    gameoverHeader.style.opacity = "1";
    gameoverText1.style.opacity = "1";
    gameoverText2.style.opacity = "1";
    gameoverText3.style.opacity = "1";
    restartButtonWrapper.style.opacity = "1";
    menuButtonWrapper.style.opacity = "1";
    toggleGameoverlayButton.style.opacity = "1";
    toggleGameoverlayButton.style.pointerEvents = "all";
  });
};

export const focusOnLostPark = (p: Pixel): void => {
  svgElement.style.transition = `transform 2s ease-out .5s`;
  svgElement.style.transform = `rotate(-17deg) scale(2) translate(${-p.x}px, ${-p.y}px)`;
};

export const clearLostFocus = (): void => {
  svgElement.style.transform = "";
};

export const prepareRestart = (): void => {
  svgElement.style.transition = `transform 2s`;
  svgElement.style.transform = `rotate(0) scale(2) translate(0, ${svgPxToDisplayPx({ x: 0, y: grid.height }).y / -2}px)`;

  gridToggleButton.style.transition = `all .2s`;
  gridToggleTooltip.style.transition = `all .5s`;

  setGameplayControlsVisible(false);

  pauseButton.style.opacity = "0";

  toggleGameoverlayButton.style.opacity = "0";
  toggleGameoverlayButton.style.pointerEvents = "none";
  toggleGameoverlayButton.style.transition = `all .2s, opacity .5s`;
  hideGameoverMapControls();
};

export const transitionGameoverToMenu = (
  paths: number,
  onReady: () => void,
): void => {
  svgElement.style.transition = `transform 2s`;
  svgElement.style.transform = `rotate(0) scale(2) translate(0, ${svgPxToDisplayPx({ x: 0, y: grid.height }).y / -2}px)`;

  toggleGameoverlayButton.style.opacity = "0";
  toggleGameoverlayButton.style.pointerEvents = "none";
  toggleGameoverlayButton.style.transition = `all .2s, opacity .5s`;
  hideGameoverMapControls();

  gridToggleTooltip.style.transition = `all .2s, width .5s 4s, opacity .5s 4s`;
  gridToggleButton.style.transition = `all .2s, width .5s 4s, opacity .5s 4s`;

  gridToggleTooltip.style.width = "96px";
  setGameplayControlsVisible(false);

  setTimeout(() => {
    resetViewBox();
    clearLayers();
    hideGameover();
    svgElement.style.transform = "";
    pathTilesIndicatorCount.innerText = String(paths);

    onReady();
  }, 500);
};

export const hideGameover = (): void => {
  gameoverWrapper.style.transition = `opacity 1s 2s`;
  menuBackground.style.transition = `opacity 1s 1s`;
  gameoverHeader.style.transition = `opacity .3s .6s`;
  gameoverText1.style.transition = `opacity .3s .5s`;
  gameoverText2.style.transition = `opacity .3s .4s`;
  gameoverText3.style.transition = `opacity .3s .3s`;
  restartButtonWrapper.style.transition = `opacity .3s .2s`;
  menuButtonWrapper.style.transition = `opacity .3s .1s`;

  gameoverWrapper.style.pointerEvents = "none";
  gameoverWrapper.style.opacity = "0";
  menuBackground.style.opacity = "0";
  gameoverHeader.style.opacity = "0";
  gameoverText1.style.opacity = "0";
  gameoverText2.style.opacity = "0";
  gameoverText3.style.opacity = "0";
  restartButtonWrapper.style.opacity = "0";
  menuButtonWrapper.style.opacity = "0";
  toggleGameoverlayButton.style.pointerEvents = "none";
  toggleGameoverlayButton.style.opacity = "0";
  hideGameoverMapControls();

  // Remove from DOM once invisible — backdrop-filter and opacity stacking contexts
  // on full-screen elements interfere with game element z-ordering while hidden.
  menuBackground.addEventListener(
    "transitionend",
    () => {
      if (menuBackground.style.opacity === "0")
        menuBackground.style.display = "none";
    },
    { once: true },
  );
  gameoverWrapper.addEventListener(
    "transitionend",
    () => {
      if (gameoverWrapper.style.opacity === "0")
        gameoverWrapper.style.display = "none";
    },
    { once: true },
  );
};
