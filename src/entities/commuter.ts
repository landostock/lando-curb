import { GameObjectClass } from "kontra";

import {
  advanceOnRail,
  computeLanePath,
  computeRoadRail,
  getRailCurvature,
  type RailState,
} from "../gfx/pathing";
import { toSvgPoint } from "../gfx/svg-utils";
import { computeTargetSpeed, smoothSpeed } from "../logic/commuter-traffic-ai";
import { findRoute, routeCrossesPending, sameRoute } from "../logic/find-route";
import { commuters } from "../state";
import type { Cell, Pixel } from "../types";
import { samePoint } from "../util/geometry";
import type { BusinessPark } from "./business-park";
import { addCommuterToSvg, renderCommuter } from "./commuter.render";

const newRail = (route: Cell[]): RailState => ({
  rail: computeRoadRail(computeLanePath(route)),
  index: 0,
  t: 0,
});

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const smoothstep = (value: number): number => value * value * (3 - 2 * value);
const PARKING_WAIT_TICKS = 120;

type WorkplaceRouteDock = "arrival" | "departure";

type CommuterState =
  | "home"
  | "toWork"
  | "parking"
  | "atWork"
  | "unparking"
  | "toHome";

let nextUid = 0;

export class Commuter extends GameObjectClass {
  declare type: string;
  readonly uid = nextUid++;
  state: CommuterState;
  officeTimer: number;
  destination: Cell | null;
  railState: RailState = { rail: [], index: 0, t: 0 };
  pendingRoute: Cell[] | null = null;
  svgElement!: SVGGElement;
  loadIndicator!: SVGElement;
  loadVisible = false;
  carriesLoad = false; // true only after the car has actually parked at the workplace
  route: Cell[] = [];
  /** Last cell shifted off `route` — together with `route[0]` it defines the segment currently being driven. */
  lastTraversed: Cell | null = null;
  originalRoute!: Cell[];
  speedPersonality: number;
  prevSpeed = 0;
  workplace!: BusinessPark;

  constructor(properties: Record<string, unknown>) {
    super(properties);
    this.type = this.parent!.type as string;
    this.state = "home";
    this.officeTimer = 0;
    this.destination = null;
    this.speedPersonality = 0.9 + Math.random() * 0.2;
    const parentSvg = toSvgPoint(this.parent!);
    this.x = parentSvg.x + (Math.random() * 2 - 1);
    this.y = parentSvg.y + (Math.random() * 2 - 1);
  }

  dispatch(route: Cell[], workplace: BusinessPark) {
    this.workplace = workplace;
    this.becomeToWork(route);
  }

  addToSvg() {
    addCommuterToSvg(this);
  }

  private setRoute(route: Cell[]) {
    this.route = route;
    this.originalRoute = [...route];
    this.destination = route.at(-1) ?? null;
    this.lastTraversed = null;
  }

  private buildWorkplaceAwareRoadRail(
    route: Cell[],
    dock?: WorkplaceRouteDock,
  ): Pixel[] {
    const lanePath = computeLanePath(route);
    if (dock && lanePath.length > 0) {
      const driveway =
        dock === "arrival"
          ? this.workplace.getDrivewayPoint()
          : this.workplace.getDepartureDrivewayPoint();
      if (dock === "arrival") lanePath[lanePath.length - 1] = driveway;
      else lanePath[0] = driveway;
    }
    return computeRoadRail(lanePath);
  }

  /** Rail rebuilt with a Bézier prefix from current pos → `route[0]`'s lane point — momentum-preserving. */
  private buildTransitionRail(
    route: Cell[],
    dock?: WorkplaceRouteDock,
  ): RailState {
    const rail = this.buildWorkplaceAwareRoadRail(route, dock);
    const target = rail[0]!;
    const hlen = Math.sqrt(this.dx * this.dx + this.dy * this.dy);
    if (hlen > 0) {
      const gap = Math.sqrt(
        (target.x - this.x) ** 2 + (target.y - this.y) ** 2,
      );
      const reach = Math.max(gap * 0.5, 2);
      const ctrl = {
        x: this.x + (this.dx / hlen) * reach,
        y: this.y + (this.dy / hlen) * reach,
      };
      const STEPS = 4;
      const transition: Pixel[] = [{ x: this.x, y: this.y } as Pixel];
      for (let j = 1; j < STEPS; j++) {
        const t = j / STEPS,
          mt = 1 - t;
        transition.push({
          x: mt * mt * this.x + 2 * mt * t * ctrl.x + t * t * target.x,
          y: mt * mt * this.y + 2 * mt * t * ctrl.y + t * t * target.y,
        } as Pixel);
      }
      rail.unshift(...transition);
    } else if ((target.x - this.x) ** 2 + (target.y - this.y) ** 2 > 1) {
      rail.unshift({ x: this.x, y: this.y } as Pixel);
    }
    return { rail, index: 0, t: 0 };
  }

