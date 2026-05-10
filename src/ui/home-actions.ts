import { playHomeSwapPop, playHouseDemolish } from "../audio";
import { board } from "../board";
import { Commuter } from "../entities/commuter";
import { House } from "../entities/house";
import { colors } from "../gfx/colors";
import { svgElement } from "../gfx/svg";
import {
  createElement,
  createSvgElement,
  gridCellSize,
  toSvgEdge,
} from "../gfx/svg-utils";
import { gridHide, gridShow } from "../input/grid-toggle";
import { commitStreetChanges } from "../logic/orchestrator";
import {
  houseInCell,
  isAreaFree,
  streetWouldClipBuilding,
} from "../logic/placement-obstacles";
import { addHouse, session } from "../state";
import type { Cell, Direction, Rect } from "../types";
import { inRect } from "../util/geometry";
import {
  developerMode,
  homeActionIndicator,
  homeActionIndicatorCount,
  setDeveloperModeButtonSuppressed,
  updateInventoryCounters,
} from "./ui";

type Mode = "closed" | "choose" | "swap" | "movePick" | "movePlace";

const DIRECTIONS: Direction[] = [
  { x: 0, y: -1 } as Direction,
  { x: 1, y: 0 } as Direction,
  { x: 0, y: 1 } as Direction,
  { x: -1, y: 0 } as Direction,
];

const shell = createElement();
const panel = createElement();
const title = createElement();
const closeButton = createElement("button");
const body = createElement();
const status = createElement();
const primaryButton = createElement("button");
const secondaryButton = createElement("button");
const swapButton = createElement("button");
const moveButton = createElement("button");
const placementMarker = createSvgElement("rect");

let mode: Mode = "closed";
let selectedHouses: House[] = [];
let moveHouse: House | null = null;
let queuedSwap: [House, House] | null = null;
let queuedMoveHouse: House | null = null;
let readyCheckTimer: ReturnType<typeof setInterval> | undefined;
let rebuildGridVisible = false;
let placement:
  | {
      cell: Cell;
      facing: Direction;
    }
  | null = null;
let pendingMove:
  | {
      type: string;
      style?: string;
      original: { x: number; y: number; facing: Direction };
    }
  | null = null;

const canSpendHomeAction = (): boolean =>
  developerMode || session.homeActions > 0;

const houseIsReady = (house: House): boolean =>
  house.children.every(
    (child) => !(child instanceof Commuter) || child.state === "home",
  );

const setStatus = (text: string): void => {
  status.innerText = text;
};

const clearReadyCheck = (): void => {
  clearInterval(readyCheckTimer);
  readyCheckTimer = undefined;
};

const markHouse = (house: House, selected: boolean): void => {
  house.svgGroup.style.filter = selected
    ? "drop-shadow(0 0 1.6px #fff) drop-shadow(0 0 4px rgba(68,68,51,.9))"
    : "";
};

const clearMarks = (): void => {
  for (const house of selectedHouses) {
    markHouse(house, false);
    house.place();
  }
  if (moveHouse) {
    markHouse(moveHouse, false);
    moveHouse.place();
  }
  selectedHouses = [];
  moveHouse = null;
};

const hidePlacementMarker = (): void => {
  placementMarker.style.display = "none";
};

const showPlacementMarker = (cell: Cell, valid: boolean): void => {
  placementMarker.setAttribute("x", String(toSvgEdge(cell.x) + 1));
  placementMarker.setAttribute("y", String(toSvgEdge(cell.y) + 1));
  placementMarker.setAttribute("width", String(gridCellSize - 2));
  placementMarker.setAttribute("height", String(gridCellSize - 2));
  placementMarker.setAttribute("stroke", valid ? colors.ui : colors.red);
  placementMarker.setAttribute("fill", valid ? "#ffffff44" : "#ff000014");
  placementMarker.style.display = "";
};

const consumeAction = (): void => {
  if (!developerMode) session.homeActions = Math.max(0, session.homeActions - 1);
  updateInventoryCounters();
};

const flashUnavailable = (): void => {
  homeActionIndicator.style.scale = "1.1";
  homeActionIndicatorCount.innerText = "!";
  setTimeout(() => {
    homeActionIndicator.style.scale = "1";
    homeActionIndicatorCount.innerText = String(session.homeActions);
  }, 300);
};

