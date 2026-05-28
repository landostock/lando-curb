import { playAppearChime } from "../audio";
import { colors } from "../gfx/colors";
import { gridLineThickness } from "../gfx/grid";
import {
  borderLayer,
  gridBlockLayer,
  houseLayer,
  houseShadowLayer,
  parkingMarkingLayer,
  pinLayer,
} from "../gfx/layers";
import { createSvgElement, toSvgEdge } from "../gfx/svg-utils";
import { getSpawningConfig } from "../logic/spawning";
import type { Pixel } from "../types";
import type { BusinessPark } from "./business-park";

export interface LayoutRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** SVG elements owned exclusively by this render module */
export interface BusinessParkRenderState {
  pinSvg: SVGGElement & { translate?: string };
  pinBubble: SVGPathElement;
  warnCircleBg: SVGCircleElement;
  warnCircle: SVGCircleElement;
  demandSvg: SVGGElement;
  buildingSvg: SVGGElement;
  parkingLotSvg?: SVGGElement;
  parkingMarkingSvg?: SVGGElement;
  parkOriginX: number;
  parkOriginY: number;
  parkLotW: number;
  parkLotH: number;
  parkX: number;
  parkY: number;
  parkW: number;
  parkH: number;
  buildingRects: LayoutRect[];
  buildingW: number;
  buildingH: number;
  prevProgress: number;
  prevDemand: number;
  demandDirty: boolean;
  warnToggled: boolean;
  // Trending / popular
  trendingCircle: SVGCircleElement;
  trendingCircleBg: SVGCircleElement;
  starSvg: SVGPathElement;
  wasTrending: boolean;
  wasPopular: boolean;
}

export interface BayGeometry {
  bayCenters: Pixel[];
  bayLanePoints: Pixel[];
  bayExitLanePoints: Pixel[];
  bayReturnLanePoints: Pixel[];
  bayEntryRails: Pixel[][];
  bayExitRails: Pixel[][];
  bayEntryDistances: number[];
  drivewayPoint: Pixel;
  departureDrivewayPoint: Pixel;
}

const requireRenderState = (bp: BusinessPark): BusinessParkRenderState => {
  if (!bp.rs) {
    throw new Error("Business park render state is not initialized");
  }
  return bp.rs;
};

const roundness = 2;
const borderLineThickness = 1;
const parkingFraction = 0.56;
const parkingInset = 0.58;

interface ParkLayout {
  x: number;
  y: number;
  svgWidth: number;
  svgHeight: number;
  bx: number;
  by: number;
  bw: number;
  bh: number;
  px: number;
  py: number;
  pw: number;
  ph: number;
  buildingRects: LayoutRect[];
  demandBounds: LayoutRect;
}

export function scheduleSpawnAnimation(bp: BusinessPark, delay: number): void {
  setTimeout(() => addBusinessParkToSvg(bp), delay);
}

function addBusinessParkToSvg(bp: BusinessPark): void {
  if (!bp.silentAppearChime) playAppearChime();
  const layout = computeLayout(bp);
  const rs = initRenderState(bp, layout);

  addGrassBackground(layout);
  addBuildingShadow(layout);
  addBuilding(bp, rs, layout);
  const bays = drawParkingLot(bp);
  bp.bayCenters = bays.bayCenters;
  bp.bayLanePoints = bays.bayLanePoints;
  bp.bayExitLanePoints = bays.bayExitLanePoints;
  bp.bayReturnLanePoints = bays.bayReturnLanePoints;
  bp.bayEntryRails = bays.bayEntryRails;
  bp.bayExitRails = bays.bayExitRails;
  bp.bayEntryDistances = bays.bayEntryDistances;
  bp.drivewayPoint = bays.drivewayPoint;
  bp.departureDrivewayPoint = bays.departureDrivewayPoint;
  addBorder(bp, layout);
  addStatusPins(rs, layout);
}

