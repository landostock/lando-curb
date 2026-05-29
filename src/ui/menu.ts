import { board, grid } from "../board";
import {
  activeChallengeIds,
  canCombineChallenge,
  type ChallengeDefinition,
  clearActiveChallenges,
  type RuleChallengeId,
  ruleChallenges,
  selectedStartMode,
  setActiveChallenges,
  setSelectedStartMode,
} from "../challenge";
import { colors } from "../gfx/colors";
import { svgPxToDisplayPx } from "../gfx/coords";
import { svgElement } from "../gfx/svg";
import { createElement, createSvgElement } from "../gfx/svg-utils";
import {
  generateBerlinMap,
  generateOstholsteinMap,
  generateRandomMap,
} from "../logic/generate-map";
import { requestFullscreen } from "../util/fullscreen";
import { createChallengeIcon } from "./challenge-icon";
import { gameoverWrapper } from "./gameover";
import {
  gridToggleTooltip,
  hideGameHud,
  setGameplayControlsVisible,
  setHelpButtonVisible,
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
const modeButtons = createElement();
const zenModeButton = createElement("button");
const challengeModeButton = createElement("button");
const challengeOverlay = createElement();
const challengePanel = createElement();
const challengeTitle = createElement();
const challengeCopy = createElement();
const challengeOptionsGrid = createElement();
const challengeCloseButton = createElement("button");
const challengeStartButton = createElement("button");
const modeHint = createElement();
const challengeCards = new Map<RuleChallengeId, HTMLButtonElement>();

let challengePickerOpen = false;
let challengeStartAction: (() => void) | undefined;
let challengeCancelAction: (() => void) | undefined;
let pendingChallengeIds = new Set<RuleChallengeId>();
let menuLayoutListenerBound = false;

const isCompactLandscapeMenu = (): boolean => {
  const width = document.body.clientWidth || innerWidth;
  const height = document.body.clientHeight || innerHeight;
  return height <= 560 && width > height;
};

const applyMenuLayout = (): void => {
  const compact = isCompactLandscapeMenu();
  menuWrapper.style.padding = compact
    ? "calc(env(safe-area-inset-top, 0px) + 14px) calc(env(safe-area-inset-right, 0px) + 36px) calc(env(safe-area-inset-bottom, 0px) + 12px) calc(env(safe-area-inset-left, 0px) + 44px)"
    : "10vmin";

  const logoSvg = menuLogo.querySelector("svg");
  if (logoSvg) {
    logoSvg.setAttribute("width", compact ? "50" : "80");
    logoSvg.setAttribute("height", compact ? "50" : "80");
  }
  menuLogo.style.marginBottom = compact ? "6px" : "12px";
  menuHeader.style.fontSize = compact ? "44px" : "72px";
  menuHeader.style.lineHeight = "1";

  modeButtons.style.gridTemplateColumns = compact
    ? "repeat(2, minmax(150px, 228px))"
    : "repeat(2, minmax(150px, 230px))";
  modeButtons.style.gap = compact ? "10px" : "12px";
  modeButtons.style.marginTop = compact ? "16px" : "32px";

  for (const button of [zenModeButton, challengeModeButton]) {
    button.style.height = compact ? "46px" : "54px";
    button.style.padding = compact ? "0 12px 0 15px" : "0 14px 0 17px";
    button.style.fontSize = compact ? "16px" : "18px";
  }

  menuButtons.style.gridTemplateColumns = compact
    ? "repeat(3, minmax(116px, 1fr))"
    : "";
  menuButtons.style.gap = compact ? "10px" : "12px";
  menuButtons.style.marginTop = compact ? "18px" : "34px";
  menuButtons.style.width = compact
    ? "min(680px, calc(var(--app-width, 100vw) - 96px))"
    : "";
  menuButtons.style.maxWidth = compact ? "680px" : "";

  for (const button of [startButton, berlinButton, ostholsteinButton]) {
    button.style.width = compact ? "100%" : "";
    button.style.minWidth = "0";
    button.style.height = compact ? "48px" : "";
    button.style.padding = compact ? "8px 13px" : "10px 18px";
    button.style.fontSize = compact ? "18px" : "20px";
  }

  menuText1.style.display = compact ? "none" : "";
};

const updateChallengeButtons = (): void => {
  const challengeModeSelected =
    selectedStartMode === "challenge" || challengePickerOpen;
  zenModeButton.setAttribute(
    "aria-pressed",
    challengeModeSelected ? "false" : "true",
  );
  challengeModeButton.setAttribute(
    "aria-pressed",
    challengeModeSelected ? "true" : "false",
  );

  zenModeButton.style.background = challengeModeSelected ? "#fff" : "#443";
  zenModeButton.style.color = challengeModeSelected ? "#443" : "#fff";
  zenModeButton.style.boxShadow = challengeModeSelected
    ? "0 5px 12px #0000000f"
    : "0 0 0 2px #fff, 0 8px 18px #4434";
  challengeModeButton.style.background = challengeModeSelected ? "#443" : "#fff";
  challengeModeButton.style.color = challengeModeSelected ? "#fff" : "#443";
  challengeModeButton.style.boxShadow = challengeModeSelected
    ? "0 0 0 2px #fff, 0 8px 18px #4434"
    : "0 5px 12px #0000000f";

  for (const [id, button] of challengeCards) {
    const selected = pendingChallengeIds.has(id);
    const accent = button.dataset.accent ?? "#443";
    const compatible = selected || canCombineChallenge(id, pendingChallengeIds);
    button.style.background = selected
      ? `linear-gradient(90deg, ${accent} 0, ${accent} 8px, #fffdf8 8px)`
      : "#fff";
    button.style.color = "#443";
    button.style.borderColor = selected ? accent : "rgba(68,68,51,.12)";
    button.style.boxShadow = selected
      ? `0 0 0 2px #fff, 0 14px 30px ${accent}2e`
      : "0 5px 12px #0000000f";
    button.style.transform = selected ? "translateY(-2px)" : "";
    button.style.opacity = compatible ? "1" : ".42";
    button.style.pointerEvents = compatible ? "all" : "none";
    button.setAttribute("aria-pressed", selected ? "true" : "false");
    button.setAttribute("aria-disabled", compatible ? "false" : "true");
  }

  const canStart = pendingChallengeIds.size > 0;
  challengeStartButton.style.opacity = canStart ? "1" : ".42";
  challengeStartButton.style.pointerEvents = canStart ? "all" : "none";
};

const setChallengePickerOpen = (open: boolean): void => {
  if (challengePickerOpen === open) {
    updateChallengeButtons();
    return;
  }
  challengePickerOpen = open;
  challengeOverlay.style.opacity = open ? "1" : "0";
  challengeOverlay.style.visibility = open ? "visible" : "hidden";
  challengeOverlay.style.pointerEvents = open ? "all" : "none";
  challengeOverlay.style.transition = open
    ? "opacity .34s ease"
    : "opacity .34s ease, visibility 0s linear .34s";
  challengePanel.style.transform = open
    ? "translateY(0) scale(1)"
    : "translateY(10px) scale(.985)";
  updateChallengeButtons();
};

const hideModeHint = (): void => {
  modeHint.style.opacity = "0";
  modeHint.style.transform = "translateY(-4px)";
};

const showModeHint = (copy: string): void => {
  modeHint.innerText = copy;
  modeHint.style.opacity = "1";
  modeHint.style.transform = "translateY(0)";
};

const createModeInfo = (copy: string): HTMLElement => {
  const info = createElement();
  info.innerText = "?";
  info.title = copy;
  info.setAttribute("aria-label", copy);
  info.setAttribute("role", "button");
  info.setAttribute("tabindex", "0");
  info.style.cssText = `
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    margin-left: auto;
    border-radius: 50%;
    background: rgba(68,68,51,.1);
    color: currentColor;
    font-size: 14px;
    font-weight: 900;
    line-height: 1;
    cursor: help;
  `;
  const openHint = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    showModeHint(copy);
  };
  info.addEventListener("click", openHint);
  info.addEventListener("keydown", (event) => {
    const keyEvent = event as KeyboardEvent;
    if (keyEvent.key !== "Enter" && keyEvent.key !== " ") return;
    openHint(event);
  });
  return info;
};