const createChoiceButton = (
  button: HTMLButtonElement,
  label: string,
  detail: string,
  icon: string,
): void => {
  const iconSvg = createSvgElement("svg");
  iconSvg.setAttribute("viewBox", "0 0 24 24");
  iconSvg.style.width = "36px";
  iconSvg.style.height = "36px";
  const iconPath = createSvgElement("path");
  iconPath.setAttribute("d", icon);
  iconPath.setAttribute("fill", "none");
  iconPath.setAttribute("stroke", colors.ui);
  iconPath.setAttribute("stroke-width", "2");
  iconPath.setAttribute("stroke-linecap", "round");
  iconPath.setAttribute("stroke-linejoin", "round");
  iconSvg.append(iconPath);

  const copy = createElement();
  copy.innerHTML = `<span>${label}</span><small>${detail}</small>`;
  copy.style.cssText = `
    display:grid;
    gap:2px;
  `;

  button.style.cssText = `
    display:grid;
    grid-template-columns:42px 1fr;
    align-items:center;
    gap:10px;
    height:auto;
    min-height:72px;
    padding:12px 14px;
    border-radius:16px;
    text-align:left;
    font-size:16px;
    line-height:1.15;
    background:#fff;
    pointer-events:all;
    box-shadow:inset 0 0 0 1px rgba(68,68,51,.11), 0 10px 26px rgba(20,24,16,.12);
  `;
  button.replaceChildren(iconSvg, copy);
};

const setPrimaryEnabled = (enabled: boolean): void => {
  primaryButton.disabled = !enabled;
  primaryButton.style.opacity = enabled ? "1" : ".42";
  primaryButton.style.pointerEvents = enabled ? "all" : "none";
};

const setPanelInteractive = (interactive: boolean): void => {
  panel.style.pointerEvents = interactive ? "all" : "none";
};

const dockPanel = (docked: boolean): void => {
  panel.style.left = docked ? "auto" : "50%";
  panel.style.right = docked ? "14px" : "";
  panel.style.top = docked ? "14px" : "16px";
  panel.style.width = docked ? "min(320px, calc(100vw - 28px))" : "min(440px, calc(100vw - 32px))";
  panel.style.transform = docked ? "translateX(0)" : "translateX(-50%)";
  panel.style.opacity = docked ? ".76" : "1";
};

const holdHouse = (house: House, held: boolean): void => {
  house.homeActionHold = held;
};

const releaseHeldHouses = (): void => {
  for (const house of selectedHouses) holdHouse(house, false);
  if (moveHouse) holdHouse(moveHouse, false);
  if (queuedSwap) {
    holdHouse(queuedSwap[0], false);
    holdHouse(queuedSwap[1], false);
  }
  if (queuedMoveHouse) holdHouse(queuedMoveHouse, false);
};

const showRebuildGrid = (): void => {
  rebuildGridVisible = true;
  gridShow();
};

const hideRebuildGrid = (): void => {
  if (!rebuildGridVisible) return;
  rebuildGridVisible = false;
  gridHide();
};

const setTitle = (text: string, icon: string): void => {
  const iconSvg = createSvgElement("svg");
  iconSvg.setAttribute("viewBox", "0 0 24 24");
  iconSvg.style.width = "30px";
  iconSvg.style.height = "30px";
  const iconPath = createSvgElement("path");
  iconPath.setAttribute("d", icon);
  iconPath.setAttribute("fill", "none");
  iconPath.setAttribute("stroke", colors.ui);
  iconPath.setAttribute("stroke-width", "2.2");
  iconPath.setAttribute("stroke-linecap", "round");
  iconPath.setAttribute("stroke-linejoin", "round");
  iconSvg.append(iconPath);

  const label = createElement();
  label.innerText = text;
  title.replaceChildren(iconSvg, label);
};

const renderChoose = (): void => {
  mode = "choose";
  clearReadyCheck();
  releaseHeldHouses();
  hideRebuildGrid();
  clearMarks();
  queuedSwap = null;
  queuedMoveHouse = null;
  placement = null;
  pendingMove = null;
  hidePlacementMarker();
  dockPanel(false);
  setTitle("Home Action", "M4 11 12 5l8 6M7 10v8h10v-8M10 18v-4h4v4");
  body.replaceChildren(swapButton, moveButton);
  setStatus("Choose how to reshape your neighborhood.");
  primaryButton.style.display = "none";
  secondaryButton.style.display = "none";
};

