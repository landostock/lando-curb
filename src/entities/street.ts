import { GameObjectClass } from "kontra";

import { removeStreet, trees } from "../state";
import type { Cell } from "../types";
import { samePoint } from "../util/geometry";
import { fadeOutStreetSvgs } from "./street.render";

interface StreetPoint extends Cell {
  locked?: boolean;
}

export class Street extends GameObjectClass {
  declare points: [start: StreetPoint, end: StreetPoint];
  declare noConnect: boolean;
  declare motorway: boolean;
  declare bridge: boolean;
  pendingRemoval = false;

  constructor(properties: Record<string, unknown>) {
    super(properties);

    // Trees on this street's cells get knocked down.
    trees
      .filter((t) => this.points.some((p) => samePoint(p, t)))
      .forEach((tree) => tree.remove());
  }

  markPendingRemoval() {
    if (this.points.some((p) => p.locked)) return;
    this.pendingRemoval = true;
  }

  remove() {
    fadeOutStreetSvgs(this);
    removeStreet(this);
  }
}
