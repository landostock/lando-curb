import type { Point, Rect } from "../types";

export const isAdjacent = (a: Point, b: Point): boolean => {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return dx <= 1 && dy <= 1 && dx + dy > 0;
};

export const inRect = (p: Point, { x, y, width, height }: Rect): boolean =>
  p.x >= x && p.x < x + width && p.y >= y && p.y < y + height;

export const samePoint = (a: Point, b: Point): boolean =>
  a.x === b.x && a.y === b.y;
