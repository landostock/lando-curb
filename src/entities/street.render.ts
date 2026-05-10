import { colors } from "../gfx/colors";
import {
  activeStreetLayer,
  motorwayDashLayer,
  motorwayEdgeLayer,
  pendingStreetLayer,
  streetLayer,
  streetShadowLayer,
} from "../gfx/layers";
import {
  createSvgElement,
  svgLineTo,
  svgMoveTo,
  svgQuadTo,
} from "../gfx/svg-utils";
import { streets } from "../state";
import type { Cell, Point } from "../types";
import { samePoint } from "../util/geometry";
import type { Street } from "./street";

interface Connection {
  path1: Street;
  path2: Street;
  points: [outer1: Cell, shared: Cell, outer2: Cell];
}

interface StreetData {
  key?: string;
  path?: Street;
  path1?: Street;
  path2?: Street;
  d: string;
  svgElement?: SVGElement;
  svgElementShadow?: SVGElement;
  svgDash?: SVGElement;
}

interface MotorwayDashData {
  key: string;
  d: string;
  svgElement?: SVGPathElement;
}

interface MotorwayChain {
  cells: Cell[];
  startStreet: Street;
  endStreet: Street;
  startDegree: number;
  endDegree: number;
}

interface MotorwayTerminalCurve {
  mid: Point;
  control: Point;
  edge: Point;
}

let connections: Connection[] = [];
let streetsData: StreetData[] = [];
let motorwayData: StreetData[] = [];
let motorwayDashData: MotorwayDashData[] = [];
let recentlyRemoved: Cell[] = [];

const midpoint = (a: Point, b: Point): Point => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

const isPending = (sd: StreetData): boolean =>
  !!sd.path?.pendingRemoval ||
  !!sd.path1?.pendingRemoval ||
  !!sd.path2?.pendingRemoval;

const isBridgeData = (sd: StreetData): boolean =>
  !!sd.path?.bridge || !!sd.path1?.bridge || !!sd.path2?.bridge;

const isBridge = (street: { bridge?: boolean }): boolean =>
  street.bridge === true;

const MOTORWAY_DASH_WIDTH = 0.6;
const MOTORWAY_DASH_TARGET = 4.45;
const MOTORWAY_DASH_MAX = 2.15;
const MOTORWAY_DASH_MIN = 1.15;
const MOTORWAY_DASH_MIN_GAP = 0.9;
const MOTORWAY_DASH_SAMPLE_STEP = 0.45;
const MOTORWAY_DASH_END_TRIM = 0.35;
const MOTORWAY_DASH_JUNCTION_TRIM = 1.15;
const MOTORWAY_DASH_EDGE_PAD = 0.24;

const applyStreetStyle = (
  el: SVGElement,
  _shadowEl: SVGElement | undefined,
  _motorway: boolean,
  bridge: boolean,
): void => {
  el.removeAttribute("stroke-width");
  el.setAttribute("stroke", bridge ? colors.bridge : colors.road);
};

const buildConnections = (paths: Street[]): Connection[] => {
  const nextConnections: Connection[] = [];

  paths.forEach((path1) => {
    paths.forEach((path2) => {
      if (path1 === path2) return;
      if (nextConnections.some((c) => c.path1 === path2 && c.path2 === path1))
        return;
      if (path1.noConnect || path2.noConnect) return;
      if (isBridge(path1) !== isBridge(path2)) return;

      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
          if (samePoint(path1.points[i]!, path2.points[j]!)) {
            nextConnections.push({
              path1,
              path2,
              points: [
                path1.points[1 - i]!,
                path1.points[i]!,
                path2.points[1 - j]!,
              ],
            });
          }
        }
      }
    });
  });

  return nextConnections;
};