function computeLayout(bp: BusinessPark): ParkLayout {
  const x = toSvgEdge(bp.x) + borderLineThickness / 2 + gridLineThickness / 2;
  const y = toSvgEdge(bp.y) + borderLineThickness / 2 + gridLineThickness / 2;
  const svgWidth =
    toSvgEdge(bp.width) - borderLineThickness - gridLineThickness;
  const svgHeight =
    toSvgEdge(bp.height) - borderLineThickness - gridLineThickness;

  let px: number, py: number, pw: number, ph: number;
  const buildingRects: LayoutRect[] = [];

  if (bp.parkingRotation === 3) {
    px = x;
    py = y;
    pw = svgWidth * parkingFraction;
    ph = svgHeight;
    buildingRects.push({ x: x + pw, y, w: svgWidth - pw, h: svgHeight });
  } else if (bp.parkingRotation === 1) {
    px = x + svgWidth * (1 - parkingFraction);
    py = y;
    pw = svgWidth * parkingFraction;
    ph = svgHeight;
    buildingRects.push({ x, y, w: svgWidth - pw, h: svgHeight });
  } else if (bp.parkingRotation === 0) {
    py = y;
    px = x;
    pw = svgWidth;
    ph = svgHeight * parkingFraction;
    buildingRects.push({ x, y: y + ph, w: svgWidth, h: svgHeight - ph });
  } else {
    px = x;
    ph = svgHeight * parkingFraction;
    py = y + svgHeight - ph;
    pw = svgWidth;
    buildingRects.push({ x, y, w: svgWidth, h: svgHeight - ph });
  }

  const demandBounds = buildingRects.reduce((best, rect) =>
    rect.w * rect.h > best.w * best.h ? rect : best,
  );

  return {
    x,
    y,
    svgWidth,
    svgHeight,
    bx: demandBounds.x,
    by: demandBounds.y,
    bw: demandBounds.w,
    bh: demandBounds.h,
    px,
    py,
    pw,
    ph,
    buildingRects,
    demandBounds,
  };
}

export function businessParkTreeClearanceRects(bp: BusinessPark): LayoutRect[] {
  if (bp.rs) {
    return [
      { x: bp.rs.parkX, y: bp.rs.parkY, w: bp.rs.parkW, h: bp.rs.parkH },
      ...bp.rs.buildingRects,
    ];
  }
  const layout = computeLayout(bp);
  return [
    { x: layout.x, y: layout.y, w: layout.svgWidth, h: layout.svgHeight },
    ...layout.buildingRects,
  ];
}

export function renderBusinessPark(bp: BusinessPark): void {
  const { rs } = bp;
  if (!rs) return; // SVG not yet initialised — addBusinessParkToSvg pending

  // Trending state transitions
  if (bp.trending !== rs.wasTrending) {
    rs.wasTrending = bp.trending;
    if (bp.trending) {
      showTrending(bp);
    } else if (!bp.popular) {
      hideTrending(bp);
    }
  }

  // Popular conversion
  if (bp.popular && !rs.wasPopular) {
    rs.wasPopular = true;
    hideTrending(bp);
    showPopular(bp);
  }

  // Trending countdown ring
  if (bp.trending) {
    updateTrending(bp);
  }

  if (bp.hasWarn !== rs.warnToggled) {
    rs.warnToggled = bp.hasWarn;
    (bp.hasWarn ? showWarn : hideWarn)(bp);
  }

  if (bp.hasWarn) {
    updateWarn(bp);
  }
  if (bp.demand !== rs.prevDemand) {
    rs.prevDemand = bp.demand;
    updateDemandDisplay(bp);
  }
}

function initRenderState(
  bp: BusinessPark,
  l: ParkLayout,
): BusinessParkRenderState {
  const rs = {} as BusinessParkRenderState;
  bp.rs = rs;
  rs.parkOriginX = l.px;
  rs.parkOriginY = l.py;
  rs.parkLotW = l.pw;
  rs.parkLotH = l.ph;
  rs.parkX = l.x;
  rs.parkY = l.y;
  rs.parkW = l.svgWidth;
  rs.parkH = l.svgHeight;
  rs.buildingRects = l.buildingRects;
  rs.buildingW = l.demandBounds.w;
  rs.buildingH = l.demandBounds.h;
  rs.prevProgress = 0;
  rs.prevDemand = 0;
  rs.demandDirty = false;
  rs.warnToggled = false;
  rs.wasTrending = false;
  rs.wasPopular = false;
  return rs;
}

function addGrassBackground(l: ParkLayout): void {
  const bg = createSvgElement("rect");
  bg.style.width = String(l.svgWidth);
  bg.style.height = String(l.svgHeight);
  bg.setAttribute("rx", String(roundness));
  bg.setAttribute("transform", `translate(${l.x},${l.y})`);
  bg.style.opacity = String(0);
  bg.style.transition = "opacity .8s";
  bg.style.willChange = "opacity";
  bg.setAttribute("fill", colors.grass);
  gridBlockLayer.append(bg);
  setTimeout(() => (bg.style.opacity = String(1)), 1000);
  setTimeout(() => (bg.style.willChange = ""), 2000);
}

function addBuildingShadow(l: ParkLayout): void {
  for (const rect of l.buildingRects) {
    const shadow = createSvgElement("rect");
    shadow.setAttribute("width", String(rect.w));
    shadow.setAttribute("height", String(rect.h));
    shadow.setAttribute("rx", String(roundness));
    shadow.setAttribute("fill", colors.black);
    shadow.setAttribute("stroke", "none");
    shadow.style.transform = `translate(${rect.x}px,${rect.y}px)`;
    shadow.style.opacity = "0";
    shadow.style.willChange = "opacity, transform";
    shadow.style.transition = "opacity .4s, transform .6s";
    houseShadowLayer.append(shadow);
    setTimeout(() => {
      shadow.style.opacity = "1";
      shadow.style.transform = `translate(${rect.x + 0.8}px,${rect.y + 0.8}px)`;
    }, 800);
    setTimeout(() => (shadow.style.willChange = ""), 1500);
  }
}

