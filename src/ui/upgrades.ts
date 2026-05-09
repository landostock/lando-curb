import { playUpgradeSound } from "../audio";
import { colors } from "../gfx/colors";
import { createElement, createSvgElement } from "../gfx/svg-utils";
import { lakes, session } from "../state";
import {
  bridgeIndicator,
  bridgeIndicatorCount,
  motorwayIndicator,
  motorwayIndicatorCount,
  pathTilesIndicatorCount,
} from "./ui";

// --- Upgrade picker UI ---
const overlay = createElement();
overlay.style.cssText = `
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  background: rgba(0,0,0,0.25);
  opacity: 0;
  pointer-events: none;
  transition: opacity .4s;
  z-index: 2;
`;

const pickerTitle = createElement();
pickerTitle.style.cssText = `
  position: absolute;
  top: 10vh;
  font-size: 32px;
  color: ${colors.ui};
`;
pickerTitle.innerText = "Choose an upgrade";
overlay.append(pickerTitle);

document.body.append(overlay);

interface UpgradeOption {
  title: string;
  icon: string; // SVG path d
  apply: () => void;
}

const roadsSeven: UpgradeOption = {
  title: "+7 Roads",
  icon: "M3 12h4q2 0 2-2t2-2h2q2 0 2 2t2 2h4",
  apply: () => {
    session.paths += 7;
    pathTilesIndicatorCount.innerText = String(session.paths);
  },
};

const motorways: UpgradeOption = {
  title: "+2 Motorways",
  icon: "M3 8h18M3 16h18",
  apply: () => {
    session.motorways += 2;
    motorwayIndicatorCount.innerText = String(session.motorways);
    motorwayIndicator.style.opacity = "1";
  },
};

const bridge: UpgradeOption = {
  title: "+1 Bridge",
  icon: "M3 16h18 M3 16 Q12 4 21 16 M6 16v4 M18 16v4",
  apply: () => {
    session.bridges += 10;
    bridgeIndicatorCount.innerText = String(session.bridges);
    bridgeIndicator.style.opacity = "1";
  },
};

const getAvailableOptions = (): UpgradeOption[] => {
  const others: UpgradeOption[] = [motorways];
  if (lakes.length > 0) others.push(bridge);
  return [roadsSeven, ...others];
};

const createCard = (
  option: UpgradeOption,
  delay: number,
  onPick: () => void,
): HTMLElement => {
  const card = createElement("button");
  card.style.cssText = `
    display: grid;
    place-items: center;
    gap: 8px;
    width: 140px;
    height: 160px;
    padding: 16px;
    font-size: 15px;
    border-radius: 16px;
    pointer-events: all;
    transform: scale(0);
    transition: transform .4s cubic-bezier(.5,2,.5,1) ${delay}ms, box-shadow .2s;
  `;

  const iconSvg = createSvgElement("svg");
  iconSvg.setAttribute("viewBox", "0 0 24 24");
  iconSvg.setAttribute("width", "48");
  iconSvg.setAttribute("height", "48");
  const iconPath = createSvgElement("path");
  iconPath.setAttribute("d", option.icon);
  iconPath.setAttribute("fill", "none");
  iconPath.setAttribute("stroke", colors.ui);
  iconPath.setAttribute("stroke-width", "2");
  iconPath.setAttribute("stroke-linecap", "round");
  iconPath.setAttribute("stroke-linejoin", "round");
  iconSvg.append(iconPath);

  const label = createElement();
  label.style.cssText = `font-size: 14px; text-align: center; line-height: 1.3`;
  label.innerText = option.title;

  card.append(iconSvg, label);

  card.addEventListener("click", () => {
    option.apply();
    playUpgradeSound();
    hideUpgradePicker();
    onPick();
  });

  return card;
};

let cards: HTMLElement[] = [];
let pickerOpen = false;
let cleanupTimer: ReturnType<typeof setTimeout> | undefined;

export const showUpgradePicker = (onPick: () => void): boolean => {
  if (pickerOpen) return false;
  pickerOpen = true;
  clearTimeout(cleanupTimer);
  cards.forEach((card) => card.remove());
  cards = [];

  const options = getAvailableOptions();

  cards = options.map((opt, i) => createCard(opt, i * 100, onPick));
  overlay.append(...cards);

  overlay.style.opacity = "1";
  overlay.style.pointerEvents = "all";

  // Trigger scale animation
  requestAnimationFrame(() => {
    cards.forEach((card) => {
      card.style.transform = "scale(1)";
    });
  });

  return true;
};

const hideUpgradePicker = (): void => {
  if (!pickerOpen) return;
  pickerOpen = false;
  overlay.style.opacity = "0";
  overlay.style.pointerEvents = "none";

  // Clean up cards after transition
  cleanupTimer = setTimeout(() => {
    cards.forEach((card) => card.remove());
    cards = [];
  }, 400);
};

export const resetUpgrades = (): void => {
  hideUpgradePicker();
};