const buildStreetData = (
  paths: Street[],
  pathConnections: Connection[],
): StreetData[] => {
  const newStreetsData: StreetData[] = [];

  pathConnections.forEach(({ path1, path2, points }) => {
    const [outer1, shared, outer2] = points;

    const mid = midpoint(outer1, shared);
    const curveEnd = midpoint(shared, outer2);

    const moveToStart = svgMoveTo(outer1);
    const lineToMid = svgLineTo(mid);
    const lineToEnd = svgLineTo(outer2);
    const curve = svgQuadTo(shared, curveEnd);

    const isOuter1Junction = pathConnections.some((c) =>
      samePoint(outer1, c.points[1]),
    );
    const isOuter2Junction = pathConnections.some((c) =>
      samePoint(outer2, c.points[1]),
    );

    const start = isOuter1Junction
      ? svgMoveTo(mid)
      : `${moveToStart}${lineToMid}`;
    const end = isOuter2Junction ? "" : lineToEnd;

    newStreetsData.push({ path1, path2, d: `${start}${curve}${end}` });
  });

  paths.forEach((path) => {
    const connected = pathConnections.some(
      (c) => c.path1 === path || c.path2 === path,
    );

    if (!connected && !path.noConnect) {
      const [p0, p1] = path.points;
      newStreetsData.push({
        path,
        d: `${svgMoveTo(p0)}${svgLineTo(p1)}`,
      });
    }
  });

  return newStreetsData;
};

const pointKey = (p: Point): string => `${p.x},${p.y}`;

const streetKey = (street: Street): string => {
  const [a, b] = street.points.map(pointKey).sort();
  return `${a}-${b}`;
};

const connectionKey = (a: Street, b: Street): string =>
  [streetKey(a), streetKey(b)].sort().join("|");

const otherPoint = (street: Street, endpoint: Cell): Cell =>
  samePoint(street.points[0], endpoint) ? street.points[1] : street.points[0];

const connectedStreetsAt = (
  street: Street,
  endpoint: Cell,
  paths: Street[],
): Street[] =>
  paths.filter(
    (candidate) =>
      candidate !== street &&
      !candidate.noConnect &&
      isBridge(candidate) === isBridge(street) &&
      candidate.points.some((p) => samePoint(p, endpoint)),
  );

const chooseCurveNeighbor = (
  street: Street,
  endpoint: Cell,
  paths: Street[],
): Street | undefined => {
  const candidates = connectedStreetsAt(street, endpoint, paths);
  if (!candidates.length) return undefined;

  const current = otherPoint(street, endpoint);
  const currentDx = current.x - endpoint.x;
  const currentDy = current.y - endpoint.y;
  const scored = candidates.map((candidate) => {
    const candidatePoint = otherPoint(candidate, endpoint);
    const dx = candidatePoint.x - endpoint.x;
    const dy = candidatePoint.y - endpoint.y;
    return {
      candidate,
      score: currentDx * dx + currentDy * dy - (candidate.motorway ? 2 : 0),
    };
  });
  scored.sort((a, b) => a.score - b.score);
  return scored[0]?.candidate;
};

const lerpPoint = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

const quadMidSplit = (
  start: Point,
  control: Point,
  end: Point,
): { mid: Point; leftControl: Point; rightControl: Point } => {
  const leftControl = lerpPoint(start, control, 0.5);
  const rightControl = lerpPoint(control, end, 0.5);
  return {
    mid: lerpPoint(leftControl, rightControl, 0.5),
    leftControl,
    rightControl,
  };
};

const baseConnectionPath = (
  points: [outer1: Cell, shared: Cell, outer2: Cell],
  pathConnections: Connection[],
): string => {
  const [outer1, shared, outer2] = points;
  const mid = midpoint(outer1, shared);
  const curveEnd = midpoint(shared, outer2);
  const isOuter1Junction = pathConnections.some((c) =>
    samePoint(outer1, c.points[1]),
  );
  const isOuter2Junction = pathConnections.some((c) =>
    samePoint(outer2, c.points[1]),
  );

  const start = isOuter1Junction
    ? svgMoveTo(mid)
    : `${svgMoveTo(outer1)}${svgLineTo(mid)}`;
  const end = isOuter2Junction ? "" : svgLineTo(outer2);
  return `${start}${svgQuadTo(shared, curveEnd)}${end}`;
};

