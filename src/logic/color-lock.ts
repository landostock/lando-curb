import { challengeBlocksColorMixing } from "../challenge";
import type { House } from "../entities/house";
import type { Street } from "../entities/street";
import { businessParks, houses, streets } from "../state";
import type { Cell } from "../types";
import { samePoint } from "../util/geometry";
import { streetMatchesEdge } from "./find-route";

interface HouseTypeChange {
  house: House;
  type: string;
}

const activeStreets = (ignore: Street[]): Street[] =>
  streets.filter(
    (street) =>
      !street.pendingRemoval && !street.noConnect && !ignore.includes(street),
  );

const changedHouseType = (
  house: House,
  changes: readonly HouseTypeChange[],
): string | undefined =>
  changes.find((change) => change.house === house)?.type;

const endpointColorSetsAt = (
  cell: Cell,
  changes: readonly HouseTypeChange[] = [],
): string[][] => {
  const endpoints: string[][] = [];
  for (const house of houses) {
    if (house.x === cell.x && house.y === cell.y)
      endpoints.push([changedHouseType(house, changes) ?? house.type]);
  }
  for (const bp of businessParks) {
    if (bp.points.some((point) => samePoint(point, cell))) {
      endpoints.push([...new Set(bp.types)]);
    }
  }
  return endpoints;
};

const connectedStreetsAt = (cell: Cell, ignore: Street[]): Street[] =>
  activeStreets(ignore).filter((street) =>
    street.points.some((point) => samePoint(point, cell)),
  );

const otherEndpoint = (street: Street, cell: Cell): Cell =>
  samePoint(street.points[0], cell) ? street.points[1] : street.points[0];

const cellKey = ({ x, y }: Cell): string => `${x},${y}`;

const componentEndpointColorSets = (
  seed: Cell,
  ignore: Street[],
  changes: readonly HouseTypeChange[] = [],
): string[][] => {
  const colors: string[][] = [];
  const seen = new Set<string>();
  const queue = [seed];

  while (queue.length) {
    const cell = queue.pop()!;
    const key = cellKey(cell);
    if (seen.has(key)) continue;
    seen.add(key);
    colors.push(...endpointColorSetsAt(cell, changes));

    for (const street of connectedStreetsAt(cell, ignore)) {
      queue.push(otherEndpoint(street, cell));
    }
  }

  return colors;
};

const hasSharedColor = (endpointSets: string[][]): boolean => {
  if (!endpointSets.length) return true;
  const [first, ...rest] = endpointSets;
  let shared = new Set(first);

  for (const colors of rest) {
    shared = new Set(colors.filter((color) => shared.has(color)));
    if (!shared.size) return false;
  }

  return shared.size > 0;
};

export const streetWouldMixColors = (
  start: Cell,
  end: Cell,
  ignore: Street[] = [],
): boolean => {
  if (!challengeBlocksColorMixing()) return false;
  if (activeStreets(ignore).some((street) => streetMatchesEdge(street, start, end)))
    return false;

  return !hasSharedColor([
    ...componentEndpointColorSets(start, ignore),
    ...componentEndpointColorSets(end, ignore),
  ]);
};

export const houseTypeChangesWouldMixColors = (
  changes: readonly HouseTypeChange[],
  ignore: Street[] = [],
): boolean => {
  if (!challengeBlocksColorMixing()) return false;

  const changedCells = new Map<string, Cell>();
  for (const { house, type } of changes) {
    if (house.type === type) continue;
    const cell = { x: house.x, y: house.y } as Cell;
    changedCells.set(cellKey(cell), cell);
  }

  for (const cell of changedCells.values()) {
    if (!hasSharedColor(componentEndpointColorSets(cell, ignore, changes)))
      return true;
  }

  return false;
};
