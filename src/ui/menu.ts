import { board, grid } from "../board";
import { svgPxToDisplayPx } from "../gfx/coords";
import { svgElement } from "../gfx/svg";
import { createElement } from "../gfx/svg-utils";
import {
  generateBerlinMap,
  generateOstholsteinMap,
  generateRandomMap,
} from "../logic/generate-map";
import { gameoverWrapper } from "./gameover";
import {
  gridRedToggleButton,
  gridRedToggleTooltip,
  gridToggleButton,
  gridToggleTooltip,
  uiContainer,
} from "./ui";

export const menuBackground = createElement();
menuBackground.style.cssText = `
  backdrop-filter: blur(8px);
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: #fffb;
`;

// Inserted before gameoverWrapper so the semi-transparent overlay sits behind
// both gameover text and menu text. Called once on initial boot (not on HMR)
// to avoid resetting state mid-game.
export const initMenuBackground = (): void => {
  document.body.insertBefore(menuBackground, gameoverWrapper);
  menuBackground.style.display = "none";
  menuBackground.style.opacity = "0";
  menuBackground.style.clipPath =
    "polygon(0 0, calc(20dvw + 400px) 0, calc(20dvw + 350px) 100%, 0 100%)";
};

let pointerEventsTimer: ReturnType<typeof setTimeout> | undefined;

const menuWrapper = createElement();
const menuLogo = createElement();
const menuHeader = createElement();
const menuText1 = createElement();
const menuButtons = createElement();
const startButtonWrapper = createElement();
const startButton = createElement("button");
const berlinButtonWrapper = createElement();
const berlinButton = createElement("button");
const ostholsteinButtonWrapper = createElement();
const ostholsteinButton = createElement("button");

