import { baseLayer, landmarkLayer } from "../gfx/layers";
import { createSvgElement, toSvgPoint } from "../gfx/svg-utils";
import { addLandmark } from "../state";
import type { Cell } from "../types";

/** Render a nautical-chart caption floating over a body of water. Striking italic serif,
 *  cream fill with a cobalt-blue halo, wide letter-spacing. Does NOT register as a
 *  landmark — purely decorative, placed on `landmarkLayer` above the water. */
export const renderSeaLabel = (x: number, y: number, text: string): void => {
  const { x: sx, y: sy } = toSvgPoint({ x, y });

  const label = createSvgElement("text");
  label.setAttribute("x", String(sx));
  label.setAttribute("y", String(sy));
  label.setAttribute("text-anchor", "middle");
  label.setAttribute("dominant-baseline", "middle");
  label.setAttribute("font-size", "3.6");
  label.setAttribute("font-style", "italic");
  label.setAttribute("font-weight", "700");
  label.setAttribute("letter-spacing", "1.1");
  label.setAttribute("fill", "#fff");
  label.setAttribute("stroke", "#2a6ea8");
  label.setAttribute("stroke-width", "0.8");
  label.setAttribute("paint-order", "stroke fill");
  label.setAttribute("font-family", 'Georgia, "Times New Roman", serif');
  label.textContent = text;
  landmarkLayer.append(label);
};

/** Schloss Eutin — baroque palace with four corner towers, seen from above.
 *  Salmon-pink walls, central courtyard, red conical tower roofs. */
export const renderEutinCastle = (x: number, y: number): void => {
  const { x: sx, y: sy } = toSvgPoint({ x, y });

  // Ground shadow
  const shadow = createSvgElement("ellipse");
  shadow.setAttribute("cx", String(sx + 0.4));
  shadow.setAttribute("cy", String(sy + 0.6));
  shadow.setAttribute("rx", String(3));
  shadow.setAttribute("ry", String(2.8));
  shadow.setAttribute("fill", "#0002");
  shadow.setAttribute("stroke", "none");
  baseLayer.append(shadow);

  // Palace footprint — the four-wing building
  const walls = createSvgElement("rect");
  walls.setAttribute("x", String(sx - 2.4));
  walls.setAttribute("y", String(sy - 2.4));
  walls.setAttribute("width", String(4.8));
  walls.setAttribute("height", String(4.8));
  walls.setAttribute("rx", String(0.4));
  walls.setAttribute("fill", "#e9a"); // salmon-pink Putz
  walls.setAttribute("stroke", "#a55");
  walls.setAttribute("stroke-width", "0.3");
  landmarkLayer.append(walls);

  // Inner courtyard
  const courtyard = createSvgElement("rect");
  courtyard.setAttribute("x", String(sx - 0.9));
  courtyard.setAttribute("y", String(sy - 0.9));
  courtyard.setAttribute("width", String(1.8));
  courtyard.setAttribute("height", String(1.8));
  courtyard.setAttribute("rx", String(0.15));
  courtyard.setAttribute("fill", "#c9b7");
  landmarkLayer.append(courtyard);

  // Four corner towers with red conical roofs
  const towerOffsets: Array<[number, number]> = [
    [-1.85, -1.85],
    [1.85, -1.85],
    [-1.85, 1.85],
    [1.85, 1.85],
  ];
  for (const [dx, dy] of towerOffsets) {
    const tower = createSvgElement("circle");
    tower.setAttribute("cx", String(sx + dx));
    tower.setAttribute("cy", String(sy + dy));
    tower.setAttribute("r", String(0.95));
    tower.setAttribute("fill", "#e9a");
    tower.setAttribute("stroke", "#a55");
    tower.setAttribute("stroke-width", "0.25");
    landmarkLayer.append(tower);

    const roof = createSvgElement("circle");
    roof.setAttribute("cx", String(sx + dx));
    roof.setAttribute("cy", String(sy + dy));
    roof.setAttribute("r", String(0.5));
    roof.setAttribute("fill", "#c44");
    landmarkLayer.append(roof);
  }

  addLandmark({ x, y } as Cell);
};

export const renderFernsehturm = (x: number, y: number): void => {
  const { x: sx, y: sy } = toSvgPoint({ x, y });

  // Base shadow
  const shadow = createSvgElement("circle");
  shadow.setAttribute("cx", String(sx + 0.5));
  shadow.setAttribute("cy", String(sy + 0.5));
  shadow.setAttribute("r", String(2.5));
  shadow.setAttribute("fill", "#0002");
  shadow.setAttribute("stroke", "none");
  baseLayer.append(shadow);

  // Outer ring (observation deck)
  const outer = createSvgElement("circle");
  outer.setAttribute("cx", String(sx));
  outer.setAttribute("cy", String(sy));
  outer.setAttribute("r", String(2));
  outer.setAttribute("fill", "#ccc");
  outer.setAttribute("stroke", "#999");
  outer.setAttribute("stroke-width", "0.4");
  landmarkLayer.append(outer);

  // Inner sphere
  const inner = createSvgElement("circle");
  inner.setAttribute("cx", String(sx));
  inner.setAttribute("cy", String(sy));
  inner.setAttribute("r", String(1.1));
  inner.setAttribute("fill", "#ddd");
  inner.setAttribute("stroke", "#bbb");
  inner.setAttribute("stroke-width", "0.3");
  landmarkLayer.append(inner);

  // Antenna dot
  const dot = createSvgElement("circle");
  dot.setAttribute("cx", String(sx));
  dot.setAttribute("cy", String(sy));
  dot.setAttribute("r", String(0.35));
  dot.setAttribute("fill", "#e33");
  landmarkLayer.append(dot);

  addLandmark({ x, y } as Cell);
};
