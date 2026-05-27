import { GameObjectClass } from "kontra";

import { toSvgPoint } from "../gfx/svg-utils";
import { removeStreet, trees } from "../state";
import type { Cell, Point } from "../types";
import {
  fadeOutStreetSvgs,
  getRenderedStreetCenterlinePaths,
} from "./street.render";
import type { Tree, TreeCanopyCircle } from "./tree";

interface StreetPoint extends Cell {
  locked?: boolean;
}

const ROAD_STROKE_RADIUS = 3.14 / 2;
const TREE_STREET_OVERLAP_LIMIT = 1 / 3;
const TREE_OVERLAP_SAMPLE_COUNT = 64;
const TREE_OVERLAP_GOLDEN_ANGLE = 2.399963229728653;
const TREE_OVERLAP_SAMPLES: Point[] = Array.from(
  { length: TREE_OVERLAP_SAMPLE_COUNT },
  (_, i) => {
    const radius = Math.sqrt((i + 0.5) / TREE_OVERLAP_SAMPLE_COUNT);
    const angle = i * TREE_OVERLAP_GOLDEN_ANGLE;
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    };
  },
);
const ROAD_PATH_SAMPLE_STEP = 0.35;

const distanceToSegment = (point: Point, start: Point, end: Point): number => {
  const vx = end.x - start.x;
  const vy = end.y - start.y;
  const wx = point.x - start.x;
  const wy = point.y - start.y;
  const len2 = vx * vx + vy * vy;
  const t = len2 > 0 ? Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2)) : 0;
  const px = start.x + vx * t;
  const py = start.y + vy * t;
  return Math.hypot(point.x - px, point.y - py);
};

const pathSamples = (path: SVGPathElement): Point[] => {
  const length = path.getTotalLength();
  const steps = Math.max(1, Math.ceil(length / ROAD_PATH_SAMPLE_STEP));
  const points: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const point = path.getPointAtLength((length * i) / steps);
    points.push({ x: point.x, y: point.y });
  }
  return points;
};

const distanceToPolyline = (point: Point, polyline: Point[]): number => {
  let best = Infinity;
  for (let i = 1; i < polyline.length; i++) {
    best = Math.min(best, distanceToSegment(point, polyline[i - 1]!, polyline[i]!));
  }
  return best;
};

const crownCenter = (tree: Tree, circle: TreeCanopyCircle): Point => {
  return tree.canopyCenter(circle);
};

const crownCenterIsOnSegment = (
  tree: Tree,
  circle: TreeCanopyCircle,
  start: Point,
  end: Point,
): boolean =>
  distanceToSegment(crownCenter(tree, circle), start, end) <= ROAD_STROKE_RADIUS;

const crownCenterIsOnPath = (
  tree: Tree,
  circle: TreeCanopyCircle,
  path: Point[],
): boolean =>
  distanceToPolyline(crownCenter(tree, circle), path) <= ROAD_STROKE_RADIUS;

const circleStreetOverlapRatio = ({
  center,
  radius,
  start,
  end,
}: {
  center: Point;
  radius: number;
  start: Point;
  end: Point;
}): number => {
  const covered = TREE_OVERLAP_SAMPLES.filter((sample) => {
    const point = {
      x: center.x + sample.x * radius,
      y: center.y + sample.y * radius,
    };
    return distanceToSegment(point, start, end) <= ROAD_STROKE_RADIUS;
  }).length;
  return covered / TREE_OVERLAP_SAMPLES.length;
};

const circleStreetPathOverlapRatio = ({
  center,
  radius,
  path,
}: {
  center: Point;
  radius: number;
  path: Point[];
}): number => {
  const covered = TREE_OVERLAP_SAMPLES.filter((sample) => {
    const point = {
      x: center.x + sample.x * radius,
      y: center.y + sample.y * radius,
    };
    return distanceToPolyline(point, path) <= ROAD_STROKE_RADIUS;
  }).length;
  return covered / TREE_OVERLAP_SAMPLES.length;
};