const renderSwap = (): void => {
  mode = "swap";
  clearReadyCheck();
  releaseHeldHouses();
  hideRebuildGrid();
  clearMarks();
  queuedSwap = null;
  queuedMoveHouse = null;
  placement = null;
  pendingMove = null;
  hidePlacementMarker();
  dockPanel(true);
  setTitle("Swap Houses", "M7 8h10M14 5l3 3-3 3M17 16H7M10 13l-3 3 3 3");
  body.replaceChildren();
  primaryButton.innerText = "Confirm Swap";
  primaryButton.style.display = "";
  secondaryButton.innerText = "Back";
  secondaryButton.style.display = "";
  setPrimaryEnabled(false);
  setStatus("Click any two houses. Busy houses will swap when their cars return.");
};

const renderMovePick = (): void => {
  mode = "movePick";
  clearReadyCheck();
  releaseHeldHouses();
  hideRebuildGrid();
  clearMarks();
  queuedSwap = null;
  queuedMoveHouse = null;
  placement = null;
  pendingMove = null;
  hidePlacementMarker();
  dockPanel(true);
  setTitle("Move House", "M4 11 12 5l8 6M7 10v8h10v-8M10 18v-4h4v4");
  body.replaceChildren();
  primaryButton.innerText = "Confirm Demolition";
  primaryButton.style.display = "";
  secondaryButton.innerText = "Back";
  secondaryButton.style.display = "";
  setPrimaryEnabled(false);
  setStatus("Click any house. If cars are away, demolition waits for their return.");
};

const candidateFacing = (cell: Cell): Direction | null => {
  if (!inRect(cell, board)) return null;
  for (const facing of DIRECTIONS) {
    const endpoint = { x: cell.x + facing.x, y: cell.y + facing.y } as Cell;
    if (!inRect(endpoint, board)) continue;
    if (
      isAreaFree({
        rect: { x: cell.x, y: cell.y, width: 1, height: 1 } as Rect<Cell>,
        extra: facing,
        avoidTrees: false,
      }) &&
      !streetWouldClipBuilding(cell, endpoint)
    ) {
      return facing;
    }
  }
  return null;
};

const renderMovePlace = (): void => {
  mode = "movePlace";
  clearReadyCheck();
  clearMarks();
  placement = null;
  hidePlacementMarker();
  showRebuildGrid();
  dockPanel(true);
  setTitle("Place House", "M5 12h14M12 5v14M7 9l5-4 5 4");
  body.replaceChildren();
  primaryButton.innerText = "Build Here";
  primaryButton.style.display = "";
  secondaryButton.innerText = "Undo Demolition";
  secondaryButton.style.display = "";
  setPrimaryEnabled(false);
  setStatus("Click an open field with room for the new driveway.");
};

const applySwap = (a: House, b: House): void => {
  holdHouse(a, false);
  holdHouse(b, false);
  a.lift();
  b.lift();
  const aType = a.type;
  a.setType(b.type);
  b.setType(aType);
  playHomeSwapPop();
  consumeAction();
  setTimeout(() => {
    a.place();
    b.place();
  }, 180);
  close();
};

const demolishHouse = (house: House): void => {
  queuedMoveHouse = null;
  holdHouse(house, false);
  pendingMove = {
    type: house.type,
    style: house.style,
    original: {
      x: house.x,
      y: house.y,
      facing: house.facing,
    },
  };
  house.remove();
  moveHouse = null;
  playHouseDemolish();
  commitStreetChanges();
  renderMovePlace();
};

const waitForReady = (
  houses: House[],
  message: string,
  onReady: () => void,
): void => {
  clearReadyCheck();
  houses.forEach((house) => holdHouse(house, true));
  setPrimaryEnabled(false);
  setStatus(message);
  readyCheckTimer = setInterval(() => {
    if (!houses.every(houseIsReady)) return;
    clearReadyCheck();
    onReady();
  }, 180);
};