function addBuilding(
  bp: BusinessPark,
  rs: BusinessParkRenderState,
  l: ParkLayout,
): void {
  rs.buildingSvg = createSvgElement("g");
  houseLayer.append(rs.buildingSvg);

  for (const rect of l.buildingRects) {
    if (bp.types.length > 1) {
      addSplitRoof(rs.buildingSvg, bp.types, rect);
      continue;
    }
    const roof = createSvgElement("rect");
    roof.setAttribute("x", String(rect.x));
    roof.setAttribute("y", String(rect.y));
    roof.setAttribute("width", String(rect.w));
    roof.setAttribute("height", String(rect.h));
    roof.setAttribute("rx", String(roundness));
    roof.setAttribute("fill", bp.borderColor);
    rs.buildingSvg.append(roof);
  }
}

function addSplitRoof(
  parent: SVGGElement,
  types: string[],
  bounds: LayoutRect,
): void {
  const defs = createSvgElement("defs");
  const clipA = createSvgElement("clipPath");
  clipA.id = `rc-a-${bounds.x | 0}-${bounds.y | 0}-${bounds.w | 0}`;
  const polyA = createSvgElement("polygon");
  polyA.setAttribute(
    "points",
    `${bounds.x},${bounds.y} ${bounds.x + bounds.w},${bounds.y} ${bounds.x},${bounds.y + bounds.h}`,
  );
  clipA.append(polyA);
  const clipB = createSvgElement("clipPath");
  clipB.id = `rc-b-${bounds.x | 0}-${bounds.y | 0}-${bounds.w | 0}`;
  const polyB = createSvgElement("polygon");
  polyB.setAttribute(
    "points",
    `${bounds.x + bounds.w},${bounds.y} ${bounds.x + bounds.w},${bounds.y + bounds.h} ${bounds.x},${bounds.y + bounds.h}`,
  );
  clipB.append(polyB);
  defs.append(clipA, clipB);
  parent.append(defs);

  for (const [color, clip] of [
    [types[0]!, clipA],
    [types[1]!, clipB],
  ] as const) {
    const roof = createSvgElement("rect");
    roof.setAttribute("x", String(bounds.x));
    roof.setAttribute("y", String(bounds.y));
    roof.setAttribute("width", String(bounds.w));
    roof.setAttribute("height", String(bounds.h));
    roof.setAttribute("rx", String(roundness));
    roof.setAttribute("fill", color);
    roof.setAttribute("clip-path", `url(#${clip.id})`);
    parent.append(roof);
  }
}

function addBorder(bp: BusinessPark, l: ParkLayout): void {
  const border = createSvgElement("rect");
  border.setAttribute("width", String(l.svgWidth));
  border.setAttribute("height", String(l.svgHeight));
  border.setAttribute("rx", String(roundness));
  border.setAttribute("transform", `translate(${l.x},${l.y})`);
  border.setAttribute(
    "stroke",
    bp.types.length > 1 ? colors.ui : bp.borderColor,
  );
  border.setAttribute("stroke-width", "0.5");
  border.setAttribute("fill", "none");
  border.setAttribute("opacity", "0.4");
  borderLayer.append(border);
}