  /** Mid-transit route change. State unchanged; momentum preserved. */
  private smoothReroute(route: Cell[]) {
    const currentEdgeStart = this.lastTraversed;
    const currentEdgeEnd = this.route[0] ?? null;
    this.setRoute(route);
    if (
      currentEdgeStart &&
      currentEdgeEnd &&
      this.route[0] &&
      samePoint(currentEdgeEnd, this.route[0])
    ) {
      this.lastTraversed = currentEdgeStart;
    }
    this.railState = this.buildTransitionRail(
      route,
      this.state === "toWork" ? "arrival" : undefined,
    );
  }

  private unassignFromWorkplace(): void {
    const idx = this.workplace.assignedPeople.indexOf(this);
    if (idx >= 0) this.workplace.assignedPeople.splice(idx, 1);
  }

  // ─── State entry methods ─────────────────────────────────────────────
  // Every `this.state = ...` in the class flows through one of these. Each one
  // sets all fields the target state relies on and clears the rest.

  private becomeHome(): void {
    this.state = "home";
    this.prevSpeed = 0;
    this.pendingRoute = null;
  }

  private becomeToWork(route: Cell[]): void {
    this.state = "toWork";
    this.prevSpeed = 0;
    this.carriesLoad = false;
    this.pendingRoute = null;
    this.setRoute(route);
    this.railState = {
      rail: this.buildWorkplaceAwareRoadRail(route, "arrival"),
      index: 0,
      t: 0,
    };
  }

  private becomeParking(rail: Pixel[]): void {
    this.state = "parking";
    this.railState = { rail, index: 0, t: 0 };
    this.prevSpeed = Math.min(this.prevSpeed, 0.16);
    this.pendingRoute = null;
  }

  private becomeAtWork(): void {
    this.state = "atWork";
    const heading = this.workplace.getBayHeading(this);
    this.dx = heading.x * 0.001;
    this.dy = heading.y * 0.001;
    this.carriesLoad = true;
    this.officeTimer = 1;
    this.prevSpeed = 0;
  }

  private becomeUnparking(exitRail: Pixel[], pendingRoute: Cell[]): void {
    this.state = "unparking";
    this.railState = { rail: exitRail, index: 0, t: 0 };
    this.pendingRoute = pendingRoute;
    this.officeTimer = 0;
    this.prevSpeed = 0;
  }

  private becomeToHome(
    route: Cell[],
    opts: { fromWorkplaceDriveway?: boolean; smooth?: boolean } = {},
  ): void {
    this.state = "toHome";
    this.pendingRoute = null;
    this.setRoute(route);
    if (opts.fromWorkplaceDriveway) {
      this.railState = {
        rail: this.buildWorkplaceAwareRoadRail(route, "departure"),
        index: 0,
        t: 0,
      };
    } else if (opts.smooth) {
      this.railState = this.buildTransitionRail(route);
      // prevSpeed preserved — caller wants a momentum-preserving transition.
    } else {
      this.railState = newRail(route);
      this.prevSpeed = 0;
    }
  }

  private turnHome() {
    // Invariant: `isStreetStillNeeded` guarantees every active commuter has a viable home
    // path, so findRoute here cannot fail. A missing homeRoute would mean a violated invariant.
    const homeRoute = findRoute({
      from: this.route[0]!,
      to: [this.parent! as unknown as Cell],
    });
    if (!homeRoute) {
      console.warn("turnHome: invariant violated — no route home");
      return;
    }
    this.unassignFromWorkplace();
    this.becomeToHome(homeRoute, { smooth: true });
  }

  /** Double-click rescue: unstick the car and return its destination in SVG px for the indicator. */
  reactivate(): { destX: number; destY: number } | null {
    if (this.state === "home") return null;

    // Capture destination BEFORE state may change
    const isHeadingHome = this.state === "toHome";
    const destCell: Cell = isHeadingHome
      ? (this.parent as unknown as Cell)
      : (this.destination ?? (this.workplace as unknown as Cell));

    // Unstick / reactivate based on current state
    if (this.state === "toWork" || this.state === "toHome") {
      this.rerouteIfBetter();
    } else if (this.state === "atWork") {
      this.officeTimer = 121;
    } else if (this.state === "unparking" && this.pendingRoute?.length) {
      // Refresh the planned route so the rail-exit transition uses the latest streets.
      const fresh = findRoute({
        from: this.pendingRoute[0]!,
        to: [this.parent! as unknown as Cell],
      });
      if (fresh) this.pendingRoute = fresh;
    } else if (this.state === "parking" && this.railState.rail.length <= 1) {
      // Bays-full deadlock: escape to home from destination cell
      const homeRoute = findRoute({
        from: this.destination!,
        to: [this.parent! as unknown as Cell],
      });
      if (homeRoute) {
        this.workplace.releaseParkingLane(this);
        this.workplace.leaveBay(this);
        this.becomeToHome(homeRoute);
      }
    }

    const { x: destX, y: destY } = toSvgPoint(destCell);
    return { destX, destY };
  }

