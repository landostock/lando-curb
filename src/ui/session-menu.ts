import { colors } from "../gfx/colors";
import { createElement, createSvgElement } from "../gfx/svg-utils";

const overlay = createElement();
const panel = createElement();
const titleRow = createElement();
const title = createElement();
const buttons = createElement();
const continueButton = createElement("button");
const fullscreenButton = createElement("button");
const fullscreenIconPath = createSvgElement("path");
const restartButton = createElement("button");
const mainMenuButton = createElement("button");

let open = false;
let refreshFullscreenButton = (): void => undefined;

const buttonCss = `
  display:flex;
  align-items:center;
  justify-content:center;
  min-width:180px;
  height:58px;
  padding:0 22px;
  border:2px solid ${colors.ui};
  border-radius:12px;
  background:#fff;
  color:${colors.ui};
  font:inherit;
  font-size:20px;
  cursor:pointer;
  pointer-events:all;
`;

export const initSessionMenu = ({
  onContinue,
  onToggleFullscreen,
  isFullscreenActive,
  onRestart,
  onMainMenu,
}: {
  onContinue: () => void;
  onToggleFullscreen: () => Promise<void> | void;
  isFullscreenActive: () => boolean;
  onRestart: () => void;
  onMainMenu: () => void;
}): void => {
  overlay.style.cssText = `
    position:absolute;
    inset:0;
    display:none;
    opacity:0;
    pointer-events:none;
    background:#fffb;
    backdrop-filter:blur(8px);
    clip-path:polygon(0 0, calc(20dvw + 400px) 0, calc(20dvw + 350px) 100%, 0 100%);
    transition:opacity .22s ease;
    z-index:35;
  `;

  panel.style.cssText = `
    position:absolute;
    inset:0;
    display:flex;
    flex-direction:column;
    padding:10vmin;
    box-sizing:border-box;
    color:${colors.ui};
    pointer-events:none;
  `;

  title.innerText = "Lando Curb";
  title.style.cssText = `
    font-size:72px;
    line-height:1;
    letter-spacing:0;
  `;
  titleRow.style.cssText = `
    display:flex;
    align-items:center;
    opacity:0;
    transition:opacity .2s ease .05s;
  `;

  buttons.style.cssText = `
    display:grid;
    gap:12px;
    width:max-content;
    max-width:100%;
    margin-top:48px;
    opacity:0;
    transition:opacity .2s ease .1s;
  `;

  continueButton.innerText = "Continue";
  restartButton.innerText = "Restart";
  mainMenuButton.innerText = "Main Menu";
  continueButton.style.cssText = `${buttonCss}background:${colors.ui};color:#fff;`;
  fullscreenButton.style.cssText = `
    position:absolute;
    top:calc(10vmin + 2px);
    left:min(calc(20dvw + 306px), calc(100vw - 68px));
    display:grid;
    place-items:center;
    width:44px;
    height:44px;
    padding:0;
    border-radius:50%;
    background:#fff;
    color:${colors.ui};
    cursor:pointer;
    opacity:0;
    pointer-events:all;
    transition:opacity .2s ease .05s, transform .18s ease, background .18s ease, color .18s ease;
    box-shadow:inset 0 0 0 1px rgba(68,68,51,.16), 0 10px 26px rgba(20,24,16,.14);
  `;
  restartButton.style.cssText = buttonCss;
  mainMenuButton.style.cssText = buttonCss;

  const fullscreenIcon = createSvgElement("svg");
  fullscreenIcon.setAttribute("viewBox", "0 0 16 16");
  fullscreenIcon.setAttribute("width", "24");
  fullscreenIcon.setAttribute("height", "24");
  fullscreenIconPath.setAttribute("fill", "none");
  fullscreenIconPath.setAttribute("stroke", "currentColor");
  fullscreenIconPath.setAttribute("stroke-width", "1.8");
  fullscreenIconPath.setAttribute("stroke-linecap", "round");
  fullscreenIconPath.setAttribute("stroke-linejoin", "round");
  fullscreenIcon.append(fullscreenIconPath);
  fullscreenButton.replaceChildren(fullscreenIcon);

  continueButton.addEventListener("click", onContinue);
  fullscreenButton.addEventListener("click", () => {
    void Promise.resolve(onToggleFullscreen()).finally(refreshFullscreenButton);
  });
  restartButton.addEventListener("click", onRestart);
  mainMenuButton.addEventListener("click", onMainMenu);

  refreshFullscreenButton = (): void => {
    const active = isFullscreenActive();
    fullscreenButton.title = active ? "Exit fullscreen" : "Enter fullscreen";
    fullscreenButton.setAttribute("aria-label", fullscreenButton.title);
    fullscreenButton.style.background = active ? colors.ui : "#fff";
    fullscreenButton.style.color = active ? "#fff" : colors.ui;
    fullscreenIconPath.setAttribute(
      "d",
      active
        ? "M6 3v3H3M10 3v3h3M10 13v-3h3M6 13v-3H3"
        : "M6.5 3.5h-3v3M9.5 3.5h3v3M12.5 9.5v3h-3M6.5 12.5h-3v-3",
    );
  };
  refreshFullscreenButton();

  buttons.append(continueButton, restartButton, mainMenuButton);
  titleRow.append(title);
  panel.append(titleRow, fullscreenButton, buttons);
  overlay.append(panel);
  document.body.append(overlay);
};

export const isSessionMenuOpen = (): boolean => open;

export const showSessionMenu = (): void => {
  if (open) return;
  open = true;
  refreshFullscreenButton();
  overlay.style.display = "block";
  overlay.style.pointerEvents = "all";
  requestAnimationFrame(() => {
    overlay.style.opacity = "1";
    titleRow.style.opacity = "1";
    fullscreenButton.style.opacity = "1";
    buttons.style.opacity = "1";
  });
};

export const hideSessionMenu = (): void => {
  if (!open) return;
  open = false;
  overlay.style.opacity = "0";
  overlay.style.pointerEvents = "none";
  titleRow.style.opacity = "0";
  fullscreenButton.style.opacity = "0";
  buttons.style.opacity = "0";
  setTimeout(() => {
    if (!open) overlay.style.display = "none";
  }, 240);
};
