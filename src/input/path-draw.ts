import { playRoadPop } from "../audio";
import { Street } from "../entities/street";
import { colors } from "../gfx/colors";
import { isPastHalfwayInto } from "../gfx/coords";
import { streetShadowLayer } from "../gfx/layers";
import { createSvgElement, toSvgEdge, toSvgPoint } from "../gfx/svg-utils";
import { commitStreetChanges } from "../logic/orchestrator";
import {
  cellInLake,
  cellIsBlocked,
  houseInCell,
  samePathInBothCells,
} from "../logic/placement-obstacles";
import { addStreet, session } from "../state";
import type { Cell, Pixel } from "../types";
import {
  bridgeIndicator,
  bridgeIndicatorCount,
  motorwayIndicator,
  motorwayIndicatorCount,
  motorwayMode,
  pathTilesIndicator,
  pathTilesIndicatorCount,
  setMotorwayMode,
} from "../ui/ui";

const transition = `all .2s, scale .4s cubic-bezier(.5,2,.5,1)`;

const indicatorWrapper = createSvgElement("g");
const indicator = createSvgElement("path");
indicator.style.opacity = "0";
indicator.style.scale = "0";
indicator.style.transition = transition;
indicatorWrapper.append(indicator);
streetShadowLayer.append(indicatorWrapper);

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
  const start = toSvgPoint(startCell);
  indicator.setAttribute("d", "M0 0l0 0");
  indicator.setAttribute(
    "stroke",
    cellInLake(startCell)
      ? colors.bridge
      : motorwayMode
        ? colors.motorway
        : colors.base,
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

  // Validate placement BEFORE deducting or flashing "!" — a player dragging over a BP or
  // lake shouldn't see an "out of paths" exhaustion flash.
  if (cellIsBlocked(cell)) return "blocked";
  if (samePathInBothCells(startCell, cell)) return "blocked";
  if (houseInCell(cell)) return "blocked";

  // Resource availability. Bridges take priority over motorway/path when a lake is involved.
  const usingMotorway = motorwayMode && !needsBridge && session.motorways > 0;
  if (needsBridge) {
    if (session.bridges <= 0) {
      flashExhausted(
        bridgeIndicator,
        bridgeIndicatorCount,
        () => session.bridges,
      );
      indicator.style.opacity = "0";
      return "exhausted";
    }
    // Motorway-mode draw that became a bridge — flash the motorway indicator so the player
    // can see their motorway currency wasn't the one deducted.
    if (motorwayMode) {
      flashExhausted(
        motorwayIndicator,
        motorwayIndicatorCount,
        () => session.motorways,
      );
    }
  } else if (motorwayMode && session.motorways <= 0) {
    flashExhausted(
      motorwayIndicator,
      motorwayIndicatorCount,
      () => session.motorways,
    );
    indicator.style.opacity = "0";
    return "exhausted";
  } else if (!motorwayMode && session.paths <= 0) {
    flashExhausted(
      pathTilesIndicator,
      pathTilesIndicatorCount,
      () => session.paths,
    );
    indicator.style.opacity = "0";
    return "exhausted";
  }

  if (needsBridge) {
    session.bridges--;
    bridgeIndicatorCount.innerText = String(session.bridges);
  } else if (usingMotorway) {
    session.motorways--;
    motorwayIndicatorCount.innerText = String(session.motorways);
    if (session.motorways === 0) setMotorwayMode(false);
  } else {
    session.paths--;
    pathTilesIndicatorCount.innerText = String(session.paths);
  }

  addStreet(
    new Street({
      points: [
        { x: startCell.x, y: startCell.y },
        { x: cell.x, y: cell.y },
      ],
      motorway: usingMotorway,
      bridge: needsBridge,
    }),
  );

  // Adding a street only ever opens new options — no atWork commuter is stranded.
  commitStreetChanges();
  playRoadPop({ bridge: needsBridge, motorway: usingMotorway });

  indicator.style.transition = "";
  return "placed";
}

export function onUp(): void {
  indicator.style.opacity = "0";
  indicator.style.scale = "0";
}