function addStatusPins(rs: BusinessParkRenderState, l: ParkLayout): void {
  // Warn pin — countdown bubble, centered on whole park
  rs.pinSvg = createSvgElement("g");
  rs.pinSvg.translate = `${l.x + l.svgWidth / 2}px, ${l.y + l.svgHeight / 2 + 1.5}px`;
  rs.pinSvg.style.willChange = `opacity, transform`;
  rs.pinSvg.style.transition = `all .8s cubic-bezier(.5, 2, .5, 1)`;
  rs.pinSvg.style.transformOrigin = "bottom";
  rs.pinSvg.style.transformBox = "fill-box";
  rs.pinSvg.style.opacity = String(0);
  rs.pinSvg.style.transform = `translate(${rs.pinSvg.translate}) scale(0)`;
  pinLayer.append(rs.pinSvg);

  rs.pinBubble = createSvgElement("path");
  rs.pinBubble.setAttribute("fill", "#fff");
  rs.pinBubble.setAttribute("d", "m6 6-2-2a3 3 0 1 1 4 0Z");
  rs.pinBubble.setAttribute("transform", "translate(-9 -9) scale(1.5)");
  rs.pinSvg.append(rs.pinBubble);

  rs.warnCircleBg = createSvgElement("circle");
  rs.warnCircleBg.setAttribute("fill", "none");
  rs.warnCircleBg.setAttribute("stroke-width", "2");
  rs.warnCircleBg.setAttribute("stroke-linecap", "square");
  rs.warnCircleBg.setAttribute("r", String(2));
  rs.warnCircleBg.setAttribute("stroke", colors.ui);
  rs.warnCircleBg.setAttribute("opacity", String(0.2));
  rs.warnCircleBg.setAttribute("transform", "scale(1.2) translate(0 -5.3)");
  rs.pinSvg.append(rs.warnCircleBg);

  rs.warnCircle = createSvgElement("circle");
  rs.warnCircle.setAttribute("fill", "none");
  rs.warnCircle.setAttribute("stroke-width", "2");
  rs.warnCircle.setAttribute("stroke-linecap", "butt");
  rs.warnCircle.setAttribute("r", String(2));
  rs.warnCircle.setAttribute("stroke", colors.red);
  rs.warnCircle.style.willChange = "stroke-dashoffset";
  rs.warnCircle.style.transition = "stroke-dashoffset .3s .1s";
  rs.warnCircle.setAttribute("stroke-dasharray", String(12.56));
  rs.warnCircle.setAttribute("stroke-dashoffset", String(12.56));
  rs.warnCircle.setAttribute(
    "transform",
    "scale(1.2) translate(0 -5.3) rotate(-90)",
  );
  rs.pinSvg.append(rs.warnCircle);

  rs.pinSvg.style.opacity = String(1);

  // Trending countdown circle — reuses the pin position, green tone
  rs.trendingCircleBg = createSvgElement("circle");
  rs.trendingCircleBg.setAttribute("fill", "none");
  rs.trendingCircleBg.setAttribute("stroke-width", "2");
  rs.trendingCircleBg.setAttribute("stroke-linecap", "square");
  rs.trendingCircleBg.setAttribute("r", String(2));
  rs.trendingCircleBg.setAttribute("stroke", colors.ui);
  rs.trendingCircleBg.setAttribute("opacity", "0");
  rs.trendingCircleBg.setAttribute("transform", "scale(1.2) translate(0 -5.3)");
  rs.pinSvg.append(rs.trendingCircleBg);

  rs.trendingCircle = createSvgElement("circle");
  rs.trendingCircle.setAttribute("fill", "none");
  rs.trendingCircle.setAttribute("stroke-width", "2");
  rs.trendingCircle.setAttribute("stroke-linecap", "butt");
  rs.trendingCircle.setAttribute("r", String(2));
  rs.trendingCircle.setAttribute("stroke", "#2a2");
  rs.trendingCircle.style.willChange = "stroke-dashoffset";
  rs.trendingCircle.style.transition = "stroke-dashoffset .3s";
  rs.trendingCircle.setAttribute("stroke-dasharray", String(12.56));
  rs.trendingCircle.setAttribute("stroke-dashoffset", "0");
  rs.trendingCircle.setAttribute("opacity", "0");
  rs.trendingCircle.setAttribute(
    "transform",
    "scale(1.2) translate(0 -5.3) rotate(-90)",
  );
  rs.pinSvg.append(rs.trendingCircle);

  // Popular star — hidden until converted
  rs.starSvg = createSvgElement("path");
  rs.starSvg.setAttribute(
    "d",
    "M0-3.5 .8-1 3.3-1 1.3.5 2 3.2 0 1.5-2 3.2-1.3.5-3.3-1-.8-1Z",
  );
  rs.starSvg.setAttribute("fill", "#fc0");
  rs.starSvg.setAttribute("stroke", "#b80");
  rs.starSvg.setAttribute("stroke-width", "0.3");
  rs.starSvg.setAttribute("transform", "translate(0 -6) scale(0)");
  rs.starSvg.style.transition = "transform .6s cubic-bezier(.5, 2, .5, 1)";
  rs.pinSvg.append(rs.starSvg);

  // Demand pins — small icons showing count, centered on building
  rs.demandSvg = createSvgElement("g");
  rs.demandSvg.style.transform = `translate(${l.demandBounds.x + l.demandBounds.w / 2}px, ${l.demandBounds.y + l.demandBounds.h / 2}px)`;
  pinLayer.append(rs.demandSvg);
}

const mapParkPoint = (
  rs: BusinessParkRenderState,
  bp: BusinessPark,
  nx: number,
  ny: number,
): Pixel => {
  const x = rs.parkOriginX + parkingInset;
  const y = rs.parkOriginY + parkingInset;
  const w = rs.parkLotW - parkingInset * 2;
  const h = rs.parkLotH - parkingInset * 2;
  if (bp.parkingRotation === 1)
    return { x: x + (1 - ny) * w, y: y + nx * h } as Pixel;
  if (bp.parkingRotation === 2)
    return { x: x + (1 - nx) * w, y: y + (1 - ny) * h } as Pixel;
  if (bp.parkingRotation === 3)
    return { x: x + ny * w, y: y + (1 - nx) * h } as Pixel;
  return { x: x + nx * w, y: y + ny * h } as Pixel;
};

