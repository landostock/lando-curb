import { playRoadPop } from "../audio";
import { Street } from "../entities/street";
import { colors } from "../gfx/colors";
import { isPastHalfwayInto } from "../gfx/coords";
import { streetShadowLayer } from "../gfx/layers";
import { createSvgElement, toSvgEdge, toSvgPoint } from "../gfx/svg-utils";
import { streetMatchesEdge } from "../logic/find-route";
import { upgradeStreetToMotorway } from "../logic/motorway-upgrade";
import { commitStreetChanges } from "../logic/orchestrator";
import {
  cellInLake,
  cellIsBlocked,
  houseInCell,
  samePathInBothCells,
  streetWouldClipBuilding,
} from "../logic/placement-obstacles";
import { addStreet, session, streets } from "../state";
import type { Cell, Pixel } from "../types";
import {
  bridgeIndicator,
  bridgeIndicatorCount,
  developerMode,
  motorwayIndicator,
  motorwayIndicatorCount,
  pathTilesIndicator,
  pathTilesIndicatorCount,
} from "../ui/ui";

const transition = `all .2s, scale .4s cubic-bezier(.5,2,.5,1)`;

const indicatorWrapper = createSvgElement("g");
const indicator = createSvgElement("path");
indicator.style.opacity = "0";
indicator.style.scale = "0";
indicator.style.transition = transition;
indicatorWrapper.append(indicator);
streetShadowLayer.append(indicatorWrapper);

type DragBuildMode = "none" | "street" | "motorway";

let dragBuildMode: DragBuildMode = "none";

/** Half-cell delta in SVG px for a unit-length cell step. */
const halfCellDelta = (dx: number, dy: number): Pixel =>
  ({ x: toSvgEdge(dx) / 2, y: toSvgEdge(dy) / 2 }) as Pixel;

/** Brief UI flash on an indicator element — "!" for 300 ms, then restores the real count. */
const flashExhausted = (
  indicatorEl: HTMLElement,
  countEl: HTMLElement,
  current: () => number,
): void => {
  indicatorEl.style.scale = "1.1";
  countEl.innerText = "!";
  setTimeout(() => {
    indicatorEl.style.scale = "1";
    countEl.innerText = String(current());
  }, 300);
};

export function onDown(startCell: Cell): void {
  dragBuildMode = "none";
  const start = toSvgPoint(startCell);
  indicator.setAttribute("d", "M0 0l0 0");
  indicator.setAttribute(
    "stroke",
    cellInLake(startCell) ? colors.bridge : colors.base,
  );
  indicatorWrapper.setAttribute(
    "transform",
    `translate(${start.x} ${start.y})`,
  );
  indicator.style.opacity = "1";
  indicator.style.scale = "1.3";
  indicator.style.transition = transition;
}

export type MoveResult = "pending" | "placed" | "blocked" | "exhausted";

const upgradeExistingStreet = (startCell: Cell, cell: Cell): MoveResult => {
  const result = upgradeStreetToMotorway(startCell, cell);
  if (result === "exhausted") {
    flashExhausted(
      motorwayIndicator,
      motorwayIndicatorCount,
      () => session.motorways,
    );
    indicator.style.opacity = "0";
    return "exhausted";
  }
  return result === "upgraded" ? "placed" : "blocked";
};

const restorePendingStreet = (startCell: Cell, cell: Cell): boolean => {
  const pendingStreet = streets.find(
    (street) =>
      street.pendingRemoval && streetMatchesEdge(street, startCell, cell),
  );
  if (!pendingStreet) return false;
  pendingStreet.pendingRemoval = false;
  commitStreetChanges();
  dragBuildMode = "street";
  playRoadPop({ bridge: pendingStreet.bridge });
  return true;
};

const reserveBuildResource = (needsBridge: boolean): boolean => {
  if (needsBridge) {
    if (!developerMode && session.bridges <= 0) {
      flashExhausted(
        bridgeIndicator,
        bridgeIndicatorCount,
        () => session.bridges,
      );
      indicator.style.opacity = "0";
      return false;
    }
    if (!developerMode) {
      session.bridges--;
      bridgeIndicatorCount.innerText = String(session.bridges);
    }
    return true;
  }

  if (!developerMode && session.paths <= 0) {
    flashExhausted(
      pathTilesIndicator,
      pathTilesIndicatorCount,
      () => session.paths,
    );
    indicator.style.opacity = "0";
    return false;
  }

  if (!developerMode) {
    session.paths--;
    pathTilesIndicatorCount.innerText = String(session.paths);
  }
  return true;
};

export function onMove(
  startCell: Cell,
  cell: Cell,
  pointerInRect: Pixel,
): MoveResult {
  const xDiff = cell.x - startCell.x;
  const yDiff = cell.y - startCell.y;
  const sameCellOrTooFar =
    (xDiff === 0 && yDiff === 0) || Math.abs(xDiff) > 1 || Math.abs(yDiff) > 1;

  const start = toSvgPoint(startCell);
  indicatorWrapper.setAttribute(
    "transform",
    `translate(${start.x} ${start.y})`,
  );
  indicator.style.opacity = "1";
  indicator.style.scale = sameCellOrTooFar ? "1.3" : "1";

  if (sameCellOrTooFar) {
    indicator.setAttribute("d", "M0 0L0 0");
    return "pending";
  }

  const end = halfCellDelta(xDiff, yDiff);
  indicator.setAttribute("d", `M0 0L${end.x} ${end.y}`);
  indicator.style.transition = transition;

  if (!isPastHalfwayInto({ pointer: pointerInRect, from: startCell, to: cell }))
    return "pending";

  const needsBridge = cellInLake(startCell) || cellInLake(cell);
  const existingStreet = samePathInBothCells(startCell, cell);
  const canUpgradeMotorway =
    !needsBridge && existingStreet && (developerMode || session.motorways > 0);

  // Validate placement BEFORE deducting or flashing "!" — a player dragging over a BP or
  // lake shouldn't see an "out of paths" exhaustion flash.
  if (cellIsBlocked(cell)) return "blocked";
  indicator.setAttribute(
    "stroke",
    needsBridge ? colors.bridge : canUpgradeMotorway ? colors.motorway : colors.base,
  );
  if (existingStreet) {
    if (restorePendingStreet(startCell, cell)) return "placed";
    if (dragBuildMode === "street") return "blocked";
    const result = upgradeExistingStreet(startCell, cell);
    if (result === "placed") dragBuildMode = "motorway";
    return result;
  }
  if (dragBuildMode === "motorway") return "blocked";
  if (streetWouldClipBuilding(startCell, cell)) return "blocked";
  if (houseInCell(cell)) return "blocked";

  if (!reserveBuildResource(needsBridge)) return "exhausted";

  addStreet(
    new Street({
      points: [
        { x: startCell.x, y: startCell.y },
        { x: cell.x, y: cell.y },
      ],
      motorway: false,
      bridge: needsBridge,
    }),
  );

  // Adding a street only ever opens new options — no atWork commuter is stranded.
  commitStreetChanges();
  playRoadPop({ bridge: needsBridge });
  dragBuildMode = "street";

  indicator.style.transition = "";
  return "placed";
}

export function onUp(): void {
  dragBuildMode = "none";
  indicator.style.opacity = "0";
  indicator.style.scale = "0";
}
