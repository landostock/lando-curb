import { colors } from "../gfx/colors";
import { createElement } from "../gfx/svg-utils";

const overlay = createElement();
const panel = createElement();
const title = createElement();
const buttons = createElement();
const continueButton = createElement("button");
const restartButton = createElement("button");
const mainMenuButton = createElement("button");

let open = false;

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
  onRestart,
  onMainMenu,
}: {
  onContinue: () => void;
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
  restartButton.style.cssText = buttonCss;
  mainMenuButton.style.cssText = buttonCss;

  continueButton.addEventListener("click", onContinue);
  restartButton.addEventListener("click", onRestart);
  mainMenuButton.addEventListener("click", onMainMenu);

  buttons.append(continueButton, restartButton, mainMenuButton);
  panel.append(title, buttons);
  overlay.append(panel);
  document.body.append(overlay);
};

export const isSessionMenuOpen = (): boolean => open;

export const showSessionMenu = (): void => {
  if (open) return;
  open = true;
  overlay.style.display = "block";
  overlay.style.pointerEvents = "all";
  requestAnimationFrame(() => {
    overlay.style.opacity = "1";
    title.style.opacity = "1";
    buttons.style.opacity = "1";
  });
};

export const hideSessionMenu = (): void => {
  if (!open) return;
  open = false;
  overlay.style.opacity = "0";
  overlay.style.pointerEvents = "none";
  title.style.opacity = "0";
  buttons.style.opacity = "0";
  setTimeout(() => {
    if (!open) overlay.style.display = "none";
  }, 240);
};