const addMappedDivider = (
  parent: SVGGElement,
  rs: BusinessParkRenderState,
  bp: BusinessPark,
  x: number,
  y1: number,
  y2: number,
): void => {
  const from = mapParkPoint(rs, bp, x, y1);
  const to = mapParkPoint(rs, bp, x, y2);
  const divider = createSvgElement("line");
  divider.setAttribute("x1", String(from.x));
  divider.setAttribute("y1", String(from.y));
  divider.setAttribute("x2", String(to.x));
  divider.setAttribute("y2", String(to.y));
  divider.setAttribute("stroke", "#fff9");
  divider.setAttribute("stroke-width", "0.3");
  divider.setAttribute("stroke-linecap", "round");
  parent.append(divider);
};

interface ParkLocalPoint {
  x: number;
  y: number;
}

const sameLocalPoint = (a: ParkLocalPoint, b: ParkLocalPoint): boolean =>
  (a.x - b.x) ** 2 + (a.y - b.y) ** 2 < 0.000001;

const compactLocalRoute = (points: ParkLocalPoint[]): ParkLocalPoint[] => {
  const route: ParkLocalPoint[] = [];
  for (const point of points) {
    const last = route.at(-1);
    if (!last || !sameLocalPoint(last, point)) route.push(point);
  }
  return route;
};

const mapLocalRoute = (
  rs: BusinessParkRenderState,
  bp: BusinessPark,
  route: ParkLocalPoint[],
): Pixel[] => route.map((point) => mapParkPoint(rs, bp, point.x, point.y));

const localRouteDistance = (route: ParkLocalPoint[]): number => {
  let distance = 0;
  for (let i = 1; i < route.length; i++) {
    const from = route[i - 1]!;
    const to = route[i]!;
    distance += Math.hypot(to.x - from.x, to.y - from.y);
  }
  return distance;
};

const slotCentersFor = (
  bayCount: number,
  entryFromRight: boolean,
): number[] => {
  const first = entryFromRight ? 0.22 : 0.46;
  const last = entryFromRight ? 0.54 : 0.78;
  if (bayCount === 1) return [(first + last) / 2];
  return Array.from(
    { length: bayCount },
    (_, i) => first + ((last - first) * i) / (bayCount - 1),
  );
};

const roadDocksFor = (
  variant: number,
): { arrival: ParkLocalPoint; departure: ParkLocalPoint } => {
  const docks = [
    {
      arrival: { x: 0.19, y: 0.06 },
      departure: { x: 0.34, y: 0.06 },
    },
    {
      arrival: { x: 0.66, y: 0.06 },
      departure: { x: 0.81, y: 0.06 },
    },
    {
      arrival: { x: 0.06, y: 0.56 },
      departure: { x: 0.06, y: 0.4 },
    },
    {
      arrival: { x: 0.94, y: 0.4 },
      departure: { x: 0.94, y: 0.56 },
    },
  ];
  return docks[variant] ?? docks[0]!;
};

type LoopSide = "top" | "left" | "bottom" | "right";

interface LoopPoint extends ParkLocalPoint {
  side: LoopSide;
}

interface ParkingLoopRoute {
  entry: ParkLocalPoint[];
  exit: ParkLocalPoint[];
}

const loopBounds = {
  top: 0.23,
  left: 0.11,
  bottom: 0.77,
  right: 0.89,
};

const slotDoorInset = 0.028;

const clampLoopX = (x: number): number =>
  Math.min(loopBounds.right, Math.max(loopBounds.left, x));

const clampLoopY = (y: number): number =>
  Math.min(loopBounds.bottom, Math.max(loopBounds.top, y));

const loopProgress = ({ side, x, y }: LoopPoint): number => {
  const topLength = loopBounds.right - loopBounds.left;
  const sideLength = loopBounds.bottom - loopBounds.top;
  if (side === "top") return loopBounds.right - x;
  if (side === "left") return topLength + y - loopBounds.top;
  if (side === "bottom") return topLength + sideLength + x - loopBounds.left;
  return topLength * 2 + sideLength + loopBounds.bottom - y;
};

const loopCornerAfter = (side: LoopSide): LoopPoint => {
  if (side === "top")
    return { side: "left", x: loopBounds.left, y: loopBounds.top };
  if (side === "left")
    return { side: "bottom", x: loopBounds.left, y: loopBounds.bottom };
  if (side === "bottom")
    return { side: "right", x: loopBounds.right, y: loopBounds.bottom };
  return { side: "top", x: loopBounds.right, y: loopBounds.top };
};