  rerouteIfBetter() {
    if (this.state === "unparking" && this.pendingRoute?.length) {
      const homeCell = this.parent! as unknown as Cell;
      const newRoute =
        findRoute({
          from: this.pendingRoute[0]!,
          to: [homeCell],
          avoidPending: true,
        }) ?? findRoute({ from: this.pendingRoute[0]!, to: [homeCell] });
      if (newRoute) this.pendingRoute = newRoute;
      return;
    }
    if (this.state !== "toWork" && this.state !== "toHome") return;
    if (!this.route.length || !this.destination) return;

    const homeCell = this.parent! as unknown as Cell;
    const currentRouteCrossesPending = routeCrossesPending(this.route);
    if (currentRouteCrossesPending && this.state === "toWork") {
      const workRoute = findRoute({
        from: this.route[0]!,
        to: [this.destination],
        avoidPending: true,
      });
      if (workRoute) {
        if (!sameRoute(workRoute, this.route)) this.smoothReroute(workRoute);
        return;
      }

      const homeRoute =
        findRoute({
          from: this.route[0]!,
          to: [homeCell],
          avoidPending: true,
        }) ?? findRoute({ from: this.route[0]!, to: [homeCell] });
      if (homeRoute) {
        this.unassignFromWorkplace();
        this.becomeToHome(homeRoute, { smooth: true });
      }
      return;
    }

    const to = this.state === "toHome" ? [homeCell] : [this.destination];

    const newRoute =
      findRoute({
        from: this.route[0]!,
        to,
        avoidPending: currentRouteCrossesPending,
      }) ??
      (currentRouteCrossesPending
        ? findRoute({ from: this.route[0]!, to })
        : undefined);
    if (!newRoute) return;
    if (sameRoute(newRoute, this.route)) return;
    this.smoothReroute(newRoute);
  }

  render() {
    renderCommuter(this);
  }

  update() {
    // atWork→unparking cascades into the rail tick the same frame.
    // A completed rail tick (parking→atWork or unparking→toHome) yields the rest of the frame
    // — driving picks up next tick to match the original phase boundaries.
    if (this.state === "atWork") this.tickAtWork();
    if (this.state === "parking" || this.state === "unparking") {
      if (this.tickRail()) return;
    }
    if (this.state === "toWork" || this.state === "toHome") this.tickDriving();
  }

  // ─── Office timer + leaving the bay ───────────────────────────────────

  private tickAtWork(): void {
    this.officeTimer++;
    if (this.officeTimer <= PARKING_WAIT_TICKS) return;
    if (!this.workplace.isParkingLaneClearFor(this)) {
      this.officeTimer = 121;
      return;
    }

    const route =
      findRoute({
        from: this.destination!,
        to: [this.parent! as unknown as Cell],
        avoidPending: true,
      }) ??
      findRoute({
        from: this.destination!,
        to: [this.parent! as unknown as Cell],
      });
    if (!route) {
      this.officeTimer = Math.random() * 40 + 40;
      return;
    }
    this.beginUnparking(route);
  }

  private remainingRailDistance(): number {
    if (this.railState.rail.length <= 1) return 0;

    let distance = 0;
    const start = this.railState.rail[this.railState.index];
    const next = this.railState.rail[this.railState.index + 1];
    if (start && next) {
      const current = {
        x: start.x + (next.x - start.x) * this.railState.t,
        y: start.y + (next.y - start.y) * this.railState.t,
      };
      distance += Math.hypot(next.x - current.x, next.y - current.y);
    }

    for (
      let i = this.railState.index + 1;
      i < this.railState.rail.length - 1;
      i++
    ) {
      const a = this.railState.rail[i]!;
      const b = this.railState.rail[i + 1]!;
      distance += Math.hypot(b.x - a.x, b.y - a.y);
    }
    return distance;
  }

  private beginUnparking(route: Cell[]): void {
    const exitRail = this.workplace.getExitRail(this);
    this.workplace.leaveBay(this);
    if (exitRail) this.becomeUnparking(exitRail, route);
    else this.becomeToHome(route);
  }

  // ─── Bay rail (parking + unparking) ───────────────────────────────────