const restorePendingMove = (): void => {
  if (!pendingMove) return;
  addHouse(
    new House({
      x: pendingMove.original.x,
      y: pendingMove.original.y,
      facing: pendingMove.original.facing,
      type: pendingMove.type,
      style: pendingMove.style,
    }),
  );
  commitStreetChanges();
  pendingMove = null;
};

const close = (): void => {
  clearReadyCheck();
  restorePendingMove();
  releaseHeldHouses();
  hideRebuildGrid();
  clearMarks();
  queuedSwap = null;
  queuedMoveHouse = null;
  placement = null;
  hidePlacementMarker();
  dockPanel(false);
  mode = "closed";
  shell.style.opacity = "0";
  shell.style.pointerEvents = "none";
  shell.style.display = "none";
  setPanelInteractive(false);
  setDeveloperModeButtonSuppressed(false);
};

const open = (): void => {
  if (!canSpendHomeAction()) {
    flashUnavailable();
    return;
  }
  shell.style.display = "block";
  shell.style.opacity = "1";
  shell.style.pointerEvents = "none";
  setPanelInteractive(true);
  setDeveloperModeButtonSuppressed(true);
  renderChoose();
};

const confirmSwap = (): void => {
  if (selectedHouses.length !== 2) return;
  const [a, b] = selectedHouses;
  if (!a || !b) return;
  if (a.type === b.type) {
    setStatus("Pick two different house colors.");
    return;
  }
  if (queuedSwap) {
    return;
  }
  if (houseIsReady(a) && houseIsReady(b)) {
    applySwap(a, b);
    return;
  }
  queuedSwap = [a, b];
  waitForReady(
    [a, b],
    "Swap queued. It will fire the moment both driveways are clear.",
    () => applySwap(a, b),
  );
};

const confirmDemolition = (): void => {
  if (!moveHouse) return;
  if (queuedMoveHouse) {
    return;
  }
  if (houseIsReady(moveHouse)) {
    demolishHouse(moveHouse);
    return;
  }
  queuedMoveHouse = moveHouse;
  waitForReady(
    [moveHouse],
    "Demolition queued. The crew waits until both cars are back.",
    () => {
      if (queuedMoveHouse) demolishHouse(queuedMoveHouse);
    },
  );
};

const confirmBuild = (): void => {
  if (!pendingMove || !placement) return;
  addHouse(
    new House({
      x: placement.cell.x,
      y: placement.cell.y,
      facing: placement.facing,
      type: pendingMove.type,
      style: pendingMove.style,
    }),
  );
  consumeAction();
  commitStreetChanges();
  pendingMove = null;
  hideRebuildGrid();
  close();
};

const handlePrimary = (): void => {
  if (mode === "swap") confirmSwap();
  else if (mode === "movePick") confirmDemolition();
  else if (mode === "movePlace") confirmBuild();
};

export const handleHomeActionCellClick = (cell: Cell): boolean => {
  if (mode !== "swap" && mode !== "movePick" && mode !== "movePlace")
    return false;

  if (mode === "swap") {
    const house = houseInCell(cell);
    if (!house) {
      setStatus("Pick houses, not empty lots.");
      return true;
    }
    if (selectedHouses.includes(house)) {
      selectedHouses = selectedHouses.filter((h) => h !== house);
      markHouse(house, false);
      house.place();
    } else if (selectedHouses.length < 2) {
      selectedHouses.push(house);
      markHouse(house, true);
      house.lift();
    }
    if (queuedSwap) {
      queuedSwap = null;
      clearReadyCheck();
      releaseHeldHouses();
    }
    setPrimaryEnabled(selectedHouses.length === 2);
    setStatus(
      selectedHouses.length === 2
        ? "Ready to swap."
        : "Click one more house.",
    );
    return true;
  }

  if (mode === "movePick") {
    const house = houseInCell(cell);
    if (!house) {
      setStatus("Pick the house you want to move.");
      return true;
    }
    if (moveHouse) {
      holdHouse(moveHouse, false);
      markHouse(moveHouse, false);
      moveHouse.place();
    }
    if (queuedMoveHouse) {
      queuedMoveHouse = null;
      clearReadyCheck();
      releaseHeldHouses();
    }
    moveHouse = house;
    markHouse(house, true);
    house.lift();
    setPrimaryEnabled(true);
    setStatus("Demolition is armed.");
    return true;
  }

  const facing = candidateFacing(cell);
  showPlacementMarker(cell, !!facing);
  if (!facing) {
    placement = null;
    setPrimaryEnabled(false);
    setStatus("That field is blocked or has no room for a driveway.");
    return true;
  }
  placement = { cell, facing };
  setPrimaryEnabled(true);
  setStatus("Good spot. Confirm to rebuild.");
  return true;
};

