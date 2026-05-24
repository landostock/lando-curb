import { GameObjectClass } from "kontra";

import { computeParkingPathRail } from "../gfx/parking-rail";
import { toSvgPoint } from "../gfx/svg-utils";
import {
  dispatchCommutersFor,
  hasDispatchableCommuter,
} from "../logic/commuter-dispatch";
import { updateGridData } from "../logic/find-route";
import { getSpawningConfig } from "../logic/spawning";
import { addStreet, businessParks, session } from "../state";
import type { Cell, Direction, Pixel, Point } from "../types";
import { pickupCount } from "../ui/ui";
import {
  type BusinessParkRenderState,
  renderBusinessPark,
  scheduleSpawnAnimation,
} from "./business-park.render";
import type { Commuter } from "./commuter";
import { Street } from "./street";
import { drawStreets } from "./street.render";

export interface BusinessParkProperties {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  delay?: number;
  borderColor: string;
  borderColors?: string[];
  relativePathPoints?: Array<Point & { locked?: boolean }>;
  parkingCapacity?: number;
  parkingRotation?: number;
  parkingVariant?: number;
  silentAppearChime?: boolean;
  [key: string]: unknown;
}

const inferParkingVariant = (
  entryEdge: number,
  entryCell: Cell | undefined,
  park: { x: number; y: number; width: number; height: number },
): number => {
  if (!entryCell) return Math.floor(Math.random() * 2);
  if (entryEdge === 0) return entryCell.x - park.x < park.width / 2 ? 0 : 1;
  if (entryEdge === 1) return entryCell.y - park.y < park.height / 2 ? 0 : 1;
  if (entryEdge === 2) return entryCell.x - park.x < park.width / 2 ? 1 : 0;
  return entryCell.y - park.y < park.height / 2 ? 1 : 0;
};

const compactPixels = (points: Pixel[]): Pixel[] => {
  const route: Pixel[] = [];
  for (const point of points) {
    const last = route.at(-1);
    if (!last || (last.x - point.x) ** 2 + (last.y - point.y) ** 2 > 0.01)
      route.push(point);
  }
  return route;
};

export class BusinessPark extends GameObjectClass {
  declare delay: number;
  demand = 0;
  demandTimer = 0;
  capacity = 0;
  parkingCapacity = 3;
  assignedPeople: Commuter[] = [];
  points: Cell[] = [];
  startPath?: Street;
  declare borderColor: string;
  declare type: string;
  declare appearing: boolean;
  declare silentAppearChime: boolean;
  types: string[] = [];
  // Render state — owned exclusively by business-park.render.ts; undefined until addBusinessParkToSvg fires
  rs?: BusinessParkRenderState;

  // Trending / popular
  popular = false;
  trending = false;
  trendingTimer = 0;
  /** Ticks alive (non-appearing) — used for trending eligibility */
  age = 0;

  get hasWarn(): boolean {
    if (this.appearing) return false;
    const cfg = getSpawningConfig();
    if (this.demand > cfg.demandPinCap) return true;
    return this.demandTimer < cfg.demandTimerMax * 0.6;
  }

  // Parking
  bayCenters: Pixel[] = [];
  bayLanePoints: Pixel[] = [];
  bayExitLanePoints: Pixel[] = [];
  bayReturnLanePoints: Pixel[] = [];
  bayEntryRails: Pixel[][] = [];
  bayExitRails: Pixel[][] = [];
  bayEntryDistances: number[] = [];
  drivewayPoint?: Pixel;
  departureDrivewayPoint?: Pixel;
  baySlots: Array<Commuter | null> = [null, null, null];
  parkingLaneUsers = new Set<Commuter>();
  entryCell?: Cell;
  entryEdge = 2; // 0=top, 1=right, 2=bottom, 3=left
  parkingRotation = 0;
  parkingVariant = 0;

  get bayHeading(): Direction {
    if (this.parkingRotation === 1) return { x: 1, y: 0 } as Direction;
    if (this.parkingRotation === 2) return { x: 0, y: 1 } as Direction;
    if (this.parkingRotation === 3) return { x: -1, y: 0 } as Direction;
    return { x: 0, y: -1 } as Direction;
  }

