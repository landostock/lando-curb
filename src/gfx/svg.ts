import { board, grid } from "../board";
import { colors } from "./colors";
import { createElement, createSvgElement, gridCellSize } from "./svg-utils";

export const gridSvgWidth = grid.width * gridCellSize;
export const gridSvgHeight = grid.height * gridCellSize;

export const svgContainerElement = createElement();
svgContainerElement.style.cssText = `
  position: absolute;
  display: grid;
  place-items: center;
  overflow: hidden;
  background:
    repeating-linear-gradient(-55deg, #0000000b 0 30px, #0000 30px 60px),
    ${colors.grass};
  cursor: cell;
`;
svgContainerElement.style.width = "100vw";
svgContainerElement.style.height = "100vh";
document.body.append(svgContainerElement);

export const svgHazardLines = createElement();
svgHazardLines.style.cssText = `
  position: absolute;
  display: grid;
  background: none;
`;
svgHazardLines.style.width = "100vw";
svgHazardLines.style.height = "100vh";
svgHazardLines.style.opacity = "0";
svgHazardLines.style.willChange = "opacity";
svgHazardLines.style.transition = "opacity .3s";

export const svgHazardLinesRed = createElement();
svgHazardLinesRed.style.cssText = `
  position: absolute;
  display: grid;
  background: none;
`;
svgHazardLinesRed.style.width = "100vw";
svgHazardLinesRed.style.height = "100vh";
svgHazardLinesRed.style.opacity = "0";
svgHazardLinesRed.style.willChange = "opacity";
svgHazardLinesRed.style.transition = "opacity .3s";

svgContainerElement.append(svgHazardLines, svgHazardLinesRed);

// Initial SVG element
export const svgElement = createSvgElement("svg");
// touch-action: none is required to prevent default draggness, probably
svgElement.style.cssText = `
  position: relative;
  display: grid;
  touch-action: none;
  cursor: cell;
`;
svgElement.setAttribute("viewBox", `0 0 ${gridSvgWidth} ${gridSvgHeight}`);
svgElement.setAttribute("preserveAspectRatio", "xMidYMid meet");
svgElement.style.width = "100vw";
svgElement.style.height = "100vh";
svgElement.style.maxHeight = "68vw";
svgElement.style.maxWidth = "200vh";
svgContainerElement.append(svgElement);

const startW = (board.width + 2) * gridCellSize;
const startH = (board.height + 2) * gridCellSize;
const endW = gridSvgWidth * 0.95;
const endH = gridSvgHeight * 0.95;

const setVB = (w: number, h: number) =>
  svgElement.setAttribute(
    "viewBox",
    `${(gridSvgWidth - w) / 2} ${(gridSvgHeight - h) / 2} ${w} ${h}`,
  );

export const updateViewBox = (entityCount: number): void => {
  const t = Math.sqrt(Math.min(1, entityCount / 60));
  setVB(startW + (endW - startW) * t, startH + (endH - startH) * t);
};

export const resetViewBox = (): void => setVB(startW, startH);
