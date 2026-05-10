import { playRoadPop } from "../audio";
import { session, streets } from "../state";
import type { Cell } from "../types";
import {
  developerMode,
  motorwayIndicatorCount,
} from "../ui/ui";
import { streetMatchesEdge } from "./find-route";
import { commitStreetChanges } from "./orchestrator";

export type MotorwayUpgradeResult =
  | "upgraded"
  | "missing"
  | "already"
  | "bridge"
  | "exhausted";

export const findStreetForMotorway = (a: Cell, b: Cell) =>
  streets.find((street) => streetMatchesEdge(street, a, b));

export const upgradeStreetToMotorway = (
  a: Cell,
  b: Cell,
): MotorwayUpgradeResult => {
  const street = findStreetForMotorway(a, b);
  if (!street) return "missing";
  if (street.motorway) return "already";
  if (street.bridge) return "bridge";
  if (!developerMode && session.motorways <= 0) return "exhausted";

  street.motorway = true;
  if (!developerMode) {
    session.motorways--;
    motorwayIndicatorCount.innerText = String(session.motorways);
  }

  commitStreetChanges();
  playRoadPop({ motorway: true });
  return "upgraded";
};
