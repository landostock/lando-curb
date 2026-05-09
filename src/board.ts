/** Board geometry — playable area grows during a game within fixed grid limits */
import type { Rect } from "./types";

const max: Rect = { x: 3, y: 2, width: 25, height: 15 };

export const grid: Rect = {
  x: 0,
  y: 0,
  width: max.x + max.width + max.x,
  height: max.y + max.height + max.y,
};

const centerOf = (w: number, h: number): Rect => ({
  x: Math.floor((grid.width - w) / 2),
  y: Math.floor((grid.height - h) / 2),
  width: w,
  height: h,
});

const start = centerOf(10, 7);

export const board: Rect = { ...start };

export const growBoard = (entityCount: number): void => {
  const t = Math.min(1, entityCount / 60);
  board.width = Math.round(start.width + (max.width - start.width) * t);
  board.height = Math.round(start.height + (max.height - start.height) * t);
  board.x = Math.floor((grid.width - board.width) / 2);
  board.y = Math.floor((grid.height - board.height) / 2);
};

export const resetBoard = (): void => {
  board.x = start.x;
  board.y = start.y;
  board.width = start.width;
  board.height = start.height;
};
