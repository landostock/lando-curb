import { lakeLayer } from "../gfx/layers";
import {
  createSvgElement,
  svgLineTo,
  svgMoveTo,
  svgQuadTo,
} from "../gfx/svg-utils";
import { addLake, addReservedArea } from "../state";
import type { Cell, Point } from "../types";

const orientation = (p: Point, q: Point, r: Point): number => {
  const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
  if (val === 0) return 0;
  return val > 0 ? 1 : 2;
};

const getOutlinePoints = (points: Point[]): Point[] => {
  let leftmost = 0;
  for (let i = 1; i < points.length; i++) {
    if (
      points[i]!.y < points[leftmost]!.y ||
      (points[i]!.y === points[leftmost]!.y &&
        points[i]!.x < points[leftmost]!.x)
    ) {
      leftmost = i;
    }
  }

  const hull: Point[] = [];
  let p = leftmost;

  for (;;) {
    hull.push(points[p]!);
    let q = (p + 1) % points.length;
    for (let i = 0; i < points.length; i++) {
      if (orientation(points[p]!, points[i]!, points[q]!) === 2) q = i;
    }
    p = q;
    if (p === leftmost) break;
  }

  for (;;) {
    let q = (p - 1 + points.length) % points.length;
    for (let i = 0; i < points.length; i++) {
      if (orientation(points[p]!, points[i]!, points[q]!) === 2) q = i;
    }
    p = q;
    if (p === leftmost) break;
    hull.push(points[p]!);
  }

  return hull;
};

export interface Lake {
  width: number;
  height: number;
  x: number;
  y: number;
  points: Cell[];
  avoidancePoints: Cell[];
}

const createPondShape = (width: number, height: number): Cell[] => {
  const points: Cell[] = [];

  for (let h = -height / 2 + 0.5; h <= height / 2 - 0.5; h++) {
    for (let w = -width / 2 + 0.5; w <= width / 2 - 0.5; w++) {
      if (width / 2 - Math.abs(w) + Math.random() * 2 - 1 > Math.abs(h)) {
        points.push({ x: Math.floor(w), y: Math.floor(h) } as Cell);
      }
    }
  }

  // If the number of points in the pond is bigger than 2, i.e. it's not
  // the weird visually broken 1x2 size pond, then return it
  if (points.length > 2) return points;

  // Else try again to make a nice pond shape
  return createPondShape(width, height);
};

const createLake = (
  width: number,
  height: number,
  x: number,
  y: number,
): Lake => {
  const points = createPondShape(width, height).map(
    (p) =>
      ({
        x: x + p.x + Math.floor(width / 2),
        y: y + p.y + Math.floor(height / 2),
      }) as Cell,
  );
  const avoidancePoints: Cell[] = [];
  // The entire width and height, not just the cells taken up by the point,
  // are to be avoided when generating new points, to avoid corner-y overlaps
  for (let h = 0; h < height; h++) {
    for (let w = 0; w < width; w++) {
      avoidancePoints.push({ x: x + w, y: y + h } as Cell);
    }
  }
  return { width, height, x, y, points, avoidancePoints };
};

const renderLake = (lake: Lake): void => {
  const outline = getOutlinePoints(lake.points);
  const start = {
    x: outline[0]!.x + (outline.at(-1)!.x - outline[0]!.x) / 2,
    y: outline[0]!.y + (outline.at(-1)!.y - outline[0]!.y) / 2,
  };
  const d = outline.reduce((acc, curr, index) => {
    const next = outline.at((index + 1) % outline.length)!;
    const end = {
      x: curr.x + (next.x - curr.x) / 2,
      y: curr.y + (next.y - curr.y) / 2,
    };
    return acc + svgQuadTo(curr, end);
  }, svgMoveTo(start));

  const pondSvg = createSvgElement("path");
  pondSvg.setAttribute("fill", "#69b");
  pondSvg.setAttribute("d", `${d}Z`);
  pondSvg.setAttribute("stroke-width", String(4));
  pondSvg.setAttribute("stroke-linejoin", "round");
  pondSvg.setAttribute("stroke", "#6ab");

  const pondShadeSvg = createSvgElement("path");
  pondShadeSvg.setAttribute("fill", "#7bc");
  pondShadeSvg.setAttribute("d", `${d}Z`);
  pondShadeSvg.setAttribute("stroke", "#7bc");
  pondShadeSvg.style.filter = "blur(2px)";

  const pondEdgeSvg = createSvgElement("path");
  pondEdgeSvg.setAttribute("d", `${d}Z`);
  pondEdgeSvg.setAttribute("stroke-width", String(6));
  pondEdgeSvg.setAttribute("stroke", "#9b6");

  lakeLayer.append(pondEdgeSvg, pondSvg, pondShadeSvg);
};

