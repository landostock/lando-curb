import { GameObjectClass } from "kontra";

import { playAppearChime } from "../audio";
import { challengeDisablesDelete } from "../challenge";
import { colors } from "../gfx/colors";
import { baseLayer, houseLayer, houseShadowLayer } from "../gfx/layers";
import { createSvgElement, toSvgPoint } from "../gfx/svg-utils";
import { streetWouldMixColors } from "../logic/color-lock";
import {
  findRoute,
  streetMatchesEdge,
  updateGridData,
} from "../logic/find-route";
import { streetWouldCreateIntersection } from "../logic/intersections";
import { commitStreetChanges } from "../logic/orchestrator";
import { cellInLake, cellIsBlocked } from "../logic/placement-obstacles";
import { isStreetEdge } from "../logic/street-edge";
import {
  addCommuter,
  addStreet,
  houses,
  removeCommuter,
  removeHouse,
  removeStreet,
  streets,
} from "../state";
import type { Cell, Direction } from "../types";
import { Commuter } from "./commuter";
import { Street } from "./street";
import { drawStreets } from "./street.render";

export class House extends GameObjectClass {
  startPath?: Street;
  declare facing: Direction;
  declare type: string;
  declare style: string;
  homeActionHold = false;
  svgGroup!: SVGGElement;
  shadow!: SVGRectElement;
  private baseShadow?: SVGCircleElement;
  private roof?: SVGRectElement;
  private streetDrawTimer?: ReturnType<typeof setTimeout>;
  private commuterSpawnTimer?: ReturnType<typeof setTimeout>;
  private removed = false;

  private get svgPos() {
    return toSvgPoint(this);
  }

  constructor(properties: {
    x: number;
    y: number;
    facing: Direction;
    type: string;
    style?: string;
    [key: string]: unknown;
  }) {
    super(properties);
    this.style = properties.style ?? "default";

    this.streetDrawTimer = setTimeout(() => {
      if (this.removed) return;
      drawStreets({ noShadow: true });
    }, 1000);

    this.commuterSpawnTimer = setTimeout(() => {
      if (this.removed) return;
      const c1 = new Commuter({ x: this.x, y: this.y, parent: this });
      const c2 = new Commuter({ x: this.x, y: this.y, parent: this });
      addCommuter(c1);
      addCommuter(c2);
      this.children.push(c1, c2);
      c1.addToSvg();
      c2.addToSvg();
    }, 2000);

    this.addToSvg();
  }

  private retireStartPath(street: Street): void {
    street.pendingRemoval = true;
  }

  private findRetiredStartPath(houseCell: Cell, targetCell: Cell): Street | undefined {
    return streets.find(
      (street) =>
        street.pendingRemoval && streetMatchesEdge(street, houseCell, targetCell),
    );
  }

