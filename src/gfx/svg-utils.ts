import type { Pixel, Point } from "../types";

export const gridCellSize = 8; // Width & height of a cell, in SVG px

export const createSvgElement = <K extends keyof SVGElementTagNameMap>(
  tag: K,
): SVGElementTagNameMap[K] =>
  document.createElementNS("http://www.w3.org/2000/svg", tag);

export const createElement = <K extends keyof HTMLElementTagNameMap>(
  tag?: K,
): HTMLElementTagNameMap[K] => document.createElement(tag ?? ("div" as K));

export const toSvgEdge = (c: number) => c * gridCellSize;
const toSvgCoord = (c: number) => gridCellSize / 2 + c * gridCellSize;
export const toSvgPoint = (p: Point): Pixel =>
  ({
    x: toSvgCoord(p.x),
    y: toSvgCoord(p.y),
  }) as Pixel;

export const svgMoveTo = (p: Point) => {
  const s = toSvgPoint(p);
  return `M${s.x} ${s.y}`;
};
export const svgLineTo = (p: Point) => {
  const s = toSvgPoint(p);
  return `L${s.x} ${s.y}`;
};
export const svgQuadTo = (control: Point, end: Point) => {
  const c = toSvgPoint(control),
    e = toSvgPoint(end);
  return `Q${c.x} ${c.y} ${e.x} ${e.y}`;
};