const buildSmoothPath = (waypoints: Point[]): string => {
  if (waypoints.length < 2) return "";
  const first = waypoints[0]!;
  const second = waypoints[1]!;
  let d = svgMoveTo(first);
  if (waypoints.length === 2) return d + svgLineTo(second);
  // Start with line to midpoint of first segment
  const mid0 = {
    x: first.x + (second.x - first.x) / 2,
    y: first.y + (second.y - first.y) / 2,
  };
  d += svgLineTo(mid0);
  // Quadratic curves through each interior waypoint
  for (let i = 1; i < waypoints.length - 1; i++) {
    const curr = waypoints[i]!;
    const next = waypoints[i + 1]!;
    const mid = {
      x: curr.x + (next.x - curr.x) / 2,
      y: curr.y + (next.y - curr.y) / 2,
    };
    d += svgQuadTo(curr, mid);
  }
  // End with line to last point
  d += svgLineTo(waypoints.at(-1)!);
  return d;
};

const getRiverCells = (waypoints: Point[], radius: number): Cell[] => {
  const cells = new Set<string>();
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i]!;
    const b = waypoints[i + 1]!;
    const steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) * 2 + 1;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const x = Math.round(a.x + (b.x - a.x) * t);
      const y = Math.round(a.y + (b.y - a.y) * t);
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          cells.add(`${x + dx},${y + dy}`);
        }
      }
    }
  }
  return [...cells].map((k) => {
    const [x, y] = k.split(",").map(Number);
    return { x: x!, y: y! } as Cell;
  });
};

const renderRiver = (d: string, width: number): void => {
  // Three co-layered strokes: green edge, blue water, blurred highlight.
  const stroke = (
    color: string,
    w: number,
    extras?: (el: SVGElement) => void,
  ): SVGElement => {
    const p = createSvgElement("path");
    p.setAttribute("d", d);
    p.setAttribute("fill", "none");
    p.setAttribute("stroke", color);
    p.setAttribute("stroke-width", String(w));
    p.setAttribute("stroke-linecap", "round");
    p.setAttribute("stroke-linejoin", "round");
    extras?.(p);
    return p;
  };
  const edge = stroke("#9b6", width + 2);
  const main = stroke("#69b", width);
  const shade = stroke("#7bc", Math.max(1, width - 1), (el) => {
    el.style.filter = "blur(2px)";
  });
  lakeLayer.append(edge, main, shade);
};

export const spawnRiver = (waypoints: Cell[], width: number): void => {
  // Visible water: bridges required to cross. SVG stroke width is in grid-px (8px per cell),
  // so a width-N stroke spans ~N/8 cells; for width ≤ 8 the stroke fits on the waypoint's
  // own cell and we keep radius 0 (just the center line).
  const points = getRiverCells(waypoints, 0);
  // Placement margin: keep houses/BPs one cell off the bank even though those cells are
  // buildable street-wise.
  const avoidancePoints = getRiverCells(waypoints, 1);
  renderRiver(buildSmoothPath(waypoints), width);
  addLake({
    width: 0,
    height: 0,
    x: waypoints[0]!.x,
    y: waypoints[0]!.y,
    points,
    avoidancePoints,
  });
};

/** Mark cells as off-limits for any placement (no water rendered). */
export const spawnReservedArea = (cells: Cell[]): void => {
  addReservedArea(cells);
};

export const spawnLake = ({
  width,
  height,
  x,
  y,
}: {
  width: number;
  height: number;
  x: number;
  y: number;
}): void => {
  const lake = createLake(width, height, x, y);
  addLake(lake);
  renderLake(lake);
};
