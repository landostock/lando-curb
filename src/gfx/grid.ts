import { board } from "../board";
import { colors } from "./colors";
import { svgElement } from "./svg";
import { createSvgElement, gridCellSize } from "./svg-utils";

export const scaledGridLineThickness = 1;
export const gridLineThickness = scaledGridLineThickness / 2;

export const gridRect = createSvgElement("rect");
export const gridRectRed = createSvgElement("rect");
const boardFill = createSvgElement("rect");

const boardSvgRect = () => ({
  x: board.x * gridCellSize - gridLineThickness / 2,
  y: board.y * gridCellSize - gridLineThickness / 2,
  w: board.width * gridCellSize + gridLineThickness,
  h: board.height * gridCellSize + gridLineThickness,
});

export const updateGridBounds = (): void => {
  const { x, y, w, h } = boardSvgRect();
  for (const el of [gridRect, gridRectRed]) {
    el.setAttribute("x", String(x));
    el.setAttribute("y", String(y));
    el.setAttribute("width", String(w));
    el.setAttribute("height", String(h));
  }
  boardFill.setAttribute("x", String(x));
  boardFill.setAttribute("y", String(y));
  boardFill.setAttribute("width", String(w));
  boardFill.setAttribute("height", String(h));
};

export const addGridBackgroundToSvg = (): void => {
  boardFill.setAttribute("fill", colors.grass);
  boardFill.style.transition = "x .5s, y .5s, width .5s, height .5s";
  updateGridBounds();
  svgElement.append(boardFill);
};

export const addGridToSvg = (): void => {
  const defs = createSvgElement("defs");

  const addCellPattern = (id: string, stroke: string) => {
    const p = createSvgElement("pattern");
    p.setAttribute("id", id);
    p.setAttribute("width", String(gridCellSize));
    p.setAttribute("height", String(gridCellSize));
    p.setAttribute("patternUnits", "userSpaceOnUse");
    const path = createSvgElement("path");
    path.setAttribute("d", `M${gridCellSize} 0 0 0 0 ${gridCellSize}`);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", stroke);
    path.setAttribute("stroke-width", String(scaledGridLineThickness));
    p.append(path);
    defs.append(p);
  };
  addCellPattern("grid", colors.grid);
  addCellPattern("gridred", colors.gridRed);

  const initGridRect = (el: SVGElement, fill: string) => {
    el.setAttribute("fill", fill);
    el.style.opacity = "0";
    el.style.willChange = "opacity";
    el.style.transition = "opacity .3s";
  };
  initGridRect(gridRect, "url(#grid)");
  initGridRect(gridRectRed, "url(#gridred)");

  updateGridBounds();
  svgElement.append(defs, gridRect, gridRectRed);
};
