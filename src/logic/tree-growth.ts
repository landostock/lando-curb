import { board } from "../board";
import { pruneTreeOverRenderedStreets } from "../entities/street";
import { Tree } from "../entities/tree";
import { addTree, trees } from "../state";
import type { Cell, Rect } from "../types";
import { isAreaFree } from "./placement-obstacles";
import { minutes } from "./timing";
import { pruneTreeCanopiesNearBuildings } from "./tree-clearance";

const TREE_GROWTH_INTERVAL = minutes(1.25);
const TREE_GROWTH_CHANCE = 0.35;
const TREE_GROWTH_ATTEMPTS = 12;
const TREE_DENSITY_DIVISOR = 20;
const MIN_TREE_CAP = 9;

const naturalTreeCap = (): number =>
  Math.max(
    MIN_TREE_CAP,
    Math.floor((board.width * board.height) / TREE_DENSITY_DIVISOR),
  );

const randomBoardCell = (): Cell =>
  ({
    x: board.x + Math.floor(Math.random() * board.width),
    y: board.y + Math.floor(Math.random() * board.height),
  }) as Cell;

const treeHasBreathingRoom = (cell: Cell): boolean =>
  !trees.some(
    (tree) => Math.max(Math.abs(tree.x - cell.x), Math.abs(tree.y - cell.y)) <= 1,
  );

const findTreeGrowthCell = (): Cell | undefined => {
  for (let attempt = 0; attempt < TREE_GROWTH_ATTEMPTS; attempt++) {
    const cell = randomBoardCell();
    if (!treeHasBreathingRoom(cell)) continue;
    if (
      !isAreaFree({
        rect: { x: cell.x, y: cell.y, width: 1, height: 1 } as Rect<Cell>,
      })
    ) {
      continue;
    }
    return cell;
  }
  return undefined;
};

export const tickTreeGrowth = (tick: number): void => {
  if (tick <= TREE_GROWTH_INTERVAL || tick % TREE_GROWTH_INTERVAL !== 0) return;
  if (trees.length >= naturalTreeCap()) return;
  if (Math.random() > TREE_GROWTH_CHANCE) return;

  const cell = findTreeGrowthCell();
  if (!cell) return;

  const tree = new Tree({ x: cell.x, y: cell.y });
  addTree(tree);
  pruneTreeCanopiesNearBuildings(tree);
  pruneTreeOverRenderedStreets(tree);
};
