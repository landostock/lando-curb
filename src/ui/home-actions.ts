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
  toSvgPoint,
} from "../gfx/svg-utils";
import { gameInputLocked } from "../input/game-input-lock";
import { gridHide, gridShow } from "../input/grid-toggle";
import { houseTypeChangesWouldMixColors } from "../logic/color-lock";
import { commitStreetChanges } from "../logic/orchestrator";
import {
  cellIsObstructed,
  houseInCell,
  streetWouldClipBuilding,
} from "../logic/placement-obstacles";
import { addHouse, session, streets } from "../state";
import type { Cell, Direction, Point } from "../types";
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

const ROAD_STROKE_RADIUS = 3.14 / 2;
const MOVED_HOUSE_STREET_CLEARANCE = 0.05;
const GEOMETRY_EPSILON = 1e-6;

const shell = createElement();
const panel = createElement();
const actionBar = createElement();
const actionCopy = createElement();
const actionTitle = createElement();
const actionHint = createElement();
const actionControls = createElement();
const barBackButton = createElement("button");
const barCloseButton = createElement("button");
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
let suspendedForOverlay = false;
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
  actionHint.innerText = text;
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

interface SvgRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const movedHouseHalfSize = (style?: string): Point =>
  style === "plattenbau" ? { x: 3, y: 2.4 } : { x: 2.8, y: 2.8 };

const distanceToSegment = (point: Point, start: Point, end: Point): number => {
  const vx = end.x - start.x;
  const vy = end.y - start.y;
  const wx = point.x - start.x;
  const wy = point.y - start.y;
  const len2 = vx * vx + vy * vy;
  const t = len2 > 0 ? Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2)) : 0;
  const px = start.x + vx * t;
  const py = start.y + vy * t;
  return Math.hypot(point.x - px, point.y - py);
};

const distanceToRect = (point: Point, rect: SvgRect): number => {
  const dx = Math.max(rect.left - point.x, 0, point.x - rect.right);
  const dy = Math.max(rect.top - point.y, 0, point.y - rect.bottom);
  return Math.hypot(dx, dy);
};

const segmentDirection = (a: Point, b: Point, c: Point): number =>
  (c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x);

const pointOnSegment = (point: Point, start: Point, end: Point): boolean =>
  Math.min(start.x, end.x) - GEOMETRY_EPSILON <= point.x &&
  point.x <= Math.max(start.x, end.x) + GEOMETRY_EPSILON &&
  Math.min(start.y, end.y) - GEOMETRY_EPSILON <= point.y &&
  point.y <= Math.max(start.y, end.y) + GEOMETRY_EPSILON &&
  Math.abs(segmentDirection(start, end, point)) <= GEOMETRY_EPSILON;

const segmentsIntersect = (
  a: Point,
  b: Point,
  c: Point,
  d: Point,
): boolean => {
  const d1 = segmentDirection(a, b, c);
  const d2 = segmentDirection(a, b, d);
  const d3 = segmentDirection(c, d, a);
  const d4 = segmentDirection(c, d, b);

  return (
    ((d1 > GEOMETRY_EPSILON && d2 < -GEOMETRY_EPSILON) ||
      (d1 < -GEOMETRY_EPSILON && d2 > GEOMETRY_EPSILON)) &&
      ((d3 > GEOMETRY_EPSILON && d4 < -GEOMETRY_EPSILON) ||
        (d3 < -GEOMETRY_EPSILON && d4 > GEOMETRY_EPSILON)) ||
    (Math.abs(d1) <= GEOMETRY_EPSILON && pointOnSegment(c, a, b)) ||
    (Math.abs(d2) <= GEOMETRY_EPSILON && pointOnSegment(d, a, b)) ||
    (Math.abs(d3) <= GEOMETRY_EPSILON && pointOnSegment(a, c, d)) ||
    (Math.abs(d4) <= GEOMETRY_EPSILON && pointOnSegment(b, c, d))
  );
};

const pointInSvgRect = (point: Point, rect: SvgRect): boolean =>
  point.x >= rect.left &&
  point.x <= rect.right &&
  point.y >= rect.top &&
  point.y <= rect.bottom;

const segmentIntersectsRect = (
  start: Point,
  end: Point,
  rect: SvgRect,
): boolean => {
  if (pointInSvgRect(start, rect) || pointInSvgRect(end, rect)) return true;

  const topLeft = { x: rect.left, y: rect.top };
  const topRight = { x: rect.right, y: rect.top };
  const bottomRight = { x: rect.right, y: rect.bottom };
  const bottomLeft = { x: rect.left, y: rect.bottom };
  return (
    segmentsIntersect(start, end, topLeft, topRight) ||
    segmentsIntersect(start, end, topRight, bottomRight) ||
    segmentsIntersect(start, end, bottomRight, bottomLeft) ||
    segmentsIntersect(start, end, bottomLeft, topLeft)
  );
};

