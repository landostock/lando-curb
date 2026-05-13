import { playUpgradeSound } from "../audio";
import { colors } from "../gfx/colors";
import { createElement, createSvgElement } from "../gfx/svg-utils";
import { lakes, session } from "../state";
import { closeHomeActions } from "./home-actions";
import {
  bridgeIndicator,
  homeActionIndicator,
  motorwayIndicator,
  setDeveloperModeButtonSuppressed,
  setHelpButtonVisible,
  setResourceHudElevated,
  updateInventoryCounters,
} from "./ui";

// --- Upgrade picker UI ---
const overlay = createElement();
overlay.style.cssText = `
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  box-sizing: border-box;
  background: rgba(31, 38, 24, .32);
  backdrop-filter: blur(8px) saturate(1.08);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity .28s ease, visibility 0s linear .28s;
  z-index: 2;
`;

const pickerPanel = createElement();
pickerPanel.style.cssText = `
  position: relative;
  width: min(780px, calc(100vw - 48px));
  box-sizing: border-box;
  padding: 30px;
  border-radius: 24px;
  background: #eef3e4;
  color: ${colors.ui};
  box-shadow:
    0 24px 80px rgba(20, 24, 16, .28),
    inset 0 0 0 1px rgba(68, 68, 51, .1);
  transform: translateY(12px) scale(.98);
  transition: transform .28s cubic-bezier(.2, 1.4, .35, 1);
`;

const mapPeekButton = createElement("button");
mapPeekButton.style.cssText = `
  position:absolute;
  top:18px;
  right:18px;
  display:grid;
  grid-auto-flow:column;
  align-items:center;
  gap:8px;
  height:42px;
  padding:0 14px;
  font-size:16px;
  background:#fff;
  color:${colors.ui};
  pointer-events:all;
`;
mapPeekButton.innerText = "Map";

const returnToPickerButton = createElement("button");
returnToPickerButton.style.cssText = `
  position:absolute;
  top:16px;
  right:16px;
  height:48px;
  padding:0 18px;
  font-size:18px;
  background:#fff;
  color:${colors.ui};
  opacity:0;
  pointer-events:none;
  transition:opacity .18s ease;
  z-index:3;
`;
returnToPickerButton.innerText = "Upgrades";

const pickerTitle = createElement();
pickerTitle.style.cssText = `
  margin: 0;
  font-size: 38px;
  line-height: 1;
  letter-spacing: 0;
`;
pickerTitle.innerText = "Choose an upgrade";

const pickerCopy = createElement();
pickerCopy.style.cssText = `
  margin-top: 10px;
  max-width: 560px;
  font-size: 16px;
  line-height: 1.45;
`;
pickerCopy.innerText = "Pick the tool that best rescues the shape of your city.";

const optionsGrid = createElement();
optionsGrid.style.cssText = `
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 14px;
  margin-top: 24px;
`;

pickerPanel.append(mapPeekButton, pickerTitle, pickerCopy, optionsGrid);
overlay.append(pickerPanel, returnToPickerButton);

document.body.append(overlay);

interface UpgradeOption {
  title: string;
  icon: string; // SVG path d
  apply: () => void;
}

const roadsEight: UpgradeOption = {
  title: "+8 Roads",
  icon: "M3 12h4q2 0 2-2t2-2h2q2 0 2 2t2 2h4",
  apply: () => {
    session.paths += 8;
    updateInventoryCounters();
  },
};

const motorways: UpgradeOption = {
  title: "+2 Motorways",
  icon: "M3 8h18M3 16h18",
  apply: () => {
    session.motorways += 2;
    updateInventoryCounters();
    motorwayIndicator.style.opacity = "1";
  },
};

const bridge: UpgradeOption = {
  title: "+1 Bridge",
  icon: "M3 16h18 M3 16 Q12 4 21 16 M6 16v4 M18 16v4",
  apply: () => {
    session.bridges += 10;
    updateInventoryCounters();
    bridgeIndicator.style.opacity = "1";
  },
};

const homeAction: UpgradeOption = {
  title: "+1 Home Action",
  icon: "M3 11 12 4l9 7M6 9v9h12V9M10 18v-5h4v5",
  apply: () => {
    session.homeActions += 1;
    updateInventoryCounters();
    homeActionIndicator.style.opacity = "1";
  },
};