  rotateTo(x: number, y: number): boolean {
    const oldStartPath = this.startPath;

    // No-op guard.
    if (oldStartPath && x === this.x + this.facing.x && y === this.y + this.facing.y)
      return false;

    if (oldStartPath && challengeDisablesDelete()) return false;

    const houseCell = { x: this.x, y: this.y } as Cell;
    const targetCell = { x, y } as Cell;
    if (!isStreetEdge(houseCell, targetCell)) return false;

    // Target-cell validation — rotation must point to a placeable cell.
    if (cellIsBlocked(targetCell)) return false;
    if (cellInLake(targetCell)) return false;
    if (houses.some((h) => h !== this && h.x === x && h.y === y))
      return false;

    const replacedPaths = oldStartPath ? [oldStartPath] : [];
    if (streetWouldCreateIntersection(houseCell, targetCell, replacedPaths)) {
      return false;
    }
    if (streetWouldMixColors(houseCell, targetCell, replacedPaths)) {
      return false;
    }

    const retiredStartPath = this.findRetiredStartPath(houseCell, targetCell);
    const stagedNew =
      retiredStartPath ??
      new Street({
        points: [
          { x: this.x, y: this.y, locked: true },
          { x, y, locked: true },
        ],
      });
    if (retiredStartPath) retiredStartPath.pendingRemoval = false;
    else addStreet(stagedNew);

    // If any commuter is currently outside home, first verify that rotation is viable
    // with both driveways in the graph, then keep the old driveway only when it is the
    // only remaining way home.
    const activeCommuters = this.children.filter(
      (c): c is Commuter => c instanceof Commuter && c.state !== "home",
    );

    let oldStartPathStillNeeded = false;
    if (activeCommuters.length) {
      updateGridData();

      const canReachHome = (child: Commuter, exclude?: Street): boolean => {
        if (child.state === "toHome" && child.route[0]) {
          return !!findRoute({ from: child.route[0], to: [houseCell], exclude });
        }
        if (child.state === "unparking" && child.pendingRoute?.[0]) {
          return !!findRoute({
            from: child.pendingRoute[0],
            to: [houseCell],
            exclude,
          });
        }
        if (child.destination) {
          return !!findRoute({ from: child.destination, to: [houseCell], exclude });
        }
        return true;
      };

      const viable = activeCommuters.every((child) => {
        const workCells = child.workplace.points;

        // toWork: must still reach the workplace AND be able to get home from there.
        // child.destination is the specific connected park cell routed to at dispatch —
        // workCells[0] is the top-left park cell, which often has no street connections.
        if (child.state === "toWork") {
          if (!child.route[0] || !child.destination) return true;
          return (
            !!findRoute({ from: child.route[0], to: workCells }) &&
            canReachHome(child)
          );
        }

        return canReachHome(child);
      });

      if (!viable) {
        if (retiredStartPath) retiredStartPath.pendingRemoval = true;
        else removeStreet(stagedNew);
        updateGridData();
        return false;
      }

      oldStartPathStillNeeded = activeCommuters.some(
        (child) => oldStartPath !== undefined && !canReachHome(child, oldStartPath),
      );
    }

    this.facing = { x: x - this.x, y: y - this.y } as Direction;
    this.startPath = stagedNew;
    if (oldStartPath && oldStartPathStillNeeded) this.retireStartPath(oldStartPath);
    else oldStartPath?.remove();
    commitStreetChanges(false, { noShadow: true });
    return true;
  }

