import { board } from "../board";
import { colors } from "./colors";
import { gridSvgHeight, gridSvgWidth, svgElement } from "./svg";
import { createSvgElement, gridCellSize } from "./svg-utils";

export const scaledGridLineThickness = 1;
export const gridLineThickness = scaledGridLineThickness / 2;

export const gridRect = createSvgElement("rect");
export const gridRectRed = createSvgElement("rect");
const lockedOverlay = createSvgElement("path");

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
  lockedOverlay.setAttribute(
    "d",
    `M0 0h${gridSvgWidth}v${gridSvgHeight}H0Z` + `M${x} ${y}h${w}v${h}H${x}Z`,
  );
};

export const addGridBackgroundToSvg = (): void => {
  const bg = createSvgElement("rect");
  bg.setAttribute("fill", colors.grass);
  bg.setAttribute("width", String(gridSvgWidth));
  bg.setAttribute("height", String(gridSvgHeight));
  svgElement.append(bg);
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

  const lockedPattern = createSvgElement("pattern");
  lockedPattern.setAttribute("id", "locked");
  lockedPattern.setAttribute("width", "6");
  lockedPattern.setAttribute("height", "6");
  lockedPattern.setAttribute("patternUnits", "userSpaceOnUse");
  lockedPattern.setAttribute("patternTransform", "rotate(-55)");
  const stripe = createSvgElement("rect");
  stripe.setAttribute("width", "3");
  stripe.setAttribute("height", "6");
  stripe.setAttribute("fill", "#0001");
  lockedPattern.append(stripe);
  defs.append(lockedPattern);

  const initGridRect = (el: SVGElement, fill: string) => {
    el.setAttribute("fill", fill);
    el.style.opacity = "0";
    el.style.willChange = "opacity";
    el.style.transition = "opacity .3s";
  };
  initGridRect(gridRect, "url(#grid)");
  initGridRect(gridRectRed, "url(#gridred)");

  lockedOverlay.setAttribute("fill", "url(#locked)");
  lockedOverlay.setAttribute("fill-rule", "evenodd");
  lockedOverlay.style.transition = "d .5s";

  updateGridBounds();
  svgElement.append(defs, lockedOverlay, gridRect, gridRectRed);
};
