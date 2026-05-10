import { grid } from "../board";
import { getBoardCell, isPastHalfwayInto } from "../gfx/coords";
import { gridPointerLayer } from "../gfx/layers";
import { svgContainerElement, svgElement } from "../gfx/svg";
import { upgradeStreetToMotorway } from "../logic/motorway-upgrade";
import {
  cellInLake,
  cellIsBlocked,
  houseInCell,
} from "../logic/placement-obstacles";
import { removePath } from "../logic/remove-street";
import { session, streets } from "../state";
import type { Cell, Pixel } from "../types";
import {
  motorwayIndicator,
  motorwayIndicatorCount,
  motorwayMode,
} from "../ui/ui";
import { isAdjacent } from "../util/geometry";
import { initCarClick } from "./car-click";
import {
  gridHide,
  gridRedHide,
  gridRedShow,
  gridRedState,
  gridShow,
} from "./grid-toggle";
import * as pathDraw from "./path-draw";

let startCell: Cell | null = null;
let isDragging = false;
let removeDragPrev: Cell | null = null;

// Double-click detection: suppress the second pointerdown so the path indicator
// doesn't flash when the user double-clicks to reactivate a car.
let lastPointerdownTime = 0;
let lastPointerdownX = 0;
let lastPointerdownY = 0;
const DBLCLICK_MS = 350;
const DBLCLICK_PX2 = 20 * 20;

const snapCellTo45 = (start: Cell, px: Pixel): Cell => {
  const c = gridPointerLayer.getBoundingClientRect().width / grid.width;
  const dx = px.x - c * (start.x + 0.5);
  const dy = px.y - c * (start.y + 0.5);
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < c * 0.2) return start;
  const angle = Math.atan2(dy, dx);
  const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
  return {
    x: start.x + Math.round(Math.cos(snapped)),
    y: start.y + Math.round(Math.sin(snapped)),
  } as Cell;
};

const getCellFromEvent = (event: PointerEvent) => {
  const rect = gridPointerLayer.getBoundingClientRect();
  const pointerInRect = {
    x: event.x - rect.left,
    y: event.y - rect.top,
  } as Pixel;
  return { cell: getBoardCell(pointerInRect), pointerInRect };
};

const edgeFromPointer = (cell: Cell, pointerInRect: Pixel): [Cell, Cell] => {
  const c = gridPointerLayer.getBoundingClientRect().width / grid.width;
  const centerX = c * (cell.x + 0.5);
  const centerY = c * (cell.y + 0.5);
  const dx = pointerInRect.x - centerX;
  const dy = pointerInRect.y - centerY;
  const neighbor =
    Math.abs(dx) > Math.abs(dy)
      ? ({ x: cell.x + Math.sign(dx || 1), y: cell.y } as Cell)
      : ({ x: cell.x, y: cell.y + Math.sign(dy || 1) } as Cell);
  return [cell, neighbor];
};

const cellCenterInRect = (cell: Cell): Pixel => {
  const c = gridPointerLayer.getBoundingClientRect().width / grid.width;
  return {
    x: c * (cell.x + 0.5),
    y: c * (cell.y + 0.5),
  } as Pixel;
};

const distanceToSegmentSquared = (
  point: Pixel,
  start: Pixel,
  end: Pixel,
): number => {
  const vx = end.x - start.x;
  const vy = end.y - start.y;
  const wx = point.x - start.x;
  const wy = point.y - start.y;
  const len2 = vx * vx + vy * vy;
  const t = len2 > 0 ? Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2)) : 0;
  const px = start.x + vx * t;
  const py = start.y + vy * t;
  return (point.x - px) ** 2 + (point.y - py) ** 2;
};

const nearestRemovableStreetEdge = (
  cell: Cell,
  pointerInRect: Pixel,
): [Cell, Cell] | undefined => {
  const c = gridPointerLayer.getBoundingClientRect().width / grid.width;
  const maxDistance2 = (c * 0.34) ** 2;
  let best: { points: [Cell, Cell]; distance2: number } | undefined;

  for (const street of streets) {
    if (street.points[0].locked || street.points[1].locked) continue;
    if (
      street.points.every(
        (p) => Math.abs(p.x - cell.x) > 1 || Math.abs(p.y - cell.y) > 1,
      )
    )
      continue;

    const distance2 = distanceToSegmentSquared(
      pointerInRect,
      cellCenterInRect(street.points[0]),
      cellCenterInRect(street.points[1]),
    );
    if (distance2 > maxDistance2) continue;
    if (!best || distance2 < best.distance2) {
      best = { points: street.points, distance2 };
    }
  }

  return best?.points;
};

const removePathAtPointer = (cell: Cell, pointerInRect: Pixel): void => {
  const edge = nearestRemovableStreetEdge(cell, pointerInRect);
  if (edge) removePath(edge[0], edge[1]);
  else removePath(cell);
};

const flashMotorwayExhausted = (): void => {
  motorwayIndicator.style.scale = "1.1";
  motorwayIndicatorCount.innerText = "!";
  setTimeout(() => {
    motorwayIndicator.style.scale = "1";
    motorwayIndicatorCount.innerText = String(session.motorways);
  }, 300);
};