const loopCornerBefore = (side: LoopSide): LoopPoint => {
  if (side === "top")
    return { side: "right", x: loopBounds.right, y: loopBounds.top };
  if (side === "right")
    return { side: "bottom", x: loopBounds.right, y: loopBounds.bottom };
  if (side === "bottom")
    return { side: "left", x: loopBounds.left, y: loopBounds.bottom };
  return { side: "top", x: loopBounds.left, y: loopBounds.top };
};

const loopPerimeter = (): number =>
  2 *
  (loopBounds.right -
    loopBounds.left +
    loopBounds.bottom -
    loopBounds.top);

const loopPath = (
  from: LoopPoint,
  to: LoopPoint,
  clockwise = false,
): ParkLocalPoint[] => {
  const route: LoopPoint[] = [from];
  let current = from;

  for (let guard = 0; guard < 5; guard++) {
    if (current.side === to.side) break;
    const corner = clockwise
      ? loopCornerBefore(current.side)
      : loopCornerAfter(current.side);
    route.push(corner);
    current = corner;
  }

  route.push(to);
  return compactLocalRoute(route);
};

const shortestLoopPath = (from: LoopPoint, to: LoopPoint): ParkLocalPoint[] => {
  const clockwiseDistance =
    (loopProgress(from) - loopProgress(to) + loopPerimeter()) %
    loopPerimeter();
  const counterClockwiseDistance =
    (loopProgress(to) - loopProgress(from) + loopPerimeter()) %
    loopPerimeter();
  return loopPath(from, to, clockwiseDistance < counterClockwiseDistance);
};

const loopDockFor = (variant: number, dock: ParkLocalPoint): LoopPoint => {
  if (variant === 2)
    return {
      side: "left",
      x: loopBounds.left,
      y: clampLoopY(dock.y),
    };
  if (variant === 3)
    return {
      side: "right",
      x: loopBounds.right,
      y: clampLoopY(dock.y),
    };
  return {
    side: "top",
    x: clampLoopX(dock.x),
    y: loopBounds.top,
  };
};

const laneLoopPoint = (lane: ParkLocalPoint): LoopPoint => {
  const topDistance = Math.abs(lane.y - loopBounds.top);
  const bottomDistance = Math.abs(lane.y - loopBounds.bottom);
  if (topDistance < bottomDistance)
    return { side: "top", x: clampLoopX(lane.x), y: loopBounds.top };
  return { side: "bottom", x: clampLoopX(lane.x), y: loopBounds.bottom };
};

const entersSlotFromTop = (variant: number): boolean =>
  variant === 1 || variant === 3;

const parkingLoopRouteFor = (
  variant: number,
  arrivalDock: ParkLocalPoint,
  departureDock: ParkLocalPoint,
  entryLane: ParkLocalPoint,
  entryDoor: ParkLocalPoint,
  exitLane: ParkLocalPoint,
  exitDoor: ParkLocalPoint,
  center: ParkLocalPoint,
): ParkingLoopRoute => {
  const entryLoopStart = loopDockFor(variant, arrivalDock);
  const entryLoopEnd = laneLoopPoint(entryLane);
  const exitLoopStart = laneLoopPoint(exitLane);
  const exitLoopEnd = loopDockFor(variant, departureDock);
  const entryLoop = shortestLoopPath(entryLoopStart, entryLoopEnd);
  const exitLoop = shortestLoopPath(exitLoopStart, exitLoopEnd);

  return {
    entry: compactLocalRoute([
      arrivalDock,
      ...entryLoop,
      entryDoor,
      center,
    ]),
    exit: compactLocalRoute([
      exitDoor,
      ...exitLoop,
      departureDock,
    ]),
  };
};