const createChallengeCard = (
  challenge: ChallengeDefinition & { id: RuleChallengeId },
): HTMLButtonElement => {
  const button = createElement("button");
  button.style.cssText = `
    display: grid;
    grid-template-columns: 60px minmax(0, 1fr);
    align-items: center;
    gap: 13px;
    height: auto;
    min-height: 82px;
    padding: 11px 13px;
    border-radius: 12px;
    border: 2px solid ${challenge.accent};
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition: transform .18s, background .18s, color .18s, box-shadow .18s;
  `;
  button.dataset.accent = challenge.accent;

  const iconFrame = createElement();
  iconFrame.style.cssText = `
    display:grid;
    place-items:center;
    width:54px;
    height:54px;
    border-radius:15px;
    color:${challenge.accent};
    background:#fbfaf4;
    box-shadow:
      inset 0 0 0 1px rgba(68,68,51,.12),
      0 5px 12px rgba(20,24,16,.06);
  `;
  iconFrame.append(createChallengeIcon(challenge.id, { size: 41 }));

  const title = createElement();
  title.innerText = challenge.title;
  title.style.cssText = `
    font-size:16px;
    line-height:1.05;
    margin-bottom:5px;
  `;
  const copy = createElement();
  copy.innerText = challenge.description;
  copy.style.cssText = `
    max-width: 100%;
    font-size:12px;
    line-height:1.32;
    font-weight:700;
    opacity:.74;
  `;

  button.setAttribute("aria-label", challenge.title);
  const textBlock = createElement();
  textBlock.style.cssText = `
    min-width:0;
    align-self:center;
  `;
  textBlock.append(title, copy);
  button.append(iconFrame, textBlock);
  button.addEventListener("click", () => {
    if (pendingChallengeIds.has(challenge.id)) {
      pendingChallengeIds.delete(challenge.id);
    } else if (canCombineChallenge(challenge.id, pendingChallengeIds)) {
      pendingChallengeIds.add(challenge.id);
    }
    updateChallengeButtons();
  });
  challengeCards.set(challenge.id, button);
  return button;
};