  getBayHeading(c: Commuter): Direction {
    const slot = this.baySlots.indexOf(c);
    const center = slot === -1 ? undefined : this.bayCenters[slot];
    const exit = slot === -1 ? undefined : this.bayExitRails[slot]?.[0];
    if (!center || !exit) return this.bayHeading;

    const dx = exit.x - center.x;
    const dy = exit.y - center.y;
    if (Math.abs(dx) > Math.abs(dy))
      return { x: Math.sign(dx), y: 0 } as Direction;
    return { x: 0, y: Math.sign(dy) } as Direction;
  }

  get pendingParkingArrivals(): number {
    return this.baySlots.filter((c) => c?.state === "parking").length;
  }

  get occupiedBayCount(): number {
    return this.baySlots.filter((c) => c !== null).length;
  }

  get availableArrivalSlots(): number {
    if (this.parkingLaneUsers.size > 0) return 0;
    return Math.max(
      0,
      this.parkingCapacity - this.occupiedBayCount - this.assignedPeople.length,
    );
  }

  get activeFulfillmentCount(): number {
    return this.assignedPeople.length + this.pendingParkingArrivals;
  }

  parkInBay(c: Commuter): void {
    let slot = -1;
    let bestDistance = Infinity;
    for (let i = 0; i < this.baySlots.length; i++) {
      if (this.baySlots[i]) continue;
      const distance = this.bayEntryDistances[i] ?? i;
      if (distance < bestDistance) {
        bestDistance = distance;
        slot = i;
      }
    }
    if (slot === -1) return;
    this.baySlots[slot] = c;
  }

  getParkingRail(c: Commuter): Pixel[] | null {
    const slot = this.baySlots.indexOf(c);
    if (slot === -1) return null;
    const entryRail = this.bayEntryRails[slot];
    if (entryRail?.length) {
      const rail = computeParkingPathRail(
        compactPixels([{ x: c.x, y: c.y } as Pixel, ...entryRail]),
      );
      if (rail.length > 1) this.parkingLaneUsers.add(c);
      return rail;
    }

    const lane = this.bayLanePoints[slot];
    const center = this.bayCenters[slot];
    const returnLane = this.bayReturnLanePoints[slot];
    if (!lane || !center) return null;
    const rail = computeParkingPathRail(
      [{ x: c.x, y: c.y } as Pixel, returnLane, lane, center].filter(
        (point): point is Pixel => !!point,
      ),
    );
    if (rail.length > 1) this.parkingLaneUsers.add(c);
    return rail;
  }

  getDrivewayPoint(): Pixel {
    return this.drivewayPoint ?? toSvgPoint(this.entryCell ?? this);
  }

  getDepartureDrivewayPoint(): Pixel {
    return this.departureDrivewayPoint ?? this.getDrivewayPoint();
  }

  getExitRail(c: Commuter): Pixel[] | null {
    const slot = this.baySlots.indexOf(c);
    if (slot === -1) return null;
    const exitRail = this.bayExitRails[slot];
    if (exitRail?.length) {
      const rail = computeParkingPathRail(
        compactPixels([{ x: c.x, y: c.y } as Pixel, ...exitRail]),
      );
      if (rail.length > 1) this.parkingLaneUsers.add(c);
      return rail;
    }

    const lane = this.bayExitLanePoints[slot] ?? this.bayLanePoints[slot];
    const returnLane = this.bayReturnLanePoints[slot];
    if (!lane) return null;
    const rail = computeParkingPathRail(
      [
        { x: c.x, y: c.y } as Pixel,
        lane,
        returnLane,
        this.getDepartureDrivewayPoint(),
      ].filter((point): point is Pixel => !!point),
    );
    if (rail.length > 1) this.parkingLaneUsers.add(c);
    return rail;
  }

  releaseParkingLane(c: Commuter): void {
    this.parkingLaneUsers.delete(c);
  }

  isParkingLaneClearFor(c: Commuter): boolean {
    if (this.assignedPeople.length > 0) return false;
    return (
      this.parkingLaneUsers.size === 0 ||
      (this.parkingLaneUsers.size === 1 && this.parkingLaneUsers.has(c))
    );
  }

  leaveBay(c: Commuter): void {
    const slot = this.baySlots.indexOf(c);
    if (slot !== -1) this.baySlots[slot] = null;
  }

  hasType(color: string): boolean {
    return this.types.includes(color);
  }

  startTrending(): void {
    const cfg = getSpawningConfig();
    this.trending = true;
    this.trendingTimer = cfg.trendingWindow;
    this.demand += cfg.trendingDemandBurst;
  }