export const initMenu = (
  startWithMap: (map: (delay: number) => void) => void,
): void => {
  menuWrapper.style.cssText = `
    position: absolute;
    inset: 0;
    padding: 10vmin;
    display: flex;
    flex-direction: column;
  `;
  menuWrapper.style.pointerEvents = "none";

  menuLogo.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="80" height="80"><rect width="32" height="32" rx="6" fill="#8a5"/><path d="M6 6v12a8 8 0 0 0 8 8h12" fill="none" stroke="#dca" stroke-width="5" stroke-linecap="round"/><rect x="19.5" y="23.5" width="5" height="3" rx="0.8" fill="#e22"/></svg>`;
  menuLogo.style.cssText = `opacity: 0; margin-bottom: 12px;`;

  menuHeader.style.cssText = `font-size: 72px; opacity: 0;`;
  menuHeader.innerText = "Lando Curb";

  // Everything but bottom margin
  menuText1.style.cssText = `margin: auto 4px 0; opacity:0;`;

  const buttonCss = `
    display: flex; align-items: center; gap: 14px;
    font: inherit; font-size: 22px;
    padding: 12px 20px; border: 2px solid #333; border-radius: 10px;
    background: #fff; cursor: pointer;
    transition: transform .15s, background .15s;
  `;
  startButton.style.cssText = buttonCss;
  berlinButton.style.cssText = buttonCss;
  ostholsteinButton.style.cssText = buttonCss;

  // Dice — random map
  startButton.innerHTML = `
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="4" fill="#fff" stroke="#333" stroke-width="2"/>
      <circle cx="8" cy="8" r="1.6" fill="#333"/>
      <circle cx="16" cy="8" r="1.6" fill="#333"/>
      <circle cx="12" cy="12" r="1.6" fill="#333"/>
      <circle cx="8" cy="16" r="1.6" fill="#333"/>
      <circle cx="16" cy="16" r="1.6" fill="#333"/>
    </svg>
    <span>Random</span>`;
  startButton.addEventListener("click", () => startWithMap(generateRandomMap));
  startButtonWrapper.style.opacity = "0";

  // Fernsehturm — Berlin
  berlinButton.innerHTML = `
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      <line x1="12" y1="22" x2="12" y2="6" stroke="#888" stroke-width="2" stroke-linecap="round"/>
      <circle cx="12" cy="9" r="3" fill="#ddd" stroke="#888" stroke-width="1"/>
      <line x1="12" y1="6" x2="12" y2="2" stroke="#555" stroke-width="1.2" stroke-linecap="round"/>
      <circle cx="12" cy="2.2" r="0.9" fill="#e33"/>
      <line x1="6" y1="22" x2="18" y2="22" stroke="#555" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
    <span>Berlin</span>`;
  berlinButton.addEventListener("click", () => startWithMap(generateBerlinMap));
  berlinButtonWrapper.style.opacity = "0";

  // Schloss Eutin — Ostholstein
  ostholsteinButton.innerHTML = `
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      <!-- main wall + crenellations -->
      <path d="M3 10h2v-2h2v2h2v-2h2v2h2v-2h2v2h2v-2h2v2h2v11H3z" fill="#e9a" stroke="#a55" stroke-width="1"/>
      <!-- corner towers -->
      <rect x="2" y="7"  width="3" height="14" fill="#e9a" stroke="#a55" stroke-width="1"/>
      <rect x="19" y="7" width="3" height="14" fill="#e9a" stroke="#a55" stroke-width="1"/>
      <!-- red conical roofs -->
      <polygon points="2,7 3.5,3 5,7" fill="#c44" stroke="#802" stroke-width="0.6"/>
      <polygon points="19,7 20.5,3 22,7" fill="#c44" stroke="#802" stroke-width="0.6"/>
      <!-- gate -->
      <path d="M11 21v-4a1 1 0 0 1 2 0v4z" fill="#5a3"/>
      <!-- flag on central keep -->
      <line x1="12" y1="8" x2="12" y2="4" stroke="#555" stroke-width="0.8"/>
      <polygon points="12,4 15.5,4.8 12,5.8" fill="#e33"/>
    </svg>
    <span>Ostholstein</span>`;
  ostholsteinButton.addEventListener("click", () =>
    startWithMap(generateOstholsteinMap),
  );
  ostholsteinButtonWrapper.style.opacity = "0";

  menuButtons.style.cssText = `display: grid; gap: 12px; margin-top: 48px;`;
  startButtonWrapper.append(startButton);
  berlinButtonWrapper.append(berlinButton);
  ostholsteinButtonWrapper.append(ostholsteinButton);

  menuButtons.append(
    startButtonWrapper,
    berlinButtonWrapper,
    ostholsteinButtonWrapper,
  );

  menuWrapper.append(menuLogo, menuHeader, menuButtons, menuText1);

  document.body.append(menuWrapper);
};

export const showMenu = (
  focus: { x: number; y: number; width: number; height: number },
  firstTime?: boolean,
): void => {
  menuBackground.style.display = "";
  if (!menuWrapper.isConnected) document.body.append(menuWrapper);
  menuWrapper.style.pointerEvents = "none";
  menuBackground.style.clipPath = `polygon(0 0, calc(20dvw + 400px) 0, calc(20dvw + 350px) 100%, 0 100%)`;
  menuBackground.style.transition = `clip-path 1s, opacity 2s`;
  menuLogo.style.transition = `opacity .5s .8s`;
  menuHeader.style.transition = `opacity .5s 1s`;
  startButtonWrapper.style.transition = `opacity .5s 1.2s`;
  berlinButtonWrapper.style.transition = `opacity .5s 1.3s`;
  ostholsteinButtonWrapper.style.transition = `opacity .5s 1.4s`;
  menuText1.style.transition = `opacity .5s 1.6s`;

  // Buttons become interactive once fully visible (last fades in at 0.5s + 1.4s delay).
  clearTimeout(pointerEventsTimer);
  pointerEventsTimer = setTimeout(() => { menuWrapper.style.pointerEvents = ""; }, 1900);

  // First time the game is loaded, the menu background needs to be fast
  if (firstTime) {
    menuBackground.style.transition = `opacity 0s`;
    menuLogo.style.transition = `opacity .5s .2s`;
    menuHeader.style.transition = `opacity .5s .4s`;
    startButtonWrapper.style.transition = `opacity .5s .6s`;
    berlinButtonWrapper.style.transition = `opacity .5s .7s`;
    ostholsteinButtonWrapper.style.transition = `opacity .5s .8s`;
    menuText1.style.transition = `opacity .5s 1s`;
    clearTimeout(pointerEventsTimer);
    pointerEventsTimer = setTimeout(() => { menuWrapper.style.pointerEvents = ""; }, 1300);
  }

  const highscore = localStorage.getItem("Lando Curb");
  menuText1.innerHTML = highscore
    ? `Highscore: ${highscore}`
    : "Tip: Left click & drag to connect houses to<br>business parks, or delete roads with right click.";

  const businessParkPxPosition = svgPxToDisplayPx({
    x: focus.x - grid.width / 2 - board.x + focus.width / 2,
    y: focus.y - grid.height / 2 - board.y + focus.height / 2,
  });
  const xOffset = innerWidth / 4; // TODO: Calculate properly?
  svgElement.style.transition = "";
  svgElement.style.transform = `translate(${xOffset}px, 0) rotate(-17deg) scale(2) translate(${-businessParkPxPosition.x}px, ${-businessParkPxPosition.y}px)`;

  uiContainer.style.zIndex = "1";
  menuBackground.style.opacity = "1";
  menuLogo.style.opacity = "1";
  menuHeader.style.opacity = "1";
  menuText1.style.opacity = "1";
  startButtonWrapper.style.opacity = "1";
  berlinButtonWrapper.style.opacity = "1";
  ostholsteinButtonWrapper.style.opacity = "1";
};

export const hideMenu = (): void => {
  clearTimeout(pointerEventsTimer);
  menuWrapper.style.pointerEvents = "none";
  menuWrapper.remove();
  uiContainer.style.zIndex = "";

  menuBackground.style.transition = `opacity 1s .6s`;
  menuLogo.style.transition = `opacity .3s .45s`;
  menuHeader.style.transition = `opacity .3s .4s`;
  startButtonWrapper.style.transition = `opacity .3s .2s`;
  berlinButtonWrapper.style.transition = `opacity .3s .15s`;
  ostholsteinButtonWrapper.style.transition = `opacity .3s .1s`;
  menuText1.style.transition = `opacity .3s .1s`;

  menuBackground.style.opacity = "0";
  menuLogo.style.opacity = "0";
  startButtonWrapper.style.opacity = "0";
  berlinButtonWrapper.style.opacity = "0";
  ostholsteinButtonWrapper.style.opacity = "0";
  menuText1.style.opacity = "0";
  menuHeader.style.opacity = "0";

  // Remove from DOM once fully invisible so backdrop-filter doesn't create
  // a stacking context that interferes with game element z-ordering.
  menuBackground.addEventListener(
    "transitionend",
    () => { if (menuBackground.style.opacity === "0") menuBackground.style.display = "none"; },
    { once: true },
  );

  gridRedToggleTooltip.style.opacity = "0";
  gridToggleTooltip.style.opacity = "0";
  gridRedToggleTooltip.style.width = "0";
  gridToggleTooltip.style.width = "0";

  svgElement.style.transition = `transform 2s`;
  svgElement.style.transform = "";

  gridRedToggleTooltip.style.transition = `all .5s`;
  gridToggleTooltip.style.transition = `all .5s`;
  gridRedToggleButton.style.opacity = "1";
  gridToggleButton.style.opacity = "1";
};