const crownStreetOverlapRatio = (
  tree: Tree,
  circle: TreeCanopyCircle,
  start: Point,
  end: Point,
): number => {
  return circleStreetOverlapRatio({
    center: crownCenter(tree, circle),
    radius: circle.radius,
    start,
    end,
  });
};

const crownStreetPathOverlapRatio = (
  tree: Tree,
  circle: TreeCanopyCircle,
  path: Point[],
): number =>
  circleStreetPathOverlapRatio({
    center: crownCenter(tree, circle),
    radius: circle.radius,
    path,
  });

const crownOverlapsStreetSegment = (
  tree: Tree,
  circle: TreeCanopyCircle,
  start: Point,
  end: Point,
): boolean =>
  crownCenterIsOnSegment(tree, circle, start, end) ||
  crownStreetOverlapRatio(tree, circle, start, end) > TREE_STREET_OVERLAP_LIMIT;

const crownOverlapsStreetPath = (
  tree: Tree,
  circle: TreeCanopyCircle,
  path: Point[],
): boolean =>
  crownCenterIsOnPath(tree, circle, path) ||
  crownStreetPathOverlapRatio(tree, circle, path) > TREE_STREET_OVERLAP_LIMIT;

export const treeOverlapsStreetPoints = (
  tree: Tree,
  points: [Cell, Cell],
): boolean => {
  const start = toSvgPoint(points[0]);
  const end = toSvgPoint(points[1]);
  return tree.canopy.some((circle) =>
    crownOverlapsStreetSegment(tree, circle, start, end),
  );
};

const treeOverlapsStreetPath = (tree: Tree, path: Point[]): boolean =>
  tree.canopy.some((circle) => crownOverlapsStreetPath(tree, circle, path));

export const treeOverlapsRenderedStreets = (tree: Tree): boolean =>
  getRenderedStreetCenterlinePaths().some(
    (path) => treeOverlapsStreetPath(tree, pathSamples(path)),
  );

const pruneTreeOverStreetPaths = (tree: Tree, paths: Point[][]): void => {
  for (const circle of [...tree.canopy]) {
    if (
      paths.some((path) => crownOverlapsStreetPath(tree, circle, path))
    ) {
      tree.removeCanopyCircle(circle);
    }
  }
};

export const pruneTreeOverRenderedStreets = (tree: Tree): void => {
  const renderedPaths = getRenderedStreetCenterlinePaths().map(pathSamples);
  if (!renderedPaths.length) return;
  pruneTreeOverStreetPaths(tree, renderedPaths);
};

export const pruneTreesOverRenderedStreets = (): void => {
  const renderedPaths = getRenderedStreetCenterlinePaths().map(pathSamples);
  if (!renderedPaths.length) return;

  for (const tree of [...trees]) {
    pruneTreeOverStreetPaths(tree, renderedPaths);
  }
};

export const pruneTreesOverStreetPoints = (points: [Cell, Cell]): void => {
  const start = toSvgPoint(points[0]);
  const end = toSvgPoint(points[1]);
  for (const tree of [...trees]) {
    for (const circle of [...tree.canopy]) {
      if (crownOverlapsStreetSegment(tree, circle, start, end)) {
        tree.removeCanopyCircle(circle);
      }
    }
  }
};

export class Street extends GameObjectClass {
  declare points: [start: StreetPoint, end: StreetPoint];
  declare noConnect: boolean;
  declare motorway: boolean;
  declare bridge: boolean;
  pendingRemoval = false;

  constructor(properties: Record<string, unknown>) {
    super(properties);
    if (properties.pruneTreesImmediately !== false) {
      pruneTreesOverStreetPoints(this.points);
    }
  }

  markPendingRemoval() {
    if (this.points.some((p) => p.locked)) return;
    this.pendingRemoval = true;
  }

  remove() {
    fadeOutStreetSvgs(this);
    removeStreet(this);
  }
}