  constructor(properties: BusinessParkProperties) {
    const { relativePathPoints } = properties;
    super(properties);
    this.delay = properties.delay ?? 0;

    this.types = properties.borderColors ?? [properties.borderColor];
    this.type = this.types[0]!;
    this.appearing = true;

    for (let w = 0; w < this.width; w++) {
      for (let h = 0; h < this.height; h++) {
        this.points.push({ x: this.x + w, y: this.y + h } as Cell);
      }
    }

    if (relativePathPoints) {
      const inside = relativePathPoints[0]!;
      this.entryCell = { x: this.x + inside.x, y: this.y + inside.y } as Cell;
      const outside = relativePathPoints[1]!;
      if (outside.y < 0) this.entryEdge = 0;
      else if (outside.x >= this.width) this.entryEdge = 1;
      else if (outside.y >= this.height) this.entryEdge = 2;
      else this.entryEdge = 3;
    }

    this.parkingCapacity = properties.parkingCapacity ?? 3;
    this.parkingRotation = properties.parkingRotation ?? this.entryEdge;
    this.parkingVariant =
      properties.parkingVariant ??
      inferParkingVariant(this.entryEdge, this.entryCell, this);
    this.baySlots = Array<Commuter | null>(this.parkingCapacity).fill(null);

    spawnSequence(this, relativePathPoints);
  }

  commuterArrived() {
    this.demand--;
    session.pickups++;
    pickupCount.innerText = String(session.pickups);
    const cfg = getSpawningConfig();
    this.demandTimer = Math.min(
      this.demandTimer + cfg.commuterTimerBonus,
      cfg.demandTimerMax,
    );

    if (this.trending && this.demand === 0) {
      this.trending = false;
      this.trendingTimer = 0;
      this.popular = true;
    }
  }

  tick(gameStarted: boolean, _tick: number) {
    if (this.appearing) return;

    if (gameStarted) {
      this.age++;
      const cfg = getSpawningConfig();
      const pendingDemand = Math.max(0, this.demand);
      if (pendingDemand > 0) {
        const noRouteAvailable = !hasDispatchableCommuter(this);
        const routedPressure = Math.min(4, pendingDemand);
        const unroutedPressure = Math.min(0.35, pendingDemand * 0.18);
        this.demandTimer -= noRouteAvailable
          ? unroutedPressure
          : routedPressure;
      } else {
        this.demandTimer = Math.min(
          this.demandTimer + cfg.demandTimerRecovery,
          cfg.demandTimerMax,
        );
      }

      if (this.demandTimer <= 0) {
        this.ttl = 0;
      }

      // Trending countdown — failure if window expires
      if (this.trending) {
        this.trendingTimer--;
        if (this.trendingTimer <= 0) {
          this.trending = false;
        }
      }
    }

    dispatchCommutersFor(this);
  }

  render() {
    renderBusinessPark(this);
  }
}

/** Timed spawn choreography — separated from constructor for testability */
function spawnSequence(
  bp: BusinessPark,
  relativePathPoints?: BusinessParkProperties["relativePathPoints"],
): void {
  const { delay } = bp;
  const alive = () => businessParks.includes(bp);

  // 1. Render the SVG (timing owned by render module)
  setTimeout(() => {
    if (alive()) scheduleSpawnAnimation(bp, 0);
  }, delay);

  // 2. Attach the entry street.
  // No `commitStreetChanges()` tail: a freshly-spawned BP has no active commuters to reroute,
  // so drawStreets + updateGridData is enough.
  if (relativePathPoints) {
    setTimeout(() => {
      if (!alive()) return;
      bp.startPath = new Street({
        points: relativePathPoints.map((p) => ({
          x: bp.x + p.x,
          y: bp.y + p.y,
          locked: p.locked,
        })),
      });
      addStreet(bp.startPath);
      drawStreets();
      updateGridData();
    }, 1500 + delay);
  }

  // 3. Unlock parking bays one by one
  for (let i = 0; i < bp.parkingCapacity; i++)
    setTimeout(
      () => {
        if (alive()) bp.capacity++;
      },
      2000 + delay + i * 1000,
    );

  // 4. Lift appearing flag, start demand timer
  setTimeout(() => {
    if (!alive()) return;
    bp.appearing = false;
    bp.demandTimer = getSpawningConfig().demandTimerMax;
  }, 3000 + delay);
}