const motorwayHalfConnectionPath = (
  connection: Connection,
  pathConnections: Connection[],
  side: "path1" | "path2",
): string => {
  const [outer1, shared, outer2] = connection.points;
  const mid = midpoint(outer1, shared);
  const curveEnd = midpoint(shared, outer2);
  const split = quadMidSplit(mid, shared, curveEnd);

  if (side === "path1") {
    const isOuter1Junction = pathConnections.some((c) =>
      samePoint(outer1, c.points[1]),
    );
    const start = isOuter1Junction
      ? svgMoveTo(mid)
      : `${svgMoveTo(outer1)}${svgLineTo(mid)}`;
    return `${start}${svgQuadTo(split.leftControl, split.mid)}`;
  }

  const isOuter2Junction = pathConnections.some((c) =>
    samePoint(outer2, c.points[1]),
  );
  const end = isOuter2Junction ? "" : svgLineTo(outer2);
  return `${svgMoveTo(split.mid)}${svgQuadTo(split.rightControl, curveEnd)}${end}`;
};

const selectedHalfMotorwayConnection = (
  connection: Connection,
  paths: Street[],
): { street: Street; side: "path1" | "path2" } | undefined => {
  const { path1, path2, points } = connection;
  const path1Motorway = path1.motorway && !path1.bridge;
  const path2Motorway = path2.motorway && !path2.bridge;
  if (path1Motorway === path2Motorway) return undefined;

  const street = path1Motorway ? path1 : path2;
  const neighbor = path1Motorway ? path2 : path1;
  const [, shared] = points;
  if (chooseCurveNeighbor(street, shared, paths) !== neighbor)
    return undefined;

  return { street, side: path1Motorway ? "path1" : "path2" };
};

const buildMotorwayData = (paths: Street[]): StreetData[] => {
  const pathConnections = buildConnections(paths);
  const data: StreetData[] = [];

  pathConnections.forEach((connection) => {
    const { path1, path2, points } = connection;
    const path1Motorway = path1.motorway && !path1.bridge;
    const path2Motorway = path2.motorway && !path2.bridge;
    if (!path1Motorway && !path2Motorway) return;

    if (path1Motorway && path2Motorway) {
      data.push({
        key: `motorway:${connectionKey(path1, path2)}`,
        path1,
        path2,
        d: baseConnectionPath(points, pathConnections),
      });
      return;
    }

    const half = selectedHalfMotorwayConnection(connection, paths);
    if (!half) return;

    data.push({
      key: `motorway:${connectionKey(path1, path2)}:${half.side}`,
      path: half.street,
      d: motorwayHalfConnectionPath(connection, pathConnections, half.side),
    });
  });

  paths.forEach((street) => {
    if (!street.motorway || street.bridge) return;
    const hasMotorwayData = data.some(
      (entry) =>
        entry.path === street ||
        entry.path1 === street ||
        entry.path2 === street,
    );
    if (hasMotorwayData) return;

    const [p0, p1] = street.points;
    data.push({
      key: `motorway:${streetKey(street)}`,
      path: street,
      d: `${svgMoveTo(p0)}${svgLineTo(p1)}`,
    });
  });

  return data;
};

const dashRangesForInterval = (
  from: number,
  to: number,
): Array<[number, number]> => {
  const length = to - from;
  if (length < MOTORWAY_DASH_MIN * 1.25) return [];

  let count = Math.max(1, Math.round(length / MOTORWAY_DASH_TARGET));
  let dashLength = MOTORWAY_DASH_MIN;
  while (
    count > 1 &&
    length - count * dashLength - MOTORWAY_DASH_EDGE_PAD * 2 <
      MOTORWAY_DASH_MIN_GAP * (count - 1)
  ) {
    count--;
  }

  dashLength = Math.max(
    MOTORWAY_DASH_MIN,
    Math.min(MOTORWAY_DASH_MAX, length / (count * 1.85)),
  );

  if (count === 1) {
    dashLength = Math.min(MOTORWAY_DASH_MAX, length * 0.58);
    const center = from + length / 2;
    return [[center - dashLength / 2, center + dashLength / 2]];
  }

  const edgePad = Math.min(
    MOTORWAY_DASH_EDGE_PAD,
    Math.max(0, (length - count * dashLength) / 2),
  );
  const gap = Math.max(
    MOTORWAY_DASH_MIN_GAP,
    (length - count * dashLength - edgePad * 2) / (count - 1),
  );
  const ranges: Array<[number, number]> = [];
  for (let i = 0; i < count; i++) {
    const start = from + edgePad + i * (dashLength + gap);
    ranges.push([start, start + dashLength]);
  }
  return ranges;
};