const handleDoubleClick = (event: MouseEvent): void => {
  if (!motorwayMode) return;
  event.stopImmediatePropagation();
  event.preventDefault();

  const { cell, pointerInRect } = getCellFromEvent(event as PointerEvent);
  const [from, to] = edgeFromPointer(cell, pointerInRect);
  const result = upgradeStreetToMotorway(from, to);
  if (result === "exhausted") flashMotorwayExhausted();
};

const handlePointerdown = (event: PointerEvent): void => {
  event.stopPropagation();

  // Suppress the second pointerdown of a double-click so path drawing doesn't
  // fire twice and the path indicator doesn't flash on car double-clicks.
  const now = performance.now();
  const ddx = event.clientX - lastPointerdownX;
  const ddy = event.clientY - lastPointerdownY;
  const isSecondClick =
    now - lastPointerdownTime < DBLCLICK_MS &&
    ddx * ddx + ddy * ddy < DBLCLICK_PX2;
  lastPointerdownTime = now;
  lastPointerdownX = event.clientX;
  lastPointerdownY = event.clientY;
  if (isSecondClick) return;

  const { cell, pointerInRect } = getCellFromEvent(event);

  if (event.buttons === 1 && !gridRedState.locked) {
    gridShow();
    if (cellIsBlocked(cell) || cellInLake(cell)) return;

    isDragging = true;
    startCell = cell;

    const house = houseInCell(cell);
    if (house) {
      house.lift();
      svgElement.style.cursor = "grabbing";
    } else {
      pathDraw.onDown(cell);
    }
  } else if (event.buttons === 2 || gridRedState.locked) {
    gridRedShow();
    removePathAtPointer(cell, pointerInRect);
    removeDragPrev = cell;
  }
};

const handlePointerup = (event: PointerEvent): void => {
  event.stopPropagation();
  const { cell } = getCellFromEvent(event);

  if (cellIsBlocked(cell)) {
    svgElement.style.cursor = "not-allowed";
  } else if (houseInCell(cell)) {
    svgElement.style.cursor = "grab";
  } else {
    svgElement.style.cursor = "cell";
  }

  gridHide();
  gridRedHide();
  pathDraw.onUp();

  if (startCell) {
    houseInCell(startCell)?.place();
  }

  startCell = null;
  isDragging = false;
  removeDragPrev = null;
};

const handlePointermove = (event: PointerEvent): void => {
  event.stopPropagation();
  const { cell, pointerInRect } = getCellFromEvent(event);

  // Removal mode (right-click or locked red grid)
  if (event.buttons === 2 || (event.buttons === 1 && gridRedState.locked)) {
    gridRedShow();
    removePath(cell, removeDragPrev ?? undefined);
    removeDragPrev = cell;
    return;
  }

  if (cellIsBlocked(cell)) {
    svgElement.style.cursor = "not-allowed";
    return;
  }

  // Cursor
  const startHouse = startCell && houseInCell(startCell);
  const endHouse = houseInCell(cell);
  if (endHouse && event.buttons !== 1) {
    svgElement.style.cursor = "grab";
  } else if (event.buttons === 1 && startHouse) {
    svgElement.style.cursor = "grabbing";
  } else {
    svgElement.style.cursor = "cell";
  }

  if (event.buttons !== 1) return;
  gridRedHide();
  gridShow();
  if (!isDragging) return;

  // House drag
  const house = startHouse ?? endHouse;
  if (house) {
    if (
      !isPastHalfwayInto({ pointer: pointerInRect, from: startCell!, to: cell })
    )
      return;

    if (startHouse && !endHouse) {
      if (!isAdjacent(startHouse, cell)) return;
      startHouse.rotateTo(cell.x, cell.y);
      startCell = cell;
      startHouse.place();
    } else if (endHouse && !startHouse) {
      endHouse.rotateTo(startCell!.x, startCell!.y);
      startCell = null;
      isDragging = false;
      endHouse.place();
    }
    return;
  }

  // Path draw – snap target cell to nearest 45° direction
  const snappedCell = snapCellTo45(startCell!, pointerInRect);
  const result = pathDraw.onMove(startCell!, snappedCell, pointerInRect);
  if (result === "placed") {
    startCell = snappedCell;
  } else if (result === "exhausted") {
    startCell = null;
    isDragging = false;
  } else if (result === "blocked") {
    svgElement.style.cursor = "not-allowed";
  }
};

export const initPointer = (): void => {
  svgContainerElement.addEventListener("pointerdown", () => gridRedShow());
  svgContainerElement.addEventListener("pointermove", (e) => {
    if ((e as PointerEvent).buttons === 1) {
      gridRedShow();
      gridHide();
    }
  });
  svgContainerElement.addEventListener("pointerup", () => gridRedHide());
  svgContainerElement.addEventListener("contextmenu", (e) =>
    e.preventDefault(),
  );
  gridPointerLayer.addEventListener("pointerdown", handlePointerdown);
  gridPointerLayer.addEventListener("pointermove", handlePointermove);
  gridPointerLayer.addEventListener("pointerup", handlePointerup);
  gridPointerLayer.addEventListener("dblclick", handleDoubleClick);
  initCarClick();
};