export const isHomeActionActive = (): boolean => mode !== "closed";

export const isHomeActionPlacingHouse = (): boolean => mode === "movePlace";

export const closeHomeActions = (): void => {
  close();
};

export const initHomeActions = (): void => {
  placementMarker.setAttribute("fill", "none");
  placementMarker.setAttribute("stroke-width", "0.45");
  placementMarker.setAttribute("rx", "0.8");
  placementMarker.style.pointerEvents = "none";
  placementMarker.style.display = "none";
  placementMarker.style.filter = "drop-shadow(0 0 1.2px rgba(255,255,255,.8))";
  svgElement.append(placementMarker);

  shell.style.cssText = `
    position:absolute;
    inset:0;
    display:none;
    pointer-events:none;
    opacity:0;
    transition:opacity .22s ease;
    z-index:3;
  `;
  panel.style.cssText = `
    position:absolute;
    left:50%;
    top:16px;
    width:min(440px, calc(100vw - 32px));
    box-sizing:border-box;
    transform:translateX(-50%);
    border-radius:18px;
    padding:16px;
    background:#eef3e4;
    color:${colors.ui};
    box-shadow:0 22px 70px rgba(20,24,16,.26), inset 0 0 0 1px rgba(68,68,51,.1);
    pointer-events:none;
    transition:opacity .16s ease, transform .22s ease, right .22s ease, left .22s ease, width .22s ease;
  `;
  panel.addEventListener("mouseenter", () => {
    if (mode !== "choose" && mode !== "closed") panel.style.opacity = "1";
  });
  panel.addEventListener("mouseleave", () => {
    if (mode !== "choose" && mode !== "closed") panel.style.opacity = ".76";
  });
  title.style.cssText = `
    display:flex;
    align-items:center;
    gap:10px;
    margin:0 42px 12px 0;
    font-size:24px;
    line-height:1;
    letter-spacing:0;
  `;
  closeButton.innerText = "X";
  closeButton.style.cssText = `
    position:absolute;
    top:14px;
    right:14px;
    width:34px;
    height:34px;
    padding:0;
    display:grid;
    place-items:center;
    border-radius:50%;
    font-size:20px;
    line-height:1;
    background:#fff;
    pointer-events:all;
  `;
  body.style.cssText = `
    display:grid;
    grid-template-columns:repeat(2, minmax(0, 1fr));
    gap:12px;
  `;
  status.style.cssText = `
    min-height:24px;
    margin:14px 0 0;
    font-size:15px;
    line-height:1.4;
  `;
  primaryButton.style.cssText = `
    margin-top:14px;
    width:100%;
    height:46px;
    border-radius:14px;
    font-size:17px;
    background:${colors.ui};
    color:#fff;
    pointer-events:all;
  `;
  secondaryButton.style.cssText = `
    margin-top:10px;
    width:100%;
    height:40px;
    border-radius:14px;
    font-size:15px;
    background:#fff;
    pointer-events:all;
  `;
  createChoiceButton(
    swapButton,
    "Swap Houses",
    "Trade two home colors.",
    "M7 8h10M14 5l3 3-3 3M17 16H7M10 13l-3 3 3 3",
  );
  createChoiceButton(
    moveButton,
    "Move House",
    "Demolish, then rebuild.",
    "M4 11 12 5l8 6M7 10v8h10v-8M10 18v-4h4v4",
  );
  swapButton.addEventListener("click", renderSwap);
  moveButton.addEventListener("click", renderMovePick);
  closeButton.addEventListener("click", close);
  primaryButton.addEventListener("click", handlePrimary);
  secondaryButton.addEventListener("click", () => {
    if (mode === "movePlace") {
      restorePendingMove();
      renderChoose();
    } else renderChoose();
  });
  panel.append(title, closeButton, body, status, primaryButton, secondaryButton);
  shell.append(panel);
  document.body.append(shell);
  homeActionIndicator.addEventListener("click", open);
};
