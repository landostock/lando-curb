import { grid } from "../board";
import type { Cell, Pixel, Point } from "../types";
import { gridPointerLayer } from "./layers";

const cellSizePx = () =>
  gridPointerLayer.getBoundingClientRect().width / grid.width;

export const getBoardCell = ({ x, y }: Pixel): Cell => {
  const c = cellSizePx();
  return {
    x: Math.floor(x / c),
    y: Math.floor(y / c),
  } as Cell;
};

export const svgPxToDisplayPx = ({ x, y }: Point): Pixel => {
  const c = cellSizePx();
  return { x: x * c, y: y * c } as Pixel;
};

export const isPastHalfwayInto = ({
  pointer,
  from,
  to,
}: {
  pointer: Pixel;
  from: Cell;
  to: Cell;
}): boolean | undefined => {
  const c = cellSizePx();
  // TODO: convert from display px to svg px to align with cells better
  const fuzzyness = 4; // In device px, how closish to half way is required
  const xDiff = pointer.x - c * (from.x + 0.5);
  const yDiff = pointer.y - c * (from.y + 0.5);
  const top = to.y - from.y < 0;
  const right = to.x - from.x > 0;
  const bottom = to.y - from.y > 0;
  const left = to.x - from.x < 0;
  const xMid = to.x === from.x;
  const yMid = to.y === from.y;

  if (top && xMid) return yDiff < -c + fuzzyness;
  if (top && right) return xDiff - yDiff > c * 2 - fuzzyness;
  if (yMid && right) return xDiff > c - fuzzyness;
  if (bottom && right) return xDiff + yDiff > c * 2 - fuzzyness;
  if (bottom && xMid) return yDiff > c - fuzzyness;
  if (bottom && left) return xDiff + -yDiff < -c * 2 + fuzzyness;
  if (yMid && left) return xDiff < -c + fuzzyness;
  if (top && left) return xDiff + yDiff < -c * 2 + fuzzyness;

  return undefined;
};