const dashPathData = (
  path: SVGPathElement,
  from: number,
  to: number,
): string => {
  const length = to - from;
  const steps = Math.max(1, Math.ceil(length / MOTORWAY_DASH_SAMPLE_STEP));
  const points: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const point = path.getPointAtLength(from + (length * i) / steps);
    points.push({ x: point.x, y: point.y });
  }
  return points
    .map((point, i) =>
      i === 0 ? `M${point.x} ${point.y}` : `L${point.x} ${point.y}`,
    )
    .join("");
};

const keyForPoint = (point: Point): string => `${point.x},${point.y}`;

const motorwayStreetsForDashes = (): Street[] =>
  streets.filter(
    (street) => street.motorway && !street.bridge && !street.pendingRemoval,
  );

const motorwayAdjacency = (
  motorwayStreets: Street[],
): Map<string, Street[]> => {
  const adjacency = new Map<string, Street[]>();
  motorwayStreets.forEach((street) => {
    street.points.forEach((point) => {
      const key = keyForPoint(point);
      const bucket = adjacency.get(key);
      if (bucket) bucket.push(street);
      else adjacency.set(key, [street]);
    });
  });
  return adjacency;
};

const degreeAt = (adjacency: Map<string, Street[]>, point: Point): number =>
  adjacency.get(keyForPoint(point))?.length ?? 0;

const buildMotorwayChain = (
  start: Cell,
  firstStreet: Street,
  adjacency: Map<string, Street[]>,
  visited: Set<string>,
): MotorwayChain => {
  const chain: Cell[] = [start];
  let currentPoint = start;
  let currentStreet = firstStreet;
  let lastStreet = firstStreet;

  for (;;) {
    visited.add(streetKey(currentStreet));
    lastStreet = currentStreet;
    currentPoint = otherPoint(currentStreet, currentPoint);
    chain.push(currentPoint);

    const options = adjacency
      .get(keyForPoint(currentPoint))!
      .filter((street) => street !== currentStreet);
    if (options.length !== 1) break;

    const nextStreet = options[0]!;
    if (visited.has(streetKey(nextStreet))) break;
    currentStreet = nextStreet;
  }

  return {
    cells: chain,
    startStreet: firstStreet,
    endStreet: lastStreet,
    startDegree: degreeAt(adjacency, chain[0]!),
    endDegree: degreeAt(adjacency, chain[chain.length - 1]!),
  };
};

const buildMotorwayChains = (): MotorwayChain[] => {
  const motorwayStreets = motorwayStreetsForDashes();
  const adjacency = motorwayAdjacency(motorwayStreets);
  const visited = new Set<string>();
  const chains: MotorwayChain[] = [];

  adjacency.forEach((connected, key) => {
    if (connected.length === 2) return;
    const [x, y] = key.split(",").map(Number);
    const start = { x, y } as Cell;
    connected.forEach((street) => {
      if (!visited.has(streetKey(street)))
        chains.push(buildMotorwayChain(start, street, adjacency, visited));
    });
  });

  motorwayStreets.forEach((street) => {
    if (!visited.has(streetKey(street)))
      chains.push(buildMotorwayChain(street.points[0], street, adjacency, visited));
  });

  return chains;
};

const dashTrimForChainEnd = (degree: number): number =>
  degree > 2 ? MOTORWAY_DASH_JUNCTION_TRIM : MOTORWAY_DASH_END_TRIM;

const terminalCurveForDash = (
  street: Street,
  endpoint: Cell,
  degree: number,
): MotorwayTerminalCurve | undefined => {
  if (degree !== 1) return undefined;

  const neighbor = chooseCurveNeighbor(street, endpoint, streets);
  if (!neighbor || neighbor.motorway || neighbor.bridge) return undefined;

  const motorwayMid = midpoint(otherPoint(street, endpoint), endpoint);
  const neighborMid = midpoint(endpoint, otherPoint(neighbor, endpoint));
  const split = quadMidSplit(motorwayMid, endpoint, neighborMid);
  return {
    mid: motorwayMid,
    control: split.leftControl,
    edge: split.mid,
  };
};