export function drawParkingLot(bp: BusinessPark): BayGeometry {
  const rs = requireRenderState(bp);
  const inset = parkingInset;
  const lotW = rs.parkLotW - inset * 2;
  const lotH = rs.parkLotH - inset * 2;

  // Remove old lot if rebuilding
  if (rs.parkingLotSvg) rs.parkingLotSvg.remove();
  if (rs.parkingMarkingSvg) rs.parkingMarkingSvg.remove();

  rs.parkingLotSvg = createSvgElement("g");
  rs.parkingLotSvg.style.transform = `translate(${rs.parkOriginX + inset}px, ${rs.parkOriginY + inset}px)`;
  gridBlockLayer.append(rs.parkingLotSvg);

  rs.parkingMarkingSvg = createSvgElement("g");
  parkingMarkingLayer.append(rs.parkingMarkingSvg);

  // Asphalt pad
  const asphalt = createSvgElement("rect");
  asphalt.setAttribute("width", String(lotW));
  asphalt.setAttribute("height", String(lotH));
  asphalt.setAttribute("rx", "0.8");
  asphalt.setAttribute("fill", colors.road);
  rs.parkingLotSvg.append(asphalt);

  const bayCount = bp.parkingCapacity;

  const variant = bp.parkingVariant % 4;
  const entryFromRight = variant === 1 || variant === 3;
  const slotCenters = slotCentersFor(bayCount, entryFromRight);
  const slotTop = 0.31;
  const slotBottom = 0.69;
  const docks = roadDocksFor(variant);
  const drivewayLocal = docks.arrival;
  const departureDrivewayLocal = docks.departure;

  const bayCenters: Pixel[] = [];
  const bayLanePoints: Pixel[] = [];
  const bayExitLanePoints: Pixel[] = [];
  const bayReturnLanePoints: Pixel[] = [];
  const bayEntryRails: Pixel[][] = [];
  const bayExitRails: Pixel[][] = [];
  const bayEntryDistances: number[] = [];

  const slotStep =
    slotCenters.length > 1 ? slotCenters[1]! - slotCenters[0]! : 0.16;
  const markerMid = (slotTop + slotBottom) / 2;
  const markerHalfLength = ((slotBottom - slotTop) * 0.8) / 2;
  for (let i = 0; i <= slotCenters.length; i++) {
    const dividerX = slotCenters[0]! - slotStep / 2 + slotStep * i;
    addMappedDivider(
      rs.parkingMarkingSvg,
      rs,
      bp,
      dividerX,
      markerMid - markerHalfLength,
      markerMid + markerHalfLength,
    );
  }

  for (let i = 0; i < bayCount; i++) {
    const sx = slotCenters[i]!;
    const centerLocal = { x: sx, y: (slotTop + slotBottom) / 2 };
    const center = mapParkPoint(rs, bp, sx, (slotTop + slotBottom) / 2);

    const topPoint = { x: sx, y: loopBounds.top };
    const bottomPoint = { x: sx, y: loopBounds.bottom };
    const entersFromTop = entersSlotFromTop(variant);
    const entryPoint = entersFromTop ? topPoint : bottomPoint;
    const exitPoint = entersFromTop ? bottomPoint : topPoint;
    const entryDoor = {
      x: sx,
      y: entersFromTop ? slotTop - slotDoorInset : slotBottom + slotDoorInset,
    };
    const exitDoor = {
      x: sx,
      y: entersFromTop ? slotBottom + slotDoorInset : slotTop - slotDoorInset,
    };

    bayCenters.push(center);
    bayLanePoints.push(mapParkPoint(rs, bp, entryPoint.x, entryPoint.y));
    bayExitLanePoints.push(mapParkPoint(rs, bp, exitPoint.x, exitPoint.y));
    bayReturnLanePoints.push(
      mapParkPoint(rs, bp, drivewayLocal.x, drivewayLocal.y),
    );
    const routes = parkingLoopRouteFor(
      variant,
      drivewayLocal,
      departureDrivewayLocal,
      entryPoint,
      entryDoor,
      exitPoint,
      exitDoor,
      centerLocal,
    );
    bayEntryDistances.push(localRouteDistance(routes.entry));

    bayEntryRails.push(mapLocalRoute(rs, bp, routes.entry));
    bayExitRails.push(mapLocalRoute(rs, bp, routes.exit));
  }

  const drivewayPoint = mapParkPoint(rs, bp, drivewayLocal.x, drivewayLocal.y);
  const departureDrivewayPoint = mapParkPoint(
    rs,
    bp,
    departureDrivewayLocal.x,
    departureDrivewayLocal.y,
  );

  return {
    bayCenters,
    bayLanePoints,
    bayExitLanePoints,
    bayReturnLanePoints,
    bayEntryRails,
    bayExitRails,
    bayEntryDistances,
    drivewayPoint,
    departureDrivewayPoint,
  };
}

export function updateDemandDisplay(bp: BusinessPark): void {
  const rs = requireRenderState(bp);

  const count = bp.demand;

  // Rebuild all pins — layout depends on total count
  while (rs.demandSvg.children.length) {
    rs.demandSvg.lastChild!.remove();
  }
  // Above the pin cap, the warn display takes over solo; 0 → nothing to draw.
  if (count === 0 || count > getSpawningConfig().demandPinCap) return;

  const pinScale = 0.3;
  const spacing = 2.2;
  const maxCols = Math.max(1, Math.floor((rs.buildingW - 1) / spacing));
  const cols = Math.min(count, maxCols);
  const rows = Math.ceil(count / cols);
  const totalH = rows * spacing;

  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const rowItems = row < rows - 1 ? cols : count - row * cols;
    const rowW = rowItems * spacing;

    const px = col * spacing - rowW / 2 + spacing / 2;
    const py = row * spacing - totalH / 2 + spacing / 2;

    const pin = createSvgElement("path");
    pin.setAttribute("d", "m6 6-2-2a3 3 0 1 1 4 0Z");
    pin.setAttribute("fill", colors.black);
    pin.setAttribute("stroke", "#fff");
    pin.setAttribute("stroke-width", "1");
    pin.setAttribute("stroke-linejoin", "round");
    pin.setAttribute("opacity", "0.85");
    pin.setAttribute(
      "transform",
      `translate(${px - 5 * pinScale},${py - 3.5 * pinScale}) scale(${pinScale})`,
    );

    rs.demandSvg.append(pin);
  }
}