const segmentRectDistance = (
  start: Point,
  end: Point,
  rect: SvgRect,
): number => {
  if (segmentIntersectsRect(start, end, rect)) return 0;
  const corners = [
    { x: rect.left, y: rect.top },
    { x: rect.right, y: rect.top },
    { x: rect.right, y: rect.bottom },
    { x: rect.left, y: rect.bottom },
  ];
  return Math.min(
    distanceToRect(start, rect),
    distanceToRect(end, rect),
    ...corners.map((corner) => distanceToSegment(corner, start, end)),
  );
};

const streetClipsMovedHouse = (cell: Cell, style?: string): boolean => {
  const center = toSvgPoint(cell);
  const half = movedHouseHalfSize(style);
  const rect: SvgRect = {
    left: center.x - half.x,
    top: center.y - half.y,
    right: center.x + half.x,
    bottom: center.y + half.y,
  };
  const minDistance = ROAD_STROKE_RADIUS + MOVED_HOUSE_STREET_CLEARANCE;
  return streets.some(
    (street) =>
      segmentRectDistance(
        toSvgPoint(street.points[0]),
        toSvgPoint(street.points[1]),
        rect,
      ) <= minDistance,
  );
};

const canPlaceMovedHouseAt = (cell: Cell, style?: string): boolean =>
  inRect(cell, board) &&
  !cellIsObstructed(cell, { avoidTrees: false }) &&
  !streetClipsMovedHouse(cell, style);

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

const hideActionBar = (): void => {
  actionBar.style.display = "none";
  actionBar.style.opacity = "0";
  actionBar.style.pointerEvents = "none";
  actionBar.style.transitionDelay = "0s";
};

const showActionBar = (
  heading: string,
  hint: string,
  backLabel: string,
  options: { queued?: boolean } = {},
): void => {
  const morphFromPanel =
    panel.style.display !== "none" && actionBar.style.display === "none";
  if (morphFromPanel) {
    panel.style.opacity = "0";
    panel.style.transform = "translateX(-50%) translateY(-8px) scale(.96)";
    setTimeout(() => {
      if (actionBar.style.display !== "none") panel.style.display = "none";
    }, 150);
  } else {
    panel.style.display = "none";
  }
  setPanelInteractive(false);
  actionTitle.innerText = heading;
  barBackButton.innerText = backLabel;
  barBackButton.title = backLabel;
  barBackButton.setAttribute("aria-label", backLabel);
  barBackButton.style.display = options.queued ? "none" : "";
  barCloseButton.title = options.queued ? "Cancel queued action" : "Close";
  barCloseButton.setAttribute(
    "aria-label",
    options.queued ? "Cancel queued action" : "Close Home Action",
  );
  setStatus(hint);
  actionBar.style.display = "grid";
  actionBar.style.pointerEvents = "all";
  actionBar.style.opacity = "0";
  actionBar.style.transform = morphFromPanel
    ? "translate(-50%, 8px) scale(.96)"
    : "translate(-50%, -6px) scale(.98)";
  actionBar.style.transitionDelay = morphFromPanel ? ".04s" : "0s";
  requestAnimationFrame(() => {
    if (actionBar.style.display === "none") return;
    actionBar.style.opacity = "1";
    actionBar.style.transform = "translate(-50%, 0) scale(1)";
  });
};

const showShell = (): void => {
  shell.style.display = "block";
  shell.style.opacity = "1";
  shell.style.pointerEvents = "none";
  setPanelInteractive(true);
  setDeveloperModeButtonSuppressed(true);
};

const hideShell = (): void => {
  shell.style.opacity = "0";
  shell.style.pointerEvents = "none";
  shell.style.display = "none";
  setPanelInteractive(false);
  hideActionBar();
  setDeveloperModeButtonSuppressed(false);
};

