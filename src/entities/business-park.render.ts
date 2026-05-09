import { playAppearChime } from "../audio";
import { colors } from "../gfx/colors";
import { gridLineThickness } from "../gfx/grid";
import {
  borderLayer,
  gridBlockLayer,
  houseLayer,
  houseShadowLayer,
  pinLayer,
} from "../gfx/layers";
import { createSvgElement, toSvgEdge } from "../gfx/svg-utils";
import { getSpawningConfig } from "../logic/spawning";
import type { Pixel } from "../types";
import type { BusinessPark } from "./business-park";

/** SVG elements owned exclusively by this render module */
export interface BusinessParkRenderState {
  pinSvg: SVGGElement & { translate?: string };
  pinBubble: SVGPathElement;
  warnCircleBg: SVGCircleElement;
  warnCircle: SVGCircleElement;
  demandSvg: SVGGElement;
  buildingSvg: SVGGElement;
  parkingLotSvg?: SVGGElement;
  parkOriginX: number;
  parkOriginY: number;
  parkLotW: number;
  parkLotH: number;
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
}

const roundness = 2;
const borderLineThickness = 1;

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
}

export function scheduleSpawnAnimation(bp: BusinessPark, delay: number): void {
  setTimeout(() => addBusinessParkToSvg(bp), delay);
}

function addBusinessParkToSvg(bp: BusinessPark): void {
  playAppearChime();
  const layout = computeLayout(bp);
  const rs = initRenderState(bp, layout);

  addGrassBackground(layout);
  addBuildingShadow(layout);
  addBuilding(bp, rs, layout);
  const bays = drawParkingLot(bp);
  bp.bayCenters = bays.bayCenters;
  bp.bayLanePoints = bays.bayLanePoints;
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

  const isVert = bp.entryEdge === 1 || bp.entryEdge === 3;
  const buildingCells = isVert ? bp.width - 1 : bp.height - 1;
  const buildingSize =
    toSvgEdge(buildingCells) - borderLineThickness / 2 - gridLineThickness / 2;
  const parkingSize =
    toSvgEdge(1) - borderLineThickness / 2 - gridLineThickness / 2;

  let bx: number, by: number, bw: number, bh: number;
  let px: number, py: number, pw: number, ph: number;

  if (isVert) {
    bh = svgHeight;
    ph = svgHeight;
    bw = buildingSize;
    pw = parkingSize;
    if (bp.entryEdge === 3) {
      px = x;
      py = y;
      bx = x + parkingSize;
      by = y;
    } else {
      bx = x;
      by = y;
      px = x + buildingSize;
      py = y;
    }
  } else {
    bw = svgWidth;
    pw = svgWidth;
    bh = buildingSize;
    ph = parkingSize;
    if (bp.entryEdge === 0) {
      px = x;
      py = y;
      bx = x;
      by = y + parkingSize;
    } else {
      bx = x;
      by = y;
      px = x;
      py = y + buildingSize;
    }
  }

  return { x, y, svgWidth, svgHeight, bx, by, bw, bh, px, py, pw, ph };
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
  rs.buildingW = l.bw;
  rs.buildingH = l.bh;
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
  const shadow = createSvgElement("rect");
  shadow.setAttribute("width", String(l.bw));
  shadow.setAttribute("height", String(l.bh));
  shadow.setAttribute("rx", String(roundness));
  shadow.setAttribute("fill", colors.black);
  shadow.setAttribute("stroke", "none");
  shadow.style.transform = `translate(${l.bx}px,${l.by}px)`;
  shadow.style.opacity = "0";
  shadow.style.willChange = "opacity, transform";
  shadow.style.transition = "opacity .4s, transform .6s";
  houseShadowLayer.append(shadow);
  setTimeout(() => {
    shadow.style.opacity = "1";
    shadow.style.transform = `translate(${l.bx + 0.8}px,${l.by + 0.8}px)`;
  }, 800);
  setTimeout(() => (shadow.style.willChange = ""), 1500);
}

function addBuilding(
  bp: BusinessPark,
  rs: BusinessParkRenderState,
  l: ParkLayout,
): void {
  rs.buildingSvg = createSvgElement("g");
  rs.buildingSvg.style.transform = `translate(${l.bx}px,${l.by}px)`;
  houseLayer.append(rs.buildingSvg);

  if (bp.types.length > 1) {
    addSplitRoof(rs.buildingSvg, bp.types, l);
  } else {
    const roof = createSvgElement("rect");
    roof.setAttribute("width", String(l.bw));
    roof.setAttribute("height", String(l.bh));
    roof.setAttribute("rx", String(roundness));
    roof.setAttribute("fill", bp.borderColor);
    rs.buildingSvg.append(roof);
  }
}

