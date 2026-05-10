import type { BusinessPark } from "./entities/business-park";
import type { Commuter } from "./entities/commuter";
import type { House } from "./entities/house";
import type { Lake } from "./entities/lake";
import type { Street } from "./entities/street";
import type { Tree } from "./entities/tree";
import type { Cell } from "./types";

export const businessParks: BusinessPark[] = [];
export const commuters: Commuter[] = [];
export const houses: House[] = [];
export const lakes: Lake[] = [];
export const landmarks: Cell[] = [];
/** Non-water no-build cells (e.g. Tempelhofer Feld). Placement obstacles only — never rendered. */
export const reservedAreas: Cell[] = [];
export const streets: Street[] = [];
export const trees: Tree[] = [];
export const session = {
  paths: 18,
  motorways: 0,
  bridges: 0,
  homeActions: 0,
  pickups: 0,
};

export const addBusinessPark = (bp: BusinessPark) => {
  businessParks.push(bp);
};
export const addCommuter = (c: Commuter) => {
  commuters.push(c);
};
export const addHouse = (h: House) => {
  houses.push(h);
};
export const addLake = (l: Lake) => {
  lakes.push(l);
};
export const addLandmark = (p: Cell) => {
  landmarks.push(p);
};
export const addReservedArea = (cells: Cell[]) => {
  reservedAreas.push(...cells);
};
export const addStreet = (s: Street) => {
  streets.push(s);
};
export const addTree = (t: Tree) => {
  trees.push(t);
};

export const removeCommuter = (c: Commuter) => {
  const index = commuters.indexOf(c);
  if (index >= 0) commuters.splice(index, 1);
};
export const removeHouse = (h: House) => {
  const index = houses.indexOf(h);
  if (index >= 0) houses.splice(index, 1);
};
export const removeStreet = (s: Street) => {
  const index = streets.indexOf(s);
  if (index >= 0) streets.splice(index, 1);
};
export const removeTree = (t: Tree) => {
  const index = trees.indexOf(t);
  if (index >= 0) trees.splice(index, 1);
};

export const resetState = (): void => {
  businessParks.length = 0;
  commuters.length = 0;
  houses.length = 0;
  lakes.length = 0;
  landmarks.length = 0;
  reservedAreas.length = 0;
  streets.length = 0;
  trees.length = 0;
  session.paths = 18;
  session.motorways = 0;
  session.bridges = 0;
  session.homeActions = 0;
  session.pickups = 0;
};
