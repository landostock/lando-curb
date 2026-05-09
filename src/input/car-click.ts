import type { Commuter } from "../entities/commuter";
import { gridPointerLayer, pinLayer } from "../gfx/layers";
import { svgElement } from "../gfx/svg";
import { createSvgElement } from "../gfx/svg-utils";
import { commuters } from "../state";

const HIT_RADIUS = 10; // SVG px — generous for tiny cars

/** Convert a mouse event to SVG coordinate space (respects viewBox + CSS transforms). */
const toSvgCoords = (event: MouseEvent): { x: number; y: number } | null => {
  const ctm = svgElement.getScreenCTM();
  if (!ctm) return null;
  const pt = svgElement.createSVGPoint();
  pt.x = event.clientX;
  pt.y = event.clientY;
  const { x, y } = pt.matrixTransform(ctm.inverse());
  return { x, y };
};

const findNearestCar = (svgX: number, svgY: number): Commuter | null => {
  let best: Commuter | null = null;
  let bestDist2 = HIT_RADIUS * HIT_RADIUS;
  for (const c of commuters) {
    if (c.state === "home") continue;
    const dx = c.x - svgX;
    const dy = c.y - svgY;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestDist2) {
      bestDist2 = d2;
      best = c;
    }
  }
  return best;
};

const showIndicator = (
  car: Commuter,
  destX: number,
  destY: number,
  color: string,
): void => {
  const g = createSvgElement("g");
  g.style.pointerEvents = "none";
  g.style.transition = "opacity 0.4s";

  // Dashed line: car (live position) → destination
  const line = createSvgElement("line");
  line.setAttribute("x1", String(car.x));
  line.setAttribute("y1", String(car.y));
  line.setAttribute("x2", String(destX));
  line.setAttribute("y2", String(destY));
  line.setAttribute("stroke", color);
  line.setAttribute("stroke-width", "0.8");
  line.setAttribute("stroke-dasharray", "2 1.5");
  line.setAttribute("stroke-linecap", "round");
  g.append(line);

  // Solid dot at destination
  const dot = createSvgElement("circle");
  dot.setAttribute("cx", String(destX));
  dot.setAttribute("cy", String(destY));
  dot.setAttribute("r", "2");
  dot.setAttribute("fill", color);
  dot.setAttribute("stroke", "#fff");
  dot.setAttribute("stroke-width", "0.7");
  g.append(dot);

  // Expanding ping ring
  const ring = createSvgElement("circle");
  ring.setAttribute("cx", String(destX));
  ring.setAttribute("cy", String(destY));
  ring.setAttribute("r", "2");
  ring.setAttribute("fill", "none");
  ring.setAttribute("stroke", color);
  ring.setAttribute("stroke-width", "1.2");
  ring.style.transition =
    "r 1.2s ease-out, stroke-width 1.2s ease-out, opacity 1.2s ease-out";
  g.append(ring);

  pinLayer.append(g);

  // Track car position every frame so the line root follows the moving car
  let rafId = 0;
  const track = () => {
    line.setAttribute("x1", String(car.x));
    line.setAttribute("y1", String(car.y));
    rafId = requestAnimationFrame(track);
  };
  rafId = requestAnimationFrame(track);

  // Trigger ring animation on next frame
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      ring.setAttribute("r", "9");
      ring.setAttribute("stroke-width", "0.3");
      ring.style.opacity = "0";
    });
  });

  // Fade out and stop tracking after 2.5 s
  setTimeout(() => {
    cancelAnimationFrame(rafId);
    g.style.opacity = "0";
    setTimeout(() => g.remove(), 400);
  }, 2500);
};

export const initCarClick = (): void => {
  gridPointerLayer.addEventListener("dblclick", (event) => {
    const coords = toSvgCoords(event);
    if (!coords) return;

    const car = findNearestCar(coords.x, coords.y);
    if (!car) return;

    const dest = car.reactivate();
    if (dest) {
      showIndicator(car, dest.destX, dest.destY, car.type);
    }
  });
};