const dockPanel = (docked: boolean): void => {
  panel.style.left = docked ? "auto" : "50%";
  panel.style.right = docked ? "calc(env(safe-area-inset-right, 0px) + 14px)" : "";
  panel.style.top = docked
    ? "calc(env(safe-area-inset-top, 0px) + 14px)"
    : "calc(env(safe-area-inset-top, 0px) + 16px)";
  panel.style.width = docked
    ? "min(320px, calc(var(--app-width, 100vw) - 28px))"
    : "min(440px, calc(var(--app-width, 100vw) - 32px))";
  panel.style.transform = docked ? "translateX(0)" : "translateX(-50%)";
  panel.style.opacity = docked ? ".96" : "1";
  panel.style.display = "";
  setPanelInteractive(true);
  hideActionBar();
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
  showActionBar(
    "Swap Houses",
    "Click two houses. The swap happens immediately when both are home.",
    "Back",
  );
  setTitle("Swap Houses", "M7 8h10M14 5l3 3-3 3M17 16H7M10 13l-3 3 3 3");
  body.replaceChildren();
  primaryButton.style.display = "none";
  secondaryButton.innerText = "Back";
  secondaryButton.style.display = "";
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
  showActionBar(
    "Move House",
    "Click a house. Demolition starts when its cars are home.",
    "Back",
  );
  setTitle("Move House", "M4 11 12 5l8 6M7 10v8h10v-8M10 18v-4h4v4");
  body.replaceChildren();
  primaryButton.style.display = "none";
  secondaryButton.innerText = "Back";
  secondaryButton.style.display = "";
};

const candidateFacing = (cell: Cell): Direction | null => {
  if (!canPlaceMovedHouseAt(cell, pendingMove?.style)) return null;

  const inBoardDirections = DIRECTIONS.filter((facing) =>
    inRect({ x: cell.x + facing.x, y: cell.y + facing.y }, board),
  );

  for (const facing of inBoardDirections) {
    const endpoint = { x: cell.x + facing.x, y: cell.y + facing.y } as Cell;
    if (!streetWouldClipBuilding(cell, endpoint)) return facing;
  }

  return inBoardDirections[0] ?? null;
};

const renderMovePlace = (): void => {
  showShell();
  mode = "movePlace";
  clearReadyCheck();
  clearMarks();
  placement = null;
  hidePlacementMarker();
  showRebuildGrid();
  showActionBar("Place House", "Click an open field.", "Undo");
  setTitle("Place House", "M5 12h14M12 5v14M7 9l5-4 5 4");
  body.replaceChildren();
  primaryButton.style.display = "none";
  secondaryButton.innerText = "Undo Demolition";
  secondaryButton.style.display = "";
};

const swapWouldViolateColorLock = (a: House, b: House): boolean =>
  houseTypeChangesWouldMixColors([
    { house: a, type: b.type },
    { house: b, type: a.type },
  ]);

const applySwap = (a: House, b: House): void => {
  if (swapWouldViolateColorLock(a, b)) {
    queuedSwap = null;
    holdHouse(a, false);
    holdHouse(b, false);
    setStatus("Color Lock blocks that swap.");
    return;
  }
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
  hideShell();
};

const hideQueuedActionWindow = (): void => {
  hideRebuildGrid();
  hidePlacementMarker();
  mode = "closed";
  showShell();
  showActionBar(
    queuedSwap ? "Swap Queued" : "Demolition Queued",
    queuedSwap
      ? "Waiting until both driveways are clear."
      : "Waiting until the driveway is clear.",
    "Back",
    { queued: true },
  );
};

export const suspendHomeActionsForOverlay = (): boolean => {
  suspendedForOverlay = mode !== "closed";
  if (!suspendedForOverlay) return false;
  hideRebuildGrid();
  hidePlacementMarker();
  hideShell();
  return true;
};

export const resumeHomeActionsAfterOverlay = (): void => {
  if (!suspendedForOverlay) return;
  suspendedForOverlay = false;
  if (mode === "closed" || queuedSwap || queuedMoveHouse) return;
  showShell();
  if (mode !== "choose") {
    showActionBar(
      mode === "swap"
        ? "Swap Houses"
        : mode === "movePick"
          ? "Move House"
          : "Place House",
      actionHint.innerText,
      mode === "movePlace" ? "Undo" : "Back",
    );
  } else {
    dockPanel(false);
  }
  if (mode === "movePlace") {
    showRebuildGrid();
    if (placement) showPlacementMarker(placement.cell, true);
  }
};

const open = (): void => {
  if (gameInputLocked()) return;
  if (queuedSwap || queuedMoveHouse) return;
  if (!canSpendHomeAction()) {
    flashUnavailable();
    return;
  }
  showShell();
  renderChoose();
};

export const startHomeActionSwap = (): void => {
  if (gameInputLocked()) return;
  if (queuedSwap || queuedMoveHouse) return;
  if (mode === "swap") {
    close();
    return;
  }
  if (mode !== "closed" && mode !== "choose") return;
  if (!canSpendHomeAction()) {
    flashUnavailable();
    return;
  }
  showShell();
  renderSwap();
};