const chainPathData = (chain: MotorwayChain): string => {
  const { cells } = chain;
  if (cells.length < 2) return "";

  const startCurve = terminalCurveForDash(
    chain.startStreet,
    cells[0]!,
    chain.startDegree,
  );
  const endCurve = terminalCurveForDash(
    chain.endStreet,
    cells[cells.length - 1]!,
    chain.endDegree,
  );

  if (cells.length === 2) {
    const mid = midpoint(cells[0]!, cells[1]!);
    if (startCurve && endCurve)
      return `${svgMoveTo(startCurve.edge)}${svgQuadTo(
        startCurve.control,
        mid,
      )}${svgQuadTo(endCurve.control, endCurve.edge)}`;
    if (startCurve)
      return `${svgMoveTo(startCurve.edge)}${svgQuadTo(
        startCurve.control,
        mid,
      )}${svgLineTo(cells[1]!)}`;
    if (endCurve)
      return `${svgMoveTo(cells[0]!)}${svgLineTo(mid)}${svgQuadTo(
        endCurve.control,
        endCurve.edge,
      )}`;
    return `${svgMoveTo(cells[0]!)}${svgLineTo(cells[1]!)}`;
  }

  const firstMid = midpoint(cells[0]!, cells[1]!);
  let d = startCurve
    ? `${svgMoveTo(startCurve.edge)}${svgQuadTo(startCurve.control, firstMid)}`
    : `${svgMoveTo(cells[0]!)}${svgLineTo(firstMid)}`;

  for (let i = 1; i < cells.length - 1; i++) {
    d += svgQuadTo(cells[i]!, midpoint(cells[i]!, cells[i + 1]!));
  }
  d += endCurve
    ? svgQuadTo(endCurve.control, endCurve.edge)
    : svgLineTo(cells[cells.length - 1]!);
  return d;
};

const dashSegmentsForPath = (
  path: SVGPathElement,
  startTrim: number,
  endTrim: number,
): string[] => {
  const length = path.getTotalLength();
  if (length < MOTORWAY_DASH_MIN * 1.5) return [];

  return dashRangesForInterval(
    startTrim,
    Math.max(startTrim, length - endTrim),
  ).map(([from, to]) => dashPathData(path, from, to));
};

const drawMotorwayDashes = (): void => {
  const nextDashData: MotorwayDashData[] = [];

  buildMotorwayChains().forEach((chain) => {
    const d = chainPathData(chain);
    if (!d) return;

    const path = createSvgElement("path");
    path.setAttribute("d", d);
    const closed = samePoint(chain.cells[0]!, chain.cells[chain.cells.length - 1]!);
    const startTrim = closed ? 0 : dashTrimForChainEnd(chain.startDegree);
    const endTrim = closed ? 0 : dashTrimForChainEnd(chain.endDegree);
    const chainKey = chain.cells.map(keyForPoint).join("|");
    dashSegmentsForPath(path, startTrim, endTrim).forEach((dashD, index) => {
      nextDashData.push({ key: `${chainKey}:${index}`, d: dashD });
    });
  });

  const oldDashMap = new Map(
    motorwayDashData.map((dash) => [dash.key, dash] as const),
  );
  nextDashData.forEach((nextData) => {
    const oldData = oldDashMap.get(nextData.key);
    if (!oldData?.svgElement?.isConnected) return;

    nextData.svgElement = oldData.svgElement;
    if (nextData.d !== oldData.d) {
      nextData.svgElement.setAttribute("d", nextData.d);
    }
  });

  const nextKeys = new Set(nextDashData.map((dash) => dash.key));
  motorwayDashData.forEach((oldData) => {
    if (!nextKeys.has(oldData.key)) oldData.svgElement?.remove();
  });

  nextDashData.forEach((dashData) => {
    if (dashData.svgElement) return;

    const dash = createSvgElement("path");
    dash.setAttribute("d", dashData.d);
    dash.setAttribute("fill", "none");
    dash.setAttribute("stroke", colors.motorwayDash);
    dash.setAttribute("stroke-linecap", "round");
    dash.setAttribute("stroke-linejoin", "round");
    dash.setAttribute("stroke-width", String(MOTORWAY_DASH_WIDTH));
    motorwayDashLayer.append(dash);
    dashData.svgElement = dash;
  });

  motorwayDashData = nextDashData;
};