  /** Returns true if the rail completed this tick (and the caller should yield the frame). */
  private tickRail(): boolean {
    if (this.railState.rail.length <= 1) {
      // Parking with no rail is a deadlock (e.g. a bay-allocation race or a silent graph
      // change under a parking car). Release the bay and escape home if we can.
      if (this.state === "parking" && this.destination) {
        const homeRoute = findRoute({
          from: this.destination,
          to: [this.parent! as unknown as Cell],
        });
        if (homeRoute) {
          this.workplace.releaseParkingLane(this);
          this.workplace.leaveBay(this);
          this.becomeToHome(homeRoute);
          return true;
        }
      }
      return false;
    }

    const progress = clamp01(
      (this.railState.index + this.railState.t) /
        Math.max(1, this.railState.rail.length - 1),
    );
    const ramp =
      smoothstep(clamp01(progress / 0.26)) *
      smoothstep(clamp01((1 - progress) / 0.26));
    const curvature = getRailCurvature(
      this.railState.rail,
      this.railState.index,
      10,
    );
    const curveLimit =
      curvature > 0.75
        ? 0.06
        : curvature > 0.45
          ? 0.075
          : curvature > 0.24
            ? 0.1
            : 0.135;
    const targetSpeed = Math.min(0.05 + 0.09 * ramp, curveLimit);
    const alpha = targetSpeed < this.prevSpeed ? 0.1 : 0.045;
    this.prevSpeed += (targetSpeed - this.prevSpeed) * alpha;
    const speed = Math.min(0.16, Math.max(0.035, this.prevSpeed));

    const result = advanceOnRail(this.railState, speed);
    this.x = result.x;
    this.y = result.y;

    if (!result.done) {
      this.dx = result.dx;
      this.dy = result.dy;
      return false;
    }

    if (this.state === "parking") {
      this.workplace.releaseParkingLane(this);
      this.becomeAtWork();
      this.workplace.commuterArrived();
    } else if (this.pendingRoute) this.finishUnparking();
    return true;
  }

  private finishUnparking(): void {
    this.workplace.releaseParkingLane(this);
    // Streets may have been removed during unparking — re-route from the rail's exit
    // before committing, falling back to the stale route only if no path exists.
    const fresh =
      findRoute({
        from: this.pendingRoute![0]!,
        to: [this.parent! as unknown as Cell],
        avoidPending: true,
      }) ??
      findRoute({
        from: this.pendingRoute![0]!,
        to: [this.parent! as unknown as Cell],
      });
    this.becomeToHome(fresh ?? this.pendingRoute!, {
      fromWorkplaceDriveway: true,
    });
  }

  // ─── Open-road driving (toWork + toHome) ──────────────────────────────

  private tickDriving(): void {
    this.consumeReachedCells();

    let targetSpeed = computeTargetSpeed(this);
    if (this.state === "toWork") {
      const remaining = this.remainingRailDistance();
      const approach = 1 - smoothstep(clamp01((remaining - 2) / 12));
      targetSpeed = Math.min(targetSpeed, 0.12 + 0.16 * (1 - approach));
    }
    smoothSpeed(this, targetSpeed);

    const result = advanceOnRail(this.railState, this.prevSpeed);
    this.x = result.x;
    this.y = result.y;
    this.dx = result.dx;
    this.dy = result.dy;

    if (result.done) this.arriveAtDestination();
  }

  private consumeReachedCells(): void {
    while (this.route.length > 1) {
      const cell = toSvgPoint(this.route[0]!);
      const cdx = this.x - cell.x,
        cdy = this.y - cell.y;
      const dist2 = cdx * cdx + cdy * cdy;
      const ahead = cdx * this.dx + cdy * this.dy;
      if (dist2 < 9 || (ahead > 0 && dist2 < 25)) {
        this.lastTraversed = this.route.shift()!;
      } else break;
    }
  }

  private arriveAtDestination(): void {
    if (this.state === "toHome") {
      this.becomeHome();
      return;
    }
    // toWork: try to claim a parking bay.
    this.workplace.parkInBay(this);
    const parkingRail = this.workplace.getParkingRail(this);
    this.unassignFromWorkplace();
    if (parkingRail) {
      this.becomeParking(parkingRail);
    } else {
      // All bays occupied — head home without parking.
      this.workplace.releaseParkingLane(this);
      this.workplace.leaveBay(this);
      const homeRoute = findRoute({
        from: this.destination!,
        to: [this.parent! as unknown as Cell],
      });
      if (homeRoute) this.becomeToHome(homeRoute);
      else this.becomeHome();
    }
  }
}

export const rerouteAllCommuters = (forceAtWork = true): void => {
  for (const commuter of commuters) {
    if (commuter.state === "atWork") {
      if (forceAtWork) commuter.officeTimer = 121;
    } else {
      commuter.rerouteIfBetter();
    }
  }
};
