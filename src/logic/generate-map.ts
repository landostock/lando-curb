import { board } from "../board";
import { spawnBoulevard } from "../entities/boulevard";
import { BusinessPark } from "../entities/business-park";
import { spawnLake, spawnReservedArea, spawnRiver } from "../entities/lake";
import {
  renderEutinCastle,
  renderFernsehturm,
  renderSeaLabel,
} from "../entities/landmark";
import { drawStreets } from "../entities/street.render";
import { Tree } from "../entities/tree";
import { colors } from "../gfx/colors";
import { addBusinessPark, addTree } from "../state";
import type { Cell } from "../types";
import {
  getRandomPosition,
  setHouseStylePicker,
  spawnFirstBusinessPark,
} from "./spawning";

export const generateRandomMap = (delay: number): void => {
  if (Math.random() > 0.5) {
    const pos = getRandomPosition({
      width: 6,
      height: 4,
      minDistance: 5,
      maxNumAttempts: 32,
    });
    if (pos) spawnLake({ width: 6, height: 4, x: pos.x, y: pos.y });
  } else {
    for (const [w, h] of [
      [4, 4],
      [3, 2],
      [3, 2],
    ] as Array<[number, number]>) {
      const pos = getRandomPosition({
        width: w,
        height: h,
        minDistance: 5,
        maxNumAttempts: 16,
      });
      if (pos) spawnLake({ width: w, height: h, x: pos.x, y: pos.y });
    }
  }

  for (let i = 0; i < 9; i++) {
    const pos = getRandomPosition({});
    if (pos) addTree(new Tree({ x: pos.x, y: pos.y }));
  }

  spawnFirstBusinessPark(delay);
};

export const generateBerlinMap = (delay: number): void => {
  // Plattenbau GDR-era apartment blocks on the eastern half of the board.
  setHouseStylePicker((x) =>
    x > board.x + board.width * 0.55 ? "plattenbau" : undefined,
  );

  // Spree river — winding west to east
  spawnRiver(
    [
      { x: 3, y: 7 },
      { x: 7, y: 6 },
      { x: 11, y: 5 },
      { x: 15, y: 6 },
      { x: 19, y: 5 },
      { x: 23, y: 6 },
    ] as Cell[],
    5,
  );

  // Landwehrkanal — thinner branch, south
  spawnRiver(
    [
      { x: 7, y: 6 },
      { x: 9, y: 8 },
      { x: 13, y: 9 },
    ] as Cell[],
    3,
  );

  // Tiergarten — dense tree cluster (center-west)
  for (const [x, y] of [
    [5, 3],
    [6, 3],
    [5, 4],
    [6, 4],
    [7, 4],
    [8, 4],
    [5, 5],
    [6, 5],
    [7, 5],
    [8, 5],
    [9, 5],
    [6, 6],
    [7, 6],
  ] as Array<[number, number]>) {
    addTree(new Tree({ x, y }));
  }

  // Treptower Park — small cluster (southeast)
  for (const [x, y] of [
    [19, 9],
    [20, 9],
    [21, 10],
  ] as Array<[number, number]>) {
    addTree(new Tree({ x, y }));
  }

  // Tempelhofer Feld — reserved empty space (south-center)
  const tempelhoferCells: Cell[] = [];
  for (let x = 12; x <= 16; x++) {
    for (let y = 8; y <= 10; y++) {
      tempelhoferCells.push({ x, y } as Cell);
    }
  }
  spawnReservedArea(tempelhoferCells);

  // Fernsehturm at Alexanderplatz
  renderFernsehturm(15, 4);

  // Unter den Linden — tree-lined boulevard (west of Potsdamer Platz)
  spawnBoulevard([
    { x: 5, y: 3 },
    { x: 6, y: 3 },
    { x: 7, y: 3 },
    { x: 8, y: 3 },
    { x: 9, y: 3 },
  ] as Cell[]);
  drawStreets();

  // First business park — "Alexanderplatz" (red, east of center)
  // 3×2 landscape, entry right → parking = 1×2 strip on right, building = 2×2 on left
  addBusinessPark(
    new BusinessPark({
      width: 3,
      height: 2,
      x: 16,
      y: 3,
      borderColor: colors.car1,
      relativePathPoints: [
        { x: 2, y: 1, locked: true },
        { x: 3, y: 1, locked: true },
      ],
      delay,
    }),
  );

  // Second business park — "Potsdamer Platz" (blue, center)
  // 2×3 portrait, entry bottom → parking = 2×1 strip on bottom, building = 2×2 on top
  addBusinessPark(
    new BusinessPark({
      width: 2,
      height: 3,
      x: 10,
      y: 2,
      borderColor: colors.car2,
      relativePathPoints: [
        { x: 0, y: 2, locked: true },
        { x: 0, y: 3, locked: true },
      ],
      delay: delay + 3000,
    }),
  );
};

export const generateOstholsteinMap = (delay: number): void => {
  // Baltic Sea — three overlapping lakes sculpt the coast.
  // Fehmarn emerges naturally as the dry corner at x=26..30, y=0..1,
  // bounded by Hohwacht Bay south and the east-coast strip east.
  spawnLake({ x: 14, y: 14, width: 17, height: 5 }); // Lübeck Bay (SE)
  spawnLake({ x: 26, y: 4, width: 5, height: 11 }); // East coast strip
  spawnLake({ x: 15, y: 2, width: 11, height: 3 }); // Hohwacht Bay (NE)

  // Holsteinische Schweiz inland lakes.
  spawnLake({ x: 8, y: 8, width: 5, height: 4 }); // Großer Plöner See
  spawnLake({ x: 15, y: 7, width: 2, height: 2 }); // Kellersee
  spawnLake({ x: 18, y: 10, width: 2, height: 2 }); // Dieksee

  // Schwentine — flows west out of Plöner See, off-map.
  spawnRiver(
    [
      { x: 8, y: 10 },
      { x: 5, y: 10 },
      { x: 2, y: 11 },
      { x: 0, y: 11 },
    ] as Cell[],
    2,
  );

  // Tree clusters — forested moraine hills.
  for (const [x, y] of [
    [4, 5],
    [6, 6],
    [5, 7],
    [12, 12],
    [13, 6],
    [22, 6],
    [22, 9],
  ] as Array<[number, number]>) {
    addTree(new Tree({ x, y }));
  }

  // Landmark: Schloss Eutin.
  renderEutinCastle(17, 9);

  // Nautical-chart captions floating on the two bays.
  renderSeaLabel(20, 3, "HOHWACHTER BUCHT");
  renderSeaLabel(22, 16, "LÜBECKER BUCHT");

  // Let the dynamic spawner pick the first park — geography shapes where it lands.
  spawnFirstBusinessPark(delay);
};