const drawMotorwayOverlays = (): void => {
  const nextMotorwayData = buildMotorwayData(streets);

  nextMotorwayData.forEach((nextData) => {
    const oldData = motorwayData.find((data) => data.key === nextData.key);
    if (!oldData?.svgElement?.isConnected) return;

    nextData.svgElement = oldData.svgElement;
    if (nextData.d !== oldData.d) {
      nextData.svgElement.setAttribute("d", nextData.d);
    }
  });

  motorwayData.forEach((oldData) => {
    if (nextMotorwayData.some((data) => data.key === oldData.key)) return;
    oldData.svgElement?.remove();
  });

  nextMotorwayData.forEach((sd) => {
    const pending = isPending(sd);
    const opac = String(pending ? 0 : 1);
    if (!sd.svgElement) {
      const line = createSvgElement("path");
      line.setAttribute("d", sd.d);
      line.setAttribute("stroke", colors.motorway);
      line.setAttribute("stroke-width", "3.14");
      line.style.transition = "all .25s, opacity .2s";
      motorwayEdgeLayer.append(line);
      sd.svgElement = line;
    }
    sd.svgElement.setAttribute("opacity", opac);
  });

  motorwayData = nextMotorwayData;
  drawMotorwayDashes();
};

const drawPendingOverlay = (): void => {
  pendingStreetLayer.innerHTML = "";

  const pendingStreets = streets.filter((s) => s.pendingRemoval);
  if (!pendingStreets.length) return;

  const pendingData = buildStreetData(
    pendingStreets,
    buildConnections(pendingStreets),
  );

  const ghostGroup = createSvgElement("g");
  ghostGroup.setAttribute("stroke", colors.road);
  ghostGroup.setAttribute("stroke-width", String(3.14));
  ghostGroup.setAttribute("opacity", String(1));

  pendingData.forEach((sd) => {
    const ghost = createSvgElement("path");
    ghost.setAttribute("d", sd.d);
    ghostGroup.append(ghost);
  });

  pendingStreetLayer.append(ghostGroup);
};

const drawActiveStreetOverlay = (): void => {
  activeStreetLayer.innerHTML = "";

  if (!streets.some((s) => s.pendingRemoval)) return;

  const activeStreets = streets.filter((s) => !s.pendingRemoval);
  const activeData = buildStreetData(
    activeStreets,
    buildConnections(activeStreets),
  );

  activeData.forEach((sd) => {
    const path = createSvgElement("path");
    path.setAttribute("d", sd.d);
    path.setAttribute("stroke", isBridgeData(sd) ? colors.bridge : colors.road);
    activeStreetLayer.append(path);
  });
};

