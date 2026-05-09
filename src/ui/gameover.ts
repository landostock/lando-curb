import { grid } from "../board";
import { colors } from "../gfx/colors";
import { svgPxToDisplayPx } from "../gfx/coords";
import { clearLayers } from "../gfx/layers";
import { resetViewBox, svgElement } from "../gfx/svg";
import { createElement } from "../gfx/svg-utils";
import { session } from "../state";
import type { Pixel } from "../types";
import { menuBackground } from "./menu";
import {
  gridRedToggleButton,
  gridRedToggleTooltip,
  gridToggleButton,
  gridToggleTooltip,
  pathTilesIndicatorCount,
  pauseButton,
  scoreCounters,
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
export const toggleGameoverlayButton = createElement("button");

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

  menuButtonWrapper.style.opacity = "0";
  restartButtonWrapper.style.opacity = "0";
  menuButtonWrapper.append(menuButton);
  restartButtonWrapper.append(restartButton);
  restartButton.innerText = "Restart";
  menuButton.innerText = "Menu";

  restartButton.addEventListener("click", startNewGame);

  menuButton.addEventListener("click", gameoverToMenu);

  gameoverButtons.append(restartButtonWrapper, menuButtonWrapper);
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

  toggleGameoverlayButton.style.cssText = `position: absolute; top: 10vmin; right: 10vmin`;
  toggleGameoverlayButton.style.pointerEvents = "none";
  toggleGameoverlayButton.style.opacity = "0";
  toggleGameoverlayButton.innerText = "Overlay On/Off";
  toggleGameoverlayButton.addEventListener("click", toggleGameoverlay);

  gameoverWrapper.append(
    gameoverHeader,
    gameoverText1,
    gameoverText2,
    gameoverText3,
    gameoverButtons,
  );

  document.body.append(gameoverWrapper, toggleGameoverlayButton);
};

export const showGameover = (): void => {
  const score = session.pickups;
  uiContainer.style.zIndex = "";

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

  scoreWrapper.innerHTML = `Score:${score}`;

  const pickupCount = createElement("u");
  pickupCount.innerText = `${session.pickups} deliveries`;

  gameoverText2.innerHTML = "";
  gameoverText2.append(pickupCount, " completed in your city.");

  gameoverText3.innerHTML = "";
  gameoverText3.append(scoreWrapper);

  gridRedToggleButton.style.transition = `all .2s`;
  gridToggleButton.style.transition = `all .2s`;
  gridRedToggleButton.style.opacity = "0";
  gridToggleButton.style.opacity = "0";
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

  gridRedToggleButton.style.transition = `all .2s, width .5s 4s, opacity .5s 3s`;
  gridToggleButton.style.transition = `all .2s, width .5s 4s, opacity .5s 3s`;

  gridRedToggleTooltip.style.transition = `all .5s`;
  gridToggleTooltip.style.transition = `all .5s`;

  gridRedToggleButton.style.opacity = "1";
  gridToggleButton.style.opacity = "1";

  pauseButton.style.opacity = "0";

  toggleGameoverlayButton.style.opacity = "0";
  toggleGameoverlayButton.style.pointerEvents = "none";
  toggleGameoverlayButton.style.transition = `all .2s, opacity .5s`;
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

  gridRedToggleTooltip.style.transition = `all .2s, width .5s 4s, opacity .5s 4s`;
  gridToggleTooltip.style.transition = `all .2s, width .5s 4s, opacity .5s 4s`;
  gridRedToggleButton.style.transition = `all .2s, width .5s 4s, opacity .5s 4s`;
  gridToggleButton.style.transition = `all .2s, width .5s 4s, opacity .5s 4s`;

  gridRedToggleTooltip.style.width = "96px";
  gridToggleTooltip.style.width = "96px";
  gridRedToggleTooltip.style.opacity = "1";
  gridToggleTooltip.style.opacity = "1";
  gridRedToggleButton.style.opacity = "1";
  gridToggleButton.style.opacity = "1";

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

  // Remove from DOM once invisible — backdrop-filter and opacity stacking contexts
  // on full-screen elements interfere with game element z-ordering while hidden.
  menuBackground.addEventListener(
    "transitionend",
    () => { if (menuBackground.style.opacity === "0") menuBackground.style.display = "none"; },
    { once: true },
  );
  gameoverWrapper.addEventListener(
    "transitionend",
    () => { if (gameoverWrapper.style.opacity === "0") gameoverWrapper.style.display = "none"; },
    { once: true },
  );
};