const initChallengeModeControls = (): void => {
  modeButtons.style.cssText = `
    display: grid;
    grid-template-columns: repeat(2, minmax(150px, 230px));
    gap: 12px;
    margin-top: 32px;
    opacity: 0;
  `;

  const modeButtonCss = `
    display: flex;
    align-items: center;
    gap: 12px;
    height: 54px;
    padding: 0 14px 0 17px;
    border-radius: 12px;
    border: 2px solid #443;
    font: inherit;
    font-size: 18px;
    cursor: pointer;
    transition: transform .18s, background .18s, color .18s, box-shadow .18s;
  `;
  zenModeButton.style.cssText = modeButtonCss;
  challengeModeButton.style.cssText = modeButtonCss;
  zenModeButton.append(
    document.createTextNode("Zen Mode"),
    createModeInfo("Classic play with full controls."),
  );
  challengeModeButton.append(
    document.createTextNode("Challenge Mode"),
    createModeInfo(
      "Pick a map first, then combine challenge rules before the run begins.",
    ),
  );
  zenModeButton.addEventListener("click", () => {
    setSelectedStartMode("zen");
    setChallengePickerOpen(false);
    hideModeHint();
    updateChallengeButtons();
  });
  challengeModeButton.addEventListener("click", () => {
    setSelectedStartMode("challenge");
    hideModeHint();
    updateChallengeButtons();
  });
  modeHint.style.cssText = `
    grid-column: 1 / -1;
    min-height: 18px;
    max-width: 440px;
    font-size: 12px;
    line-height: 1.25;
    font-weight: 750;
    color: rgba(68,68,51,.72);
    opacity: 0;
    transform: translateY(-4px);
    transition: opacity .16s ease, transform .16s ease;
  `;
  modeButtons.append(zenModeButton, challengeModeButton, modeHint);

  challengeOverlay.style.cssText = `
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 22px;
    box-sizing: border-box;
    background: rgba(238, 243, 228, .46);
    backdrop-filter: blur(9px) saturate(1.05);
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transition: opacity .34s ease, visibility 0s linear .34s;
    z-index: 4;
  `;
  challengePanel.style.cssText = `
    position: relative;
    width: min(760px, calc(var(--app-width, 100vw) - 44px));
    max-height: calc(var(--app-height, 100dvh) - 44px);
    overflow: auto;
    box-sizing: border-box;
    padding: 22px 24px 26px;
    border-radius: 18px;
    background: rgba(238, 243, 228, .9);
    backdrop-filter: blur(14px) saturate(1.04);
    color: ${colors.ui};
    box-shadow:
      0 22px 70px rgba(20, 24, 16, .24),
      inset 0 0 0 1px rgba(68, 68, 51, .1);
    transform: translateY(10px) scale(.985);
    transition: transform .34s cubic-bezier(.2, 1.12, .28, 1);
  `;

  challengeCloseButton.style.cssText = `
    position: absolute;
    top: 16px;
    right: 16px;
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    padding: 0;
    border-radius: 50%;
    background: #fff;
    color: ${colors.ui};
    pointer-events: all;
  `;
  const challengeCloseIcon = createSvgElement("svg");
  challengeCloseIcon.setAttribute("viewBox", "0 0 24 24");
  challengeCloseIcon.setAttribute("width", "22");
  challengeCloseIcon.setAttribute("height", "22");
  challengeCloseIcon.setAttribute("aria-hidden", "true");
  challengeCloseIcon.setAttribute("fill", "none");
  challengeCloseIcon.setAttribute("stroke", "currentColor");
  challengeCloseIcon.setAttribute("stroke-width", "3");
  challengeCloseIcon.setAttribute("stroke-linecap", "round");
  const closeLineA = createSvgElement("line");
  closeLineA.setAttribute("x1", "7");
  closeLineA.setAttribute("y1", "7");
  closeLineA.setAttribute("x2", "17");
  closeLineA.setAttribute("y2", "17");
  const closeLineB = createSvgElement("line");
  closeLineB.setAttribute("x1", "17");
  closeLineB.setAttribute("y1", "7");
  closeLineB.setAttribute("x2", "7");
  closeLineB.setAttribute("y2", "17");
  challengeCloseIcon.append(closeLineA, closeLineB);
  challengeCloseButton.replaceChildren(challengeCloseIcon);
  challengeCloseButton.setAttribute("aria-label", "Close challenge picker");
  challengeCloseButton.addEventListener("click", () => {
    setChallengePickerOpen(false);
    challengeCancelAction?.();
  });

  challengeTitle.style.cssText = `
    margin: 0;
    padding-right: 48px;
    font-size: 28px;
    line-height: 1;
    letter-spacing: 0;
  `;
  challengeTitle.innerText = "Select Challenges";
  challengeCopy.style.cssText = `
    margin-top: 9px;
    max-width: 560px;
    font-size: 14px;
    line-height: 1.45;
  `;
  challengeCopy.innerText =
    "Combine any compatible rules, then start.";

  challengeOptionsGrid.style.cssText = `
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 9px;
    margin-top: 18px;
  `;
  challengeOptionsGrid.append(
    ...ruleChallenges.map(createChallengeCard),
  );
  challengeStartButton.style.cssText = `
    display: inline-grid;
    place-items: center;
    height: 42px;
    margin-top: 14px;
    padding: 0 18px;
    border-radius: 12px;
    background: ${colors.ui};
    color: #fff;
    font: inherit;
    font-size: 15px;
    cursor: pointer;
    transition: opacity .16s ease, transform .16s ease, box-shadow .16s ease;
    box-shadow: 0 10px 24px rgba(20,24,16,.16);
  `;
  challengeStartButton.innerText = "Start Game";
  challengeStartButton.addEventListener("click", () => {
    if (!pendingChallengeIds.size) return;
    void requestFullscreen();
    setActiveChallenges([...pendingChallengeIds]);
    setChallengePickerOpen(false);
    challengeStartAction?.();
  });
  challengePanel.append(
    challengeCloseButton,
    challengeTitle,
    challengeCopy,
    challengeOptionsGrid,
    challengeStartButton,
  );
  challengeOverlay.append(challengePanel);
  document.body.append(challengeOverlay);
  updateChallengeButtons();
};