export const drawStreets = ({
  fadeout,
  noShadow,
}: { fadeout?: boolean; noShadow?: boolean } = {}) => {
  connections = buildConnections(streets);
  const newStreetsData = buildStreetData(streets, connections);

  // Pass 1: Reconcile existing SVG elements with new data
  newStreetsData.forEach((newStreetData) => {
    streetsData.forEach((oldStreetData) => {
      const samePath =
        newStreetData.path && newStreetData.path === oldStreetData.path;
      const samePath1 =
        newStreetData.path1 && newStreetData.path1 === oldStreetData.path1;
      const samePath2 =
        newStreetData.path2 && newStreetData.path2 === oldStreetData.path2;
      if (samePath || (samePath1 && samePath2)) {
        newStreetData.svgElement = oldStreetData.svgElement;
        newStreetData.svgElementShadow = oldStreetData.svgElementShadow;
        newStreetData.svgDash = oldStreetData.svgDash;
        if (newStreetData.d !== oldStreetData.d) {
          oldStreetData.d = newStreetData.d;
          newStreetData.svgElement!.setAttribute("d", newStreetData.d);
        }

        const pending = isPending(newStreetData);
        const opac = String(pending ? 0 : 1);
        newStreetData.svgElement!.setAttribute("opacity", opac);

        const bridge = isBridgeData(newStreetData);
        applyStreetStyle(
          newStreetData.svgElement!,
          newStreetData.svgElementShadow,
          false,
          bridge,
        );
      }
    });
  });

  // Pass 2: Remove old path SVGs no longer present in the new data
  streetsData.forEach((oldStreetData) => {
    if (!newStreetsData.some((s) => oldStreetData.d === s.d)) {
      if (oldStreetData.path) {
        const oldPath = oldStreetData.path;
        if (fadeout && oldPath.points[0].locked) {
          setTimeout(() => {
            oldStreetData.svgElement!.remove();
            oldStreetData.svgDash?.remove();
          }, 500);
        } else {
          oldStreetData.svgElement!.remove();
          oldStreetData.svgDash?.remove();
        }
      }
    }
  });

  // Pass 3: Create SVGs for new data entries
  newStreetsData.forEach((newStreetData) => {
    if (!newStreetData.svgElement) {
      newStreetData.svgElement = createSvgElement("path");
      newStreetData.svgElement.setAttribute("d", newStreetData.d);
      newStreetData.svgElement.style.transition = `all .4s, opacity .2s`;

      streetLayer.append(newStreetData.svgElement);

      applyStreetStyle(
        newStreetData.svgElement,
        newStreetData.svgElementShadow,
        false,
        isBridgeData(newStreetData),
      );

      // Only transition "new new" single paths
      const pathPoints = newStreetData.path?.points;
      const pathInSameCellRecentlyRemoved =
        pathPoints &&
        recentlyRemoved.some(
          (r) => samePoint(r, pathPoints[0]) || samePoint(r, pathPoints[1]),
        );

      if (newStreetData.path === undefined || !pathInSameCellRecentlyRemoved) {
        newStreetData.svgElement.setAttribute("stroke-width", String(0));
        newStreetData.svgElement.setAttribute("opacity", String(0));
        newStreetData.svgElement.style.willChange = `stroke-width, opacity`;

        if (!noShadow) {
          newStreetData.svgElementShadow = createSvgElement("path");
          newStreetData.svgElementShadow.setAttribute("d", newStreetData.d);
          streetShadowLayer.append(newStreetData.svgElementShadow);

          // After transition complete, we don't need the shadow anymore
          setTimeout(() => {
            newStreetData.svgElementShadow?.remove();
            newStreetData.svgElement!.style.willChange = "";
          }, 500);
        }

        setTimeout(() => {
          newStreetData.svgElement!.removeAttribute("stroke-width");
          const opac = String(isPending(newStreetData) ? 0 : 1);
          newStreetData.svgElement!.setAttribute("opacity", opac);
        }, 20);
      }
    }
  });

  streetsData = [...newStreetsData];
  drawPendingOverlay();
  drawActiveStreetOverlay();
  drawMotorwayOverlays();
  recentlyRemoved = [];
};

/** Called from `Street.remove()` — fades out the street's SVGs over 500 ms and notes its
 *  cells so subsequent player-draws in the same cells skip the appear-transition. */
export const fadeOutStreetSvgs = (street: Street): void => {
  streetsData = streetsData.filter((p) => {
    if (p.path === street || p.path1 === street || p.path2 === street) {
      p.svgElement!.setAttribute("opacity", String(0));
      p.svgElement!.setAttribute("stroke-width", String(0));
      if (p.svgDash) {
        p.svgDash.setAttribute("opacity", String(0));
        p.svgDash.setAttribute("stroke-width", String(0));
      }
      setTimeout(() => {
        p.svgElement!.remove();
        p.svgDash?.remove();
        drawPendingOverlay();
        drawActiveStreetOverlay();
        drawMotorwayOverlays();
      }, 500);
      return false;
    }
    return true;
  });
  recentlyRemoved.push(...street.points);
};