const confirmSwap = (): void => {
  if (selectedHouses.length !== 2) return;
  const [a, b] = selectedHouses;
  if (!a || !b) return;
  if (a.type === b.type) {
    setStatus("Pick two different house colors.");
    return;
  }
  if (swapWouldViolateColorLock(a, b)) {
    setStatus("Color Lock blocks that swap.");
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
  hideQueuedActionWindow();
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
  hideQueuedActionWindow();
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

const handleSecondary = (): void => {
  if (mode === "movePlace") {
    restorePendingMove();
    renderChoose();
  } else renderChoose();
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
    if (selectedHouses.length === 2) confirmSwap();
    else setStatus("Click one more house.");
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
    confirmDemolition();
    return true;
  }

  const facing = candidateFacing(cell);
  showPlacementMarker(cell, !!facing);
  if (!facing) {
    placement = null;
    setPrimaryEnabled(false);
    setStatus("That field is blocked.");
    return true;
  }
  placement = { cell, facing };
  confirmBuild();
  return true;
};

export const isHomeActionActive = (): boolean => mode !== "closed";

export const isHomeActionPlacingHouse = (): boolean => mode === "movePlace";

export const closeHomeActions = (): void => {
  suspendedForOverlay = false;
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
    top:calc(env(safe-area-inset-top, 0px) + 16px);
    width:min(440px, calc(var(--app-width, 100vw) - 32px));
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
  actionBar.style.cssText = `
    position:absolute;
    top:calc(env(safe-area-inset-top, 0px) + 8px);
    left:50%;
    width:min(560px, calc(var(--app-width, 100vw) - 28px));
    min-height:44px;
    box-sizing:border-box;
    padding:7px 8px 7px 14px;
    display:none;
    grid-template-columns:minmax(0, 1fr) auto;
    align-items:center;
    gap:12px;
    border-radius:16px;
    background:#eef3e4;
    color:${colors.ui};
    box-shadow:0 14px 40px rgba(20,24,16,.18), inset 0 0 0 1px rgba(68,68,51,.1);
    pointer-events:none;
    opacity:0;
    transform:translate(-50%, -6px) scale(.98);
    transform-origin:top center;
    transition:opacity .18s ease, transform .22s cubic-bezier(.2,.8,.2,1);
  `;
  actionCopy.style.cssText = `
    min-width:0;
    display:grid;
    gap:1px;
    justify-items:center;
    text-align:center;
  `;
  actionTitle.style.cssText = `
    max-width:100%;
    overflow:hidden;
    text-overflow:ellipsis;
    white-space:nowrap;
    font-size:13px;
    line-height:1;
    font-weight:900;
    letter-spacing:.6px;
    text-transform:uppercase;
  `;
  actionHint.style.cssText = `
    max-width:min(620px, calc(var(--app-width, 100vw) - 136px));
    overflow:hidden;
    text-overflow:ellipsis;
    white-space:nowrap;
    font-size:11px;
    line-height:1.12;
    font-weight:650;
    color:rgba(68,68,51,.78);
  `;
  actionControls.style.cssText = `
    display:flex;
    align-items:center;
    gap:6px;
  `;
  barBackButton.style.cssText = `
    min-width:54px;
    height:30px;
    padding:0 12px;
    border-radius:15px;
    background:#fff;
    font-size:12px;
    line-height:1;
    pointer-events:all;
    box-shadow:inset 0 0 0 1px rgba(68,68,51,.14), 0 3px 8px rgba(20,24,16,.08);
  `;
  barCloseButton.innerText = "X";
  barCloseButton.title = "Close";
  barCloseButton.setAttribute("aria-label", "Close Home Action");
  barCloseButton.style.cssText = `
    width:30px;
    height:30px;
    padding:0;
    display:grid;
    place-items:center;
    border-radius:50%;
    background:#fff;
    font-size:15px;
    line-height:1;
    pointer-events:all;
    box-shadow:inset 0 0 0 1px rgba(68,68,51,.14), 0 3px 8px rgba(20,24,16,.08);
  `;
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
  secondaryButton.addEventListener("click", handleSecondary);
  barBackButton.addEventListener("click", handleSecondary);
  barCloseButton.addEventListener("click", close);
  actionCopy.append(actionTitle, actionHint);
  actionControls.append(barBackButton, barCloseButton);
  actionBar.append(actionCopy, actionControls);
  panel.append(title, closeButton, body, status, primaryButton, secondaryButton);
  shell.append(actionBar, panel);
  document.body.append(shell);
  homeActionIndicator.addEventListener("click", open);
};