export function showWarn(bp: BusinessPark): void {
  const rs = requireRenderState(bp);
  rs.pinSvg.style.opacity = String(1);
  rs.warnCircle.style.transition = "stroke-dashoffset .4s .8s";
  rs.pinSvg.style.transform = `translate(${rs.pinSvg.translate}) scale(1)`;
  rs.pinSvg.style.transition = `all .8s cubic-bezier(.5, 2, .5, 1)`;
  setTimeout(() => {
    rs.warnCircle.style.transition = "stroke-dashoffset .4s";
  }, 1000);
}

export function hideWarn(bp: BusinessPark): void {
  const rs = requireRenderState(bp);
  rs.pinSvg.style.opacity = String(0);
  rs.warnCircle.style.transition = `stroke-dashoffset .3s`;
  rs.pinSvg.style.transform = `translate(${rs.pinSvg.translate}) scale(0)`;
  rs.pinSvg.style.transition = `all .8s cubic-bezier(.5, 2, .5, 1) .4s`;
}

export function updateWarn(bp: BusinessPark): void {
  const rs = requireRenderState(bp);
  const fullCircle = 12.56; // Math.PI * 4
  const { demandPinCap, demandTimerMax } = getSpawningConfig();
  // Circle fills as timer depletes: full circle = timer at 0
  const timerFraction = bp.demandTimer / demandTimerMax;
  const warnFraction = 0.6; // warning shows at 60% timer
  const progress =
    bp.demand > demandPinCap
      ? 1 - timerFraction
      : (warnFraction - timerFraction) / warnFraction;
  const dashoffset =
    fullCircle - fullCircle * Math.min(1, Math.max(0, progress));

  rs.warnCircle.setAttribute("stroke-dashoffset", String(dashoffset));

  const prev = rs.prevProgress;
  const curr = Math.round(progress * 100);
  if (curr > prev) {
    rs.pinSvg.style.transform = `translate(${rs.pinSvg.translate}) scale(1.2)`;
    setTimeout(() => {
      rs.pinSvg.style.transform = `translate(${rs.pinSvg.translate}) scale(1)`;
    }, 200);
  }

  rs.prevProgress = curr;
}

// ─── Trending / Popular ──────────────────────────────────────────────────────

function showTrending(bp: BusinessPark): void {
  const rs = requireRenderState(bp);
  rs.trendingCircleBg.setAttribute("opacity", "0.2");
  rs.trendingCircle.setAttribute("opacity", "1");
  rs.trendingCircle.setAttribute("stroke-dashoffset", "0");
  // Show pin and pulse
  rs.pinSvg.style.transform = `translate(${rs.pinSvg.translate}) scale(1)`;
  rs.pinSvg.style.opacity = "1";
  rs.pinBubble.setAttribute("fill", "#efe");
}

function hideTrending(bp: BusinessPark): void {
  const rs = requireRenderState(bp);
  rs.trendingCircleBg.setAttribute("opacity", "0");
  rs.trendingCircle.setAttribute("opacity", "0");
  rs.trendingCircle.setAttribute("stroke-dashoffset", String(12.56));
  rs.pinBubble.setAttribute("fill", "#fff");
}

function updateTrending(bp: BusinessPark): void {
  const rs = requireRenderState(bp);
  const fullCircle = 12.56;
  const cfg = getSpawningConfig();
  // Circle drains as timer runs out: full = just started, empty = expired
  const remaining = bp.trendingTimer / cfg.trendingWindow;
  const dashoffset = fullCircle * (1 - remaining);
  rs.trendingCircle.setAttribute("stroke-dashoffset", String(dashoffset));
}

function showPopular(bp: BusinessPark): void {
  const rs = requireRenderState(bp);
  rs.pinBubble.setAttribute("fill", "#fff");
  // Star scales in
  rs.starSvg.setAttribute("transform", "translate(0 -6) scale(1)");
  // Celebration bounce on building
  rs.buildingSvg.style.transition = "transform .3s cubic-bezier(.5, 2, .5, 1)";
  const bx = parseFloat(
    /translate\((.+?)px/.exec(rs.buildingSvg.style.transform)?.[1] ?? "0",
  );
  const by = parseFloat(
    /,\s*(.+?)px/.exec(rs.buildingSvg.style.transform)?.[1] ?? "0",
  );
  rs.buildingSvg.style.transform = `translate(${bx}px,${by}px) scale(1.15)`;
  setTimeout(() => {
    rs.buildingSvg.style.transform = `translate(${bx}px,${by}px) scale(1)`;
  }, 300);
  setTimeout(() => {
    rs.buildingSvg.style.transition = "";
  }, 600);
}
