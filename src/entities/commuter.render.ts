import { commuterLayer } from "../gfx/layers";
import { createSvgElement, toSvgPoint } from "../gfx/svg-utils";
import type { Direction } from "../types";
import type { Commuter } from "./commuter";

const CAR_W = 1.4;
const CAR_H = 2.2;

/** Build the car's SVG group + body + windshield + hidden load pin, and attach handles on `c`. */
export const addCommuterToSvg = (c: Commuter): void => {
  const car = createSvgElement("g");
  car.style.transformOrigin = "center";
  car.style.transformBox = "fill-box";
  commuterLayer.append(car);
  c.svgElement = car;

  const body = createSvgElement("rect");
  body.setAttribute("fill", c.type);
  body.setAttribute("width", String(CAR_W));
  body.setAttribute("height", String(CAR_H));
  body.setAttribute("rx", "0.3");
  car.append(body);

  const windshield = createSvgElement("rect");
  windshield.setAttribute("fill", "#fff4");
  windshield.setAttribute("width", String(CAR_W * 0.6));
  windshield.setAttribute("height", String(CAR_H * 0.18));
  windshield.setAttribute("rx", "0.1");
  windshield.setAttribute("x", String(CAR_W * 0.2));
  windshield.setAttribute("y", String(CAR_H * 0.28));
  car.append(windshield);

  // Tiny demand pin on roof — visible when carrying load home.
  const loadIndicator = createSvgElement("path");
  loadIndicator.setAttribute("d", "m6 6-2-2a3 3 0 1 1 4 0Z");
  loadIndicator.setAttribute("fill", "#fff");
  loadIndicator.setAttribute(
    "transform",
    `translate(${CAR_W / 2 - 0.5}, ${CAR_H * 0.35}) scale(0.16)`,
  );
  loadIndicator.style.display = "none";
  car.append(loadIndicator);
  c.loadIndicator = loadIndicator;
};

/** Position + rotate the car's SVG for this frame. For at-home commuters, lay it out relative
 *  to the parent house's facing. For everything else, use the sim's xy/dx/dy. */
export const renderCommuter = (c: Commuter): void => {
  const shouldShowLoad =
    c.carriesLoad && (c.state === "toHome" || c.state === "unparking");
  if (shouldShowLoad !== c.loadVisible) {
    c.loadVisible = shouldShowLoad;
    c.loadIndicator.style.display = shouldShowLoad ? "" : "none";
  }

  if (c.state === "home" && c.parent) {
    const { x: houseX, y: houseY } = toSvgPoint(c.parent);
    const facing = (c.parent as unknown as { facing: Direction }).facing;

    const ux = facing.x, uy = facing.y;
    const px = -uy, py = ux;

    const dAlong = 2.8 + 0.8 - CAR_H / 2;
    const dCross = (CAR_W + 0.3) / 2;
    const side = c.parent.children.indexOf(c) === 0 ? -1 : 1;

    const cx = houseX + ux * dAlong + px * dCross * side;
    const cy = houseY + uy * dAlong + py * dCross * side;
    const deg = (Math.atan2(uy, ux) * 180) / Math.PI - 90;

    c.svgElement.style.transform = `translate(${cx - CAR_W / 2}px, ${cy - CAR_H / 2}px) rotate(${deg}deg)`;
    return;
  }

  const deg = (Math.atan2(c.dy, c.dx) * 180) / Math.PI - 90;
  c.svgElement.style.transform = `translate(${c.x - CAR_W / 2}px, ${c.y - CAR_H / 2}px) rotate(${deg}deg)`;
};
