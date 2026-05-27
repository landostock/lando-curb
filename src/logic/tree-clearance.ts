import type { BusinessPark } from "../entities/business-park";
import { businessParkTreeClearanceRects } from "../entities/business-park.render";
import type { House } from "../entities/house";
import type { Tree } from "../entities/tree";
import { toSvgPoint } from "../gfx/svg-utils";
import { businessParks, houses, trees } from "../state";

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface ClearanceZone {
  rect: Rect;
  clearance: number;
}

const HOUSE_TREE_CLEARANCE = 0.7;
const PARK_TREE_CLEARANCE = 0.45;
const PARK_BUILDING_TREE_CLEARANCE = 0.7;

const houseHalfSize = (house: House): { x: number; y: number } =>
  house.style === "plattenbau" ? { x: 3, y: 2.4 } : { x: 2.8, y: 2.8 };

const houseClearanceZones = (house: House): ClearanceZone[] => {
  const center = toSvgPoint(house);
  const half = houseHalfSize(house);
  return [
    {
      rect: {
        left: center.x - half.x,
        top: center.y - half.y,
        right: center.x + half.x,
        bottom: center.y + half.y,
      },
      clearance: HOUSE_TREE_CLEARANCE,
    },
  ];
};

const businessParkClearanceZones = (bp: BusinessPark): ClearanceZone[] => {
  const [park, ...buildings] = businessParkTreeClearanceRects(bp);
  const zones: ClearanceZone[] = [];
  if (park) {
    zones.push({
      rect: {
        left: park.x,
        top: park.y,
        right: park.x + park.w,
        bottom: park.y + park.h,
      },
      clearance: PARK_TREE_CLEARANCE,
    });
  }
  zones.push(
    ...buildings.map((building) => ({
      rect: {
        left: building.x,
        top: building.y,
        right: building.x + building.w,
        bottom: building.y + building.h,
      },
      clearance: PARK_BUILDING_TREE_CLEARANCE,
    })),
  );
  return zones;
};

const distanceToRect = (
  point: { x: number; y: number },
  rect: Rect,
): number => {
  const dx = Math.max(rect.left - point.x, 0, point.x - rect.right);
  const dy = Math.max(rect.top - point.y, 0, point.y - rect.bottom);
  return Math.hypot(dx, dy);
};

const crownIsTooCloseToZone = (
  tree: Tree,
  circle: Tree["canopy"][number],
  zone: ClearanceZone,
): boolean =>
  distanceToRect(tree.canopyCenter(circle), zone.rect) <=
  circle.radius + zone.clearance;

const pruneTreeAgainstZones = (tree: Tree, zones: ClearanceZone[]): void => {
  if (!zones.length) return;
  for (const circle of [...tree.canopy]) {
    if (zones.some((zone) => crownIsTooCloseToZone(tree, circle, zone))) {
      tree.removeCanopyCircle(circle);
    }
  }
};

export const pruneTreeCanopiesNearBuildings = (tree: Tree): void => {
  const zones = [
    ...houses.flatMap(houseClearanceZones),
    ...businessParks.flatMap(businessParkClearanceZones),
  ];
  pruneTreeAgainstZones(tree, zones);
};

export const pruneTreesNearHouse = (house: House): void => {
  const zones = houseClearanceZones(house);
  for (const tree of [...trees]) pruneTreeAgainstZones(tree, zones);
};

export const pruneTreesNearBusinessPark = (bp: BusinessPark): void => {
  const zones = businessParkClearanceZones(bp);
  for (const tree of [...trees]) pruneTreeAgainstZones(tree, zones);
};

export const pruneTreesNearBuildings = (): void => {
  for (const tree of [...trees]) pruneTreeCanopiesNearBuildings(tree);
};