const getAvailableOptions = (): UpgradeOption[] => {
  const others: UpgradeOption[] = [motorways, homeAction];
  if (lakes.length > 0) others.push(bridge);
  return [roadsEight, ...others];
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
    gap: 12px;
    min-height: 164px;
    padding: 18px 14px;
    font-size: 15px;
    border-radius: 18px;
    background: #fff;
    pointer-events: all;
    transform: translateY(14px) scale(.96);
    opacity: 0;
    transition:
      transform .42s cubic-bezier(.2,1.7,.35,1) ${delay}ms,
      opacity .22s ease ${delay}ms,
      box-shadow .2s,
      background .2s;
    box-shadow:
      inset 0 0 0 1px rgba(68,68,51,.1),
      0 12px 28px rgba(20,24,16,.12);
  `;

  const iconFrame = createElement();
  iconFrame.style.cssText = `
    display:grid;
    place-items:center;
    width:74px;
    height:74px;
    border-radius:22px;
    background:#f7f7f0;
    box-shadow:inset 0 0 0 1px rgba(68,68,51,.08);
  `;

  const iconSvg = createSvgElement("svg");
  iconSvg.setAttribute("viewBox", "0 0 24 24");
  iconSvg.setAttribute("width", "54");
  iconSvg.setAttribute("height", "54");
  const iconPath = createSvgElement("path");
  iconPath.setAttribute("d", option.icon);
  iconPath.setAttribute("fill", "none");
  iconPath.setAttribute("stroke", colors.ui);
  iconPath.setAttribute("stroke-width", "2");
  iconPath.setAttribute("stroke-linecap", "round");
  iconPath.setAttribute("stroke-linejoin", "round");
  iconSvg.append(iconPath);
  iconFrame.append(iconSvg);

  const label = createElement();
  label.style.cssText = `
    font-size: 15px;
    text-align: center;
    line-height: 1.2;
    max-width: 120px;
  `;
  label.innerText = option.title;

  card.append(iconFrame, label);

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

const setPickerPanelInteractive = (interactive: boolean): void => {
  pickerPanel.style.pointerEvents = interactive ? "all" : "none";
  mapPeekButton.style.pointerEvents = interactive ? "all" : "none";
};

const setMapPeekOpen = (open: boolean): void => {
  overlay.style.background = open ? "rgba(31, 38, 24, 0)" : "rgba(31, 38, 24, .32)";
  overlay.style.backdropFilter = open ? "none" : "blur(8px) saturate(1.08)";
  pickerPanel.style.opacity = open ? "0" : "1";
  setPickerPanelInteractive(!open);
  pickerPanel.style.transform = open
    ? "translateY(8px) scale(.98)"
    : "translateY(0) scale(1)";
  returnToPickerButton.style.opacity = open ? "1" : "0";
  returnToPickerButton.style.pointerEvents = open ? "all" : "none";
};

mapPeekButton.addEventListener("click", () => setMapPeekOpen(true));
returnToPickerButton.addEventListener("click", () => setMapPeekOpen(false));

export const showUpgradePicker = (onPick: () => void): boolean => {
  if (pickerOpen) return false;
  pickerOpen = true;
  setMapPeekOpen(false);
  closeHomeActions();
  clearTimeout(cleanupTimer);
  cards.forEach((card) => card.remove());
  cards = [];

  const options = getAvailableOptions();

  cards = options.map((opt, i) => createCard(opt, i * 100, onPick));
  optionsGrid.append(...cards);

  overlay.style.visibility = "visible";
  overlay.style.transition = "opacity .28s ease";
  overlay.style.opacity = "1";
  overlay.style.pointerEvents = "all";
  pickerPanel.style.transform = "translateY(0) scale(1)";
  setDeveloperModeButtonSuppressed(true);
  setHelpButtonVisible(false);
  setResourceHudElevated(true);

  // Trigger scale animation
  requestAnimationFrame(() => {
    cards.forEach((card) => {
      card.style.transform = "translateY(0) scale(1)";
      card.style.opacity = "1";
    });
  });

  return true;
};

const hideUpgradePicker = (): void => {
  if (!pickerOpen) return;
  pickerOpen = false;
  setMapPeekOpen(false);
  overlay.style.opacity = "0";
  overlay.style.pointerEvents = "none";
  overlay.style.visibility = "hidden";
  overlay.style.transition = "opacity .28s ease, visibility 0s linear .28s";
  pickerPanel.style.transform = "translateY(12px) scale(.98)";
  setPickerPanelInteractive(false);
  returnToPickerButton.style.pointerEvents = "none";
  cards.forEach((card) => {
    card.style.pointerEvents = "none";
  });
  setDeveloperModeButtonSuppressed(false);
  setHelpButtonVisible(true);
  setResourceHudElevated(false);

  // Clean up cards after transition
  cleanupTimer = setTimeout(() => {
    cards.forEach((card) => card.remove());
    cards = [];
  }, 400);
};

export const resetUpgrades = (): void => {
  hideUpgradePicker();
};
