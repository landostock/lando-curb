import type { Commuter } from "../entities/commuter";
import { commuters } from "../state";

const SPATIAL_CELL = 10;
const spatialGrid = new Map<number, Commuter[]>();
const nearbyBuf: Commuter[] = [];

const spatialKey = (x: number, y: number): number =>
  Math.floor(x / SPATIAL_CELL) * 100 + Math.floor(y / SPATIAL_CELL);

export const updateTrafficGrid = (): void => {
  spatialGrid.clear();
  for (const c of commuters) {
    if (c.state === "home" || c.state === "atWork") continue;
    const k = spatialKey(c.x, c.y);
    let bucket = spatialGrid.get(k);
    if (!bucket) {
      bucket = [];
      spatialGrid.set(k, bucket);
    }
    bucket.push(c);
  }
};

/** Returns commuters in the 3×3 cell window centred on (x, y). The buffer is reused — copy if you need to retain it. */
export const getNearby = (x: number, y: number): Commuter[] => {
  nearbyBuf.length = 0;
  const cx = Math.floor(x / SPATIAL_CELL);
  const cy = Math.floor(y / SPATIAL_CELL);
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const bucket = spatialGrid.get((cx + dx) * 100 + (cy + dy));
      if (bucket) for (const c of bucket) nearbyBuf.push(c);
    }
  }
  return nearbyBuf;
};