  addToSvg() {
    const { x, y } = this.svgPos;

    const baseShadow = createSvgElement("circle");
    baseShadow.setAttribute("fill", colors.shade);
    baseShadow.setAttribute("r", String(0));
    baseShadow.setAttribute("stroke", "none");
    baseShadow.setAttribute("transform", `translate(${x},${y})`);
    baseShadow.style.willChange = `r, opacity`;
    baseShadow.style.opacity = "0";
    baseShadow.style.transition = `all .4s`;
    baseLayer.append(baseShadow);
    this.baseShadow = baseShadow;
    setTimeout(() => {
      baseShadow.setAttribute("r", String(3));
      baseShadow.style.opacity = "1";
    }, 100);
    setTimeout(() => (baseShadow.style.willChange = ""), 600);

    this.svgGroup = createSvgElement("g");
    houseLayer.append(this.svgGroup);

    const isPlattenbau = this.style === "plattenbau";
    const dim = isPlattenbau
      ? { x: -3, y: -2.4, w: 6, h: 4.8, rx: 0.3 }
      : { x: -2.8, y: -2.8, w: 5.6, h: 5.6, rx: 0.6 };

    // Roof — top-down colored rectangle (what you see from above)
    const roof = createSvgElement("rect");
    roof.setAttribute("x", String(dim.x));
    roof.setAttribute("y", String(dim.y));
    roof.setAttribute("width", String(dim.w));
    roof.setAttribute("height", String(dim.h));
    roof.setAttribute("rx", String(dim.rx));
    roof.setAttribute("fill", isPlattenbau ? colors.plattenbau : this.type);
    roof.style.transition = "fill .45s ease";
    this.roof = roof;

    this.svgGroup.style.willChange = "transform";
    this.svgGroup.style.transition = "transform .4s cubic-bezier(.5,2,.5,1)";
    this.svgGroup.style.transform = `translate(${x}px,${y}px) scale(0)`;

    if (isPlattenbau) {
      // Plattenbau: flat roof, subtle horizontal lines instead of ridge
      const lines = createSvgElement("path");
      lines.setAttribute("d", "M-2.5 -0.8h5M-2.5 0.8h5");
      lines.setAttribute("stroke", colors.black);
      lines.setAttribute("stroke-width", String(0.25));
      lines.setAttribute("stroke-linecap", "round");
      lines.setAttribute("opacity", String(0.08));
      this.svgGroup.append(roof, lines);
    } else {
      // Ridge shadow — darker line across center suggesting roof depth
      const ridge = createSvgElement("path");
      ridge.setAttribute("d", "M-2.8 0h5.6");
      ridge.setAttribute("stroke", colors.black);
      ridge.setAttribute("stroke-width", String(0.5));
      ridge.setAttribute("stroke-linecap", "round");
      ridge.setAttribute("opacity", String(0.15));
    this.svgGroup.append(roof, ridge);
    }

    setTimeout(() => {
      playAppearChime();
      this.svgGroup.style.transform = `translate(${x}px,${y}px) scale(1)`;
    }, 400);
    setTimeout(() => (this.svgGroup.style.willChange = ""), 900);

    // Soft offset shadow — matches roof shape, offset down-right
    this.shadow = createSvgElement("rect");
    this.shadow.setAttribute("x", String(dim.x));
    this.shadow.setAttribute("y", String(dim.y));
    this.shadow.setAttribute("width", String(dim.w));
    this.shadow.setAttribute("height", String(dim.h));
    this.shadow.setAttribute("rx", String(dim.rx));
    this.shadow.setAttribute("fill", colors.black);
    this.shadow.setAttribute("stroke", "none");
    this.shadow.style.transform = `translate(${x}px,${y}px)`;
    this.shadow.style.opacity = "0";
    this.shadow.style.willChange = "opacity, transform";
    this.shadow.style.transition = "opacity .4s, transform .6s";
    houseShadowLayer.append(this.shadow);
    setTimeout(() => {
      this.shadow.style.opacity = "1";
      this.shadow.style.transform = `translate(${x + 1}px,${y + 1}px)`;
    }, 800);
    setTimeout(() => (this.shadow.style.willChange = ""), 1500);
  }

  lift() {
    const { x, y } = this.svgPos;

    this.shadow.style.transition = "transform .2s";
    this.shadow.style.transform = `translate(${x + 1.5}px,${y + 1.5}px)`;

    this.svgGroup.style.transition = "transform .2s";
    this.svgGroup.style.transform = `translate(${x}px,${y}px) scale(1.1)`;
  }

  place() {
    const { x, y } = this.svgPos;

    this.shadow.style.transition = "transform .3s";
    this.shadow.style.transform = `translate(${x + 1}px,${y + 1}px)`;

    this.svgGroup.style.transition = "transform .3s";
    this.svgGroup.style.transform = `translate(${x}px,${y}px) scale(1)`;
  }

  setType(type: string): void {
    this.type = type;
    if (this.style !== "plattenbau") this.roof?.setAttribute("fill", type);
    for (const child of this.children) {
      if (!(child instanceof Commuter)) continue;
      child.type = type;
      child.svgElement.querySelector("rect")?.setAttribute("fill", type);
    }
  }

  remove(): void {
    this.removed = true;
    clearTimeout(this.streetDrawTimer);
    clearTimeout(this.commuterSpawnTimer);
    for (const child of [...this.children]) {
      if (!(child instanceof Commuter)) continue;
      child.svgElement.remove();
      removeCommuter(child);
    }
    this.children.length = 0;
    this.startPath?.remove();
    this.svgGroup.remove();
    this.shadow.remove();
    this.baseShadow?.remove();
    removeHouse(this);
  }
}