function addSplitRoof(
  parent: SVGGElement,
  types: string[],
  l: ParkLayout,
): void {
  const defs = createSvgElement("defs");
  const clipA = createSvgElement("clipPath");
  clipA.id = `rc-a-${l.bx | 0}-${l.by | 0}`;
  const polyA = createSvgElement("polygon");
  polyA.setAttribute("points", `0,0 ${l.bw},0 0,${l.bh}`);
  clipA.append(polyA);
  const clipB = createSvgElement("clipPath");
  clipB.id = `rc-b-${l.bx | 0}-${l.by | 0}`;
  const polyB = createSvgElement("polygon");
  polyB.setAttribute("points", `${l.bw},0 ${l.bw},${l.bh} 0,${l.bh}`);
  clipB.append(polyB);
  defs.append(clipA, clipB);
  parent.append(defs);

  for (const [color, clip] of [
    [types[0]!, clipA],
    [types[1]!, clipB],
  ] as const) {
    const rect = createSvgElement("rect");
    rect.setAttribute("width", String(l.bw));
    rect.setAttribute("height", String(l.bh));
    rect.setAttribute("rx", String(roundness));
    rect.setAttribute("fill", color);
    rect.setAttribute("clip-path", `url(#${clip.id})`);
    parent.append(rect);
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
  rs.demandSvg.style.transform = `translate(${l.bx + l.bw / 2}px, ${l.by + l.bh / 2}px)`;
  pinLayer.append(rs.demandSvg);
}

export function drawParkingLot(bp: BusinessPark): BayGeometry {
  const { rs } = bp;
  const inset = 0.8;
  const lotW = rs.parkLotW - inset * 2;
  const lotH = rs.parkLotH - inset * 2;

  // Remove old lot if rebuilding
  if (rs.parkingLotSvg) rs.parkingLotSvg.remove();

  rs.parkingLotSvg = createSvgElement("g");
  rs.parkingLotSvg.style.transform = `translate(${rs.parkOriginX + inset}px, ${rs.parkOriginY + inset}px)`;
  gridBlockLayer.append(rs.parkingLotSvg);

  // Asphalt pad
  const asphalt = createSvgElement("rect");
  asphalt.setAttribute("width", String(lotW));
  asphalt.setAttribute("height", String(lotH));
  asphalt.setAttribute("rx", "0.8");
  asphalt.setAttribute("fill", colors.road);
  rs.parkingLotSvg.append(asphalt);

  // Car-proportioned bay markings (car = 1.4×2.2)
  const lc = "#fff8";
  const lw = 0.25;
  const bayCount = bp.parkingCapacity;
  const bayW = 2.0; // slightly wider than car
  const bayD = 3.0; // slightly deeper than car length
  const isWide = lotW > lotH;

  // Axis-neutral layout: main = along bays, cross = depth into lot
  const mainSize = isWide ? lotW : lotH;
  const crossSize = isWide ? lotH : lotW;
  const clusterMain = bayW * bayCount;
  const startMain = (mainSize - clusterMain) / 2;
  const backCross = bp.entryEdge === 0 || bp.entryEdge === 3 ? crossSize : 0;
  const dir = bp.entryEdge === 0 || bp.entryEdge === 3 ? -1 : 1;

  const toXY = (main: number, cross: number): [number, number] =>
    isWide ? [main, cross] : [cross, main];

  // Back wall spanning bay cluster
  const [wx1, wy1] = toXY(startMain, backCross);
  const [wx2, wy2] = toXY(startMain + clusterMain, backCross);
  const wall = createSvgElement("line");
  wall.setAttribute("x1", String(wx1));
  wall.setAttribute("y1", String(wy1));
  wall.setAttribute("x2", String(wx2));
  wall.setAttribute("y2", String(wy2));
  wall.setAttribute("stroke", lc);
  wall.setAttribute("stroke-width", String(lw));
  rs.parkingLotSvg.append(wall);

  // Divider lines from back wall into driving lane
  for (let i = 0; i <= bayCount; i++) {
    const m = startMain + bayW * i;
    const [lx1, ly1] = toXY(m, backCross);
    const [lx2, ly2] = toXY(m, backCross + bayD * dir);
    const line = createSvgElement("line");
    line.setAttribute("x1", String(lx1));
    line.setAttribute("y1", String(ly1));
    line.setAttribute("x2", String(lx2));
    line.setAttribute("y2", String(ly2));
    line.setAttribute("stroke", lc);
    line.setAttribute("stroke-width", String(lw));
    rs.parkingLotSvg.append(line);
  }

  // Compute bay centers and lane waypoints in SVG-global coords
  const gx = rs.parkOriginX + inset;
  const gy = rs.parkOriginY + inset;
  const laneCross =
    bp.entryEdge === 0 || bp.entryEdge === 3
      ? (crossSize - bayD) / 2
      : bayD + (crossSize - bayD) / 2;
  const bayCenters: Pixel[] = [];
  const bayLanePoints: Pixel[] = [];
  for (let i = 0; i < bayCount; i++) {
    const m = startMain + bayW * i + bayW / 2;
    const [cx, cy] = toXY(m, backCross + (bayD / 2) * dir);
    const [lx, ly] = toXY(m, laneCross);
    bayCenters.push({ x: gx + cx, y: gy + cy } as Pixel);
    bayLanePoints.push({ x: gx + lx, y: gy + ly } as Pixel);
  }
  return { bayCenters, bayLanePoints };
}

export function updateDemandDisplay(bp: BusinessPark): void {
  const { rs } = bp;

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
  const { rs } = bp;
  rs.pinSvg.style.opacity = String(1);
  rs.warnCircle.style.transition = "stroke-dashoffset .4s .8s";
  rs.pinSvg.style.transform = `translate(${rs.pinSvg.translate}) scale(1)`;
  rs.pinSvg.style.transition = `all .8s cubic-bezier(.5, 2, .5, 1)`;
  setTimeout(() => {
    rs.warnCircle.style.transition = "stroke-dashoffset .4s";
  }, 1000);
}

export function hideWarn(bp: BusinessPark): void {
  const { rs } = bp;
  rs.pinSvg.style.opacity = String(0);
  rs.warnCircle.style.transition = `stroke-dashoffset .3s`;
  rs.pinSvg.style.transform = `translate(${rs.pinSvg.translate}) scale(0)`;
  rs.pinSvg.style.transition = `all .8s cubic-bezier(.5, 2, .5, 1) .4s`;
}

export function updateWarn(bp: BusinessPark): void {
  const { rs } = bp;
  const fullCircle = 12.56; // Math.PI * 4
  const { demandTimerMax } = getSpawningConfig();
  // Circle fills as timer depletes: full circle = timer at 0
  const timerFraction = bp.demandTimer / demandTimerMax;
  const warnFraction = 0.6; // warning shows at 60% timer
  const progress = (warnFraction - timerFraction) / warnFraction;
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
  const { rs } = bp;
  rs.trendingCircleBg.setAttribute("opacity", "0.2");
  rs.trendingCircle.setAttribute("opacity", "1");
  rs.trendingCircle.setAttribute("stroke-dashoffset", "0");
  // Show pin and pulse
  rs.pinSvg.style.transform = `translate(${rs.pinSvg.translate}) scale(1)`;
  rs.pinSvg.style.opacity = "1";
  rs.pinBubble.setAttribute("fill", "#efe");
}

function hideTrending(bp: BusinessPark): void {
  const { rs } = bp;
  rs.trendingCircleBg.setAttribute("opacity", "0");
  rs.trendingCircle.setAttribute("opacity", "0");
  rs.trendingCircle.setAttribute("stroke-dashoffset", String(12.56));
  rs.pinBubble.setAttribute("fill", "#fff");
}

function updateTrending(bp: BusinessPark): void {
  const { rs } = bp;
  const fullCircle = 12.56;
  const cfg = getSpawningConfig();
  // Circle drains as timer runs out: full = just started, empty = expired
  const remaining = bp.trendingTimer / cfg.trendingWindow;
  const dashoffset = fullCircle * (1 - remaining);
  rs.trendingCircle.setAttribute("stroke-dashoffset", String(dashoffset));
}

function showPopular(bp: BusinessPark): void {
  const { rs } = bp;
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