export const showChallengeStartPicker = ({
  onCancel,
  onStart,
}: {
  onCancel: () => void;
  onStart: () => void;
}): void => {
  pendingChallengeIds = new Set(activeChallengeIds);
  clearActiveChallenges();
  challengeStartAction = onStart;
  challengeCancelAction = onCancel;
  setChallengePickerOpen(true);
};

export const initMenu = (
  startWithMap: (map: (delay: number) => void) => void,
): void => {
  if (!menuLayoutListenerBound) {
    menuLayoutListenerBound = true;
    addEventListener("resize", applyMenuLayout);
  }

  const startMapWithFullscreen = (map: (delay: number) => void): void => {
    void requestFullscreen();
    startWithMap(map);
  };

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
    font: inherit; font-size: 20px;
    padding: 10px 18px; border: 2px solid #333; border-radius: 10px;
    background: #fff; cursor: pointer;
    transition: transform .15s, background .15s;
  `;
  startButton.style.cssText = buttonCss;
  berlinButton.style.cssText = buttonCss;
  ostholsteinButton.style.cssText = buttonCss;

  initChallengeModeControls();

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
  startButton.addEventListener("click", () =>
    startMapWithFullscreen(generateRandomMap),
  );
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
  berlinButton.addEventListener("click", () =>
    startMapWithFullscreen(generateBerlinMap),
  );
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
    startMapWithFullscreen(generateOstholsteinMap),
  );
  ostholsteinButtonWrapper.style.opacity = "0";

  menuButtons.style.cssText = `display: grid; gap: 12px; margin-top: 34px;`;
  startButtonWrapper.append(startButton);
  berlinButtonWrapper.append(berlinButton);
  ostholsteinButtonWrapper.append(ostholsteinButton);

  menuButtons.append(
    startButtonWrapper,
    berlinButtonWrapper,
    ostholsteinButtonWrapper,
  );

  menuWrapper.append(
    menuLogo,
    menuHeader,
    modeButtons,
    menuButtons,
    menuText1,
  );

  applyMenuLayout();
  document.body.append(menuWrapper);
};

export const showMenu = (
  focus: { x: number; y: number; width: number; height: number },
  firstTime?: boolean,
): void => {
  menuBackground.style.display = "";
  if (!menuWrapper.isConnected) document.body.append(menuWrapper);
  applyMenuLayout();
  menuWrapper.style.pointerEvents = "none";
  updateChallengeButtons();
  menuBackground.style.clipPath = `polygon(0 0, calc(20dvw + 400px) 0, calc(20dvw + 350px) 100%, 0 100%)`;
  menuBackground.style.transition = `clip-path 1s, opacity 2s`;
  menuLogo.style.transition = `opacity .5s .8s`;
  menuHeader.style.transition = `opacity .5s 1s`;
  modeButtons.style.transition = `opacity .5s 1.12s`;
  startButtonWrapper.style.transition = `opacity .5s 1.28s`;
  berlinButtonWrapper.style.transition = `opacity .5s 1.38s`;
  ostholsteinButtonWrapper.style.transition = `opacity .5s 1.48s`;
  menuText1.style.transition = `opacity .5s 1.6s`;

  // Buttons become interactive once fully visible (last fades in at 0.5s + 1.4s delay).
  clearTimeout(pointerEventsTimer);
  pointerEventsTimer = setTimeout(() => {
    menuWrapper.style.pointerEvents = "";
  }, 1900);

  // First time the game is loaded, the menu background needs to be fast
  if (firstTime) {
    menuBackground.style.transition = `opacity 0s`;
    menuLogo.style.transition = `opacity .5s .2s`;
    menuHeader.style.transition = `opacity .5s .4s`;
    modeButtons.style.transition = `opacity .5s .55s`;
    startButtonWrapper.style.transition = `opacity .5s .72s`;
    berlinButtonWrapper.style.transition = `opacity .5s .82s`;
    ostholsteinButtonWrapper.style.transition = `opacity .5s .92s`;
    menuText1.style.transition = `opacity .5s 1s`;
    clearTimeout(pointerEventsTimer);
    pointerEventsTimer = setTimeout(() => {
      menuWrapper.style.pointerEvents = "";
    }, 1300);
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
  modeButtons.style.opacity = "1";
  menuText1.style.opacity = "1";
  startButtonWrapper.style.opacity = "1";
  berlinButtonWrapper.style.opacity = "1";
  ostholsteinButtonWrapper.style.opacity = "1";
  gridToggleTooltip.style.opacity = "0";
  setHelpButtonVisible(true);
  hideGameHud();
  setGameplayControlsVisible(false);
};

export const hideMenu = (): void => {
  clearTimeout(pointerEventsTimer);
  menuWrapper.style.pointerEvents = "none";
  menuWrapper.remove();
  uiContainer.style.zIndex = "";

  menuBackground.style.transition = `opacity 1s .6s`;
  menuLogo.style.transition = `opacity .3s .45s`;
  menuHeader.style.transition = `opacity .3s .4s`;
  modeButtons.style.transition = `opacity .3s .32s`;
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
  modeButtons.style.opacity = "0";
  setChallengePickerOpen(false);

  // Remove from DOM once fully invisible so backdrop-filter doesn't create
  // a stacking context that interferes with game element z-ordering.
  menuBackground.addEventListener(
    "transitionend",
    () => {
      if (menuBackground.style.opacity === "0")
        menuBackground.style.display = "none";
    },
    { once: true },
  );

  gridToggleTooltip.style.opacity = "0";
  gridToggleTooltip.style.width = "0";

  svgElement.style.transition = `transform 2s`;
  svgElement.style.transform = "";

  gridToggleTooltip.style.transition = `all .5s`;
  setGameplayControlsVisible(false);
};
