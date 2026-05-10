import { GameObjectClass } from "kontra";

import { computeParkingRail } from "../gfx/parking-rail";
import {
  dispatchCommutersFor,
  hasDispatchableCommuter,
} from "../logic/commuter-dispatch";
import { updateGridData } from "../logic/find-route";
import { getSpawningConfig } from "../logic/spawning";
import { addStreet, businessParks, session } from "../state";
import type { Cell, Direction, Pixel, Point } from "../types";
import { developerMode, pickupCount } from "../ui/ui";
import {
  type BusinessParkRenderState,
  renderBusinessPark,
  scheduleSpawnAnimation,
} from "./business-park.render";
import type { Commuter } from "./commuter";
import { Street } from "./street";
import { drawStreets } from "./street.render";

// Bay heading indexed by entry edge: top→down, right→left, bottom→up, left→right
const BAY_HEADINGS: Direction[] = [
  { x: 0, y: 1 } as Direction,
  { x: -1, y: 0 } as Direction,
  { x: 0, y: -1 } as Direction,
  { x: 1, y: 0 } as Direction,
];

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
  silentAppearChime?: boolean;
  [key: string]: unknown;
}

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
  baySlots: Array<Commuter | null> = [null, null, null];
  entryEdge = 2; // 0=top, 1=right, 2=bottom, 3=left

  get bayHeading(): Direction {
    return BAY_HEADINGS[this.entryEdge]!;
  }

  get pendingParkingArrivals(): number {
    return this.baySlots.filter((c) => c?.state === "parking").length;
  }

  get occupiedBayCount(): number {
    return this.baySlots.filter((c) => c !== null).length;
  }

  get availableArrivalSlots(): number {
    return Math.max(
      0,
      this.parkingCapacity - this.occupiedBayCount - this.assignedPeople.length,
    );
  }

  get activeFulfillmentCount(): number {
    return this.assignedPeople.length + this.pendingParkingArrivals;
  }

  parkInBay(c: Commuter): void {
    const slot = this.baySlots.indexOf(null);
    if (slot === -1) return;
    this.baySlots[slot] = c;
  }

  getParkingRail(c: Commuter): Pixel[] | null {
    const slot = this.baySlots.indexOf(c);
    if (slot === -1) return null;
    const lane = this.bayLanePoints[slot];
    const center = this.bayCenters[slot];
    if (!lane || !center) return null;
    return computeParkingRail({ x: c.x, y: c.y } as Pixel, lane, center);
  }

  getExitRail(c: Commuter, exitTarget: Pixel): Pixel[] | null {
    const slot = this.baySlots.indexOf(c);
    if (slot === -1) return null;
    const lane = this.bayLanePoints[slot];
    if (!lane) return null;
    return computeParkingRail({ x: c.x, y: c.y } as Pixel, lane, exitTarget);
  }

  leaveBay(c: Commuter): void {
    const slot = this.baySlots.indexOf(c);
    if (slot !== -1) this.baySlots[slot] = null;
  }

  private hurryParkedCommuters(): void {
    if (this.availableArrivalSlots > 0) return;

    const parked = this.baySlots.filter(
      (c): c is Commuter => c?.state === "atWork",
    );
    if (!parked.length) return;

    const oldest = parked.reduce((best, c) =>
      c.officeTimer > best.officeTimer ? c : best,
    );
    oldest.officeTimer = Math.max(oldest.officeTimer, 110);
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
      const outside = relativePathPoints[1]!;
      if (outside.y < 0) this.entryEdge = 0;
      else if (outside.x >= this.width) this.entryEdge = 1;
      else if (outside.y >= this.height) this.entryEdge = 2;
      else this.entryEdge = 3;
    }

    this.parkingCapacity = properties.parkingCapacity ?? 3;
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
      const unservedDemand = Math.max(
        0,
        this.demand - this.activeFulfillmentCount,
      );
      if (unservedDemand > 0) {
        const noRouteAvailable = !hasDispatchableCommuter(this);
        const outOfBuildOptions =
          !developerMode &&
          session.paths <= 0 &&
          session.motorways <= 0 &&
          session.bridges <= 0;
        this.hurryParkedCommuters();

        if (noRouteAvailable && outOfBuildOptions) {
          this.demandTimer = Math.min(
            this.demandTimer + cfg.demandTimerRecovery,
            cfg.demandTimerMax,
          );
        } else {
          this.demandTimer -= noRouteAvailable
            ? Math.min(2, unservedDemand)
            : Math.min(4, unservedDemand);
        }
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
