import { colors } from "../gfx/colors";
import {
  motorwayDashLayer,
  streetLayer,
  streetShadowLayer,
} from "../gfx/layers";
import {
  createSvgElement,
  svgLineTo,
  svgMoveTo,
  svgQuadTo,
} from "../gfx/svg-utils";
import { streets } from "../state";
import type { Cell, Point } from "../types";
import { samePoint } from "../util/geometry";
import type { Street } from "./street";

interface Connection {
  path1: Street;
  path2: Street;
  points: [outer1: Cell, shared: Cell, outer2: Cell];
}

interface StreetData {
  path?: Street;
  path1?: Street;
  path2?: Street;
  d: string;
  svgElement?: SVGElement;
  svgElementShadow?: SVGElement;
  svgDash?: SVGElement;
}

let connections: Connection[] = [];
let streetsData: StreetData[] = [];
let recentlyRemoved: Cell[] = [];

const midpoint = (a: Point, b: Point): Point => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

const isPending = (sd: StreetData): boolean =>
  !!sd.path?.pendingRemoval ||
  !!sd.path1?.pendingRemoval ||
  !!sd.path2?.pendingRemoval;

const isMotorwayData = (sd: StreetData): boolean =>
  !!sd.path?.motorway || !!sd.path1?.motorway || !!sd.path2?.motorway;

const isBridgeData = (sd: StreetData): boolean =>
  !!sd.path?.bridge || !!sd.path1?.bridge || !!sd.path2?.bridge;

const MOTORWAY_DASH_WIDTH = 0.6;

const applyStreetStyle = (
  el: SVGElement,
  _shadowEl: SVGElement | undefined,
  motorway: boolean,
  bridge: boolean,
): void => {
  // Motorways share the street layer's default stroke-width (3.14) — identical
  // footprint to regular roads so junctions read as seamless; color + center
  // dash are the only distinguishing marks.
  el.removeAttribute("stroke-width");
  el.setAttribute(
    "stroke",
    motorway ? colors.motorway : bridge ? colors.bridge : colors.road,
  );
};

export const drawStreets = ({
  fadeout,
  noShadow,
}: { fadeout?: boolean; noShadow?: boolean } = {}) => {
  connections = [];

  streets.forEach((path1) => {
    streets.forEach((path2) => {
      if (path1 === path2) return;
      if (connections.some((c) => c.path1 === path2 && c.path2 === path1))
        return;
      if (path1.noConnect || path2.noConnect) return;
      // Bridges should not visually merge with regular roads — render each side
      // with its own kind so the bridge color stops at the water's edge. Coerce to bool:
      // unset `bridge` (undefined on house/BP/boulevard startPaths) is NOT a bridge.
      if (!!path1.bridge !== !!path2.bridge) return;

      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
          if (samePoint(path1.points[i]!, path2.points[j]!)) {
            connections.push({
              path1,
              path2,
              points: [
                path1.points[1 - i]!,
                path1.points[i]!,
                path2.points[1 - j]!,
              ],
            });
          }
        }
      }
    });
  });

  const newStreetsData: StreetData[] = [];

  connections.forEach(({ path1, path2, points }) => {
    const [outer1, shared, outer2] = points;

    const mid = midpoint(outer1, shared);
    const curveEnd = midpoint(shared, outer2);

    const moveToStart = svgMoveTo(outer1);
    const lineToMid = svgLineTo(mid);
    const lineToEnd = svgLineTo(outer2);
    const curve = svgQuadTo(shared, curveEnd);

    const isOuter1Junction = connections.some((c) =>
      samePoint(outer1, c.points[1]),
    );
    const isOuter2Junction = connections.some((c) =>
      samePoint(outer2, c.points[1]),
    );

    const start = isOuter1Junction
      ? svgMoveTo(mid)
      : `${moveToStart}${lineToMid}`;
    const end = isOuter2Junction ? "" : lineToEnd;

    newStreetsData.push({ path1, path2, d: `${start}${curve}${end}` });
  });

  streets.forEach((path) => {
    const connected = connections.some(
      (c) => c.path1 === path || c.path2 === path,
    );

    if (!connected && !path.noConnect) {
      const [p0, p1] = path.points;
      newStreetsData.push({
        path,
        d: `${svgMoveTo(p0)}${svgLineTo(p1)}`,
      });
    }
  });

  // Pass 1: Reconcile existing SVG elements with new data
  newStreetsData.forEach((newStreetData) => {
    streetsData.forEach((oldStreetData) => {
      const samePath =
        newStreetData.path && newStreetData.path === oldStreetData.path;
      const samePath1 =
        newStreetData.path1 && newStreetData.path1 === oldStreetData.path1;
      const samePath2 =
        newStreetData.path2 && newStreetData.path2 === oldStreetData.path2;
      if (samePath || (samePath1 && samePath2)) {
        newStreetData.svgElement = oldStreetData.svgElement;
        newStreetData.svgElementShadow = oldStreetData.svgElementShadow;
        newStreetData.svgDash = oldStreetData.svgDash;

        if (newStreetData.d !== oldStreetData.d) {
          oldStreetData.d = newStreetData.d;
          newStreetData.svgElement!.setAttribute("d", newStreetData.d);
          if (newStreetData.svgDash)
            newStreetData.svgDash.setAttribute("d", newStreetData.d);
        }

        const opac = String(isPending(newStreetData) ? 0.3 : 1);
        newStreetData.svgElement!.setAttribute("opacity", opac);
        if (newStreetData.svgDash)
          newStreetData.svgDash.setAttribute("opacity", opac);

        const motorway = isMotorwayData(newStreetData);
        const bridge = isBridgeData(newStreetData);
        applyStreetStyle(
          newStreetData.svgElement!,
          newStreetData.svgElementShadow,
          motorway,
          bridge,
        );

        // Promote to motorway or demote — dash-only now; no wider edge.
        if (motorway && !newStreetData.svgDash) {
          newStreetData.svgDash = createSvgElement("path");
          newStreetData.svgDash.setAttribute("d", newStreetData.d);
          newStreetData.svgDash.setAttribute(
            "stroke-width",
            String(MOTORWAY_DASH_WIDTH),
          );
          newStreetData.svgDash.setAttribute("stroke-dasharray", "2 3");
          newStreetData.svgDash.style.transition = "all .4s, opacity .2s";
          motorwayDashLayer.append(newStreetData.svgDash);
        } else if (!motorway && newStreetData.svgDash) {
          newStreetData.svgDash.remove();
          newStreetData.svgDash = undefined;
        }
      }
    });
  });

  // Pass 2: Remove old path SVGs no longer present in the new data
  streetsData.forEach((oldStreetData) => {
    if (!newStreetsData.some((s) => oldStreetData.d === s.d)) {
      if (oldStreetData.path) {
        if (fadeout && oldStreetData.path.points[0].locked) {
          setTimeout(() => {
            oldStreetData.svgElement!.remove();
            oldStreetData.svgEdge?.remove();
            oldStreetData.svgDash?.remove();
          }, 500);
        } else {
          oldStreetData.svgElement!.remove();
          oldStreetData.svgEdge?.remove();
          oldStreetData.svgDash?.remove();
        }
      }
    }
  });

  // Pass 3: Create SVGs for new data entries
  newStreetsData.forEach((newStreetData) => {
    if (!newStreetData.svgElement) {
      newStreetData.svgElement = createSvgElement("path");
      newStreetData.svgElement.setAttribute("d", newStreetData.d);
      newStreetData.svgElement.style.transition = `all .4s, opacity .2s`;

      streetLayer.append(newStreetData.svgElement);

      const motorway = isMotorwayData(newStreetData);
      const bridge = isBridgeData(newStreetData);
      if (motorway) {
        newStreetData.svgElement.setAttribute("stroke", colors.motorway);
      } else if (bridge) {
        newStreetData.svgElement.setAttribute("stroke", colors.bridge);
      }

      // Motorway center dash — no wider edge, so widths match regular roads.
      if (motorway) {
        newStreetData.svgDash = createSvgElement("path");
        newStreetData.svgDash.setAttribute("d", newStreetData.d);
        newStreetData.svgDash.setAttribute("stroke-dasharray", "2 3");
        newStreetData.svgDash.style.transition = "all .4s, opacity .2s";
        motorwayDashLayer.append(newStreetData.svgDash);
      }

      // Only transition "new new" single paths
      const pathPoints = newStreetData.path?.points;
      const pathInSameCellRecentlyRemoved =
        pathPoints &&
        recentlyRemoved.some(
          (r) => samePoint(r, pathPoints[0]) || samePoint(r, pathPoints[1]),
        );

      if (newStreetData.path === undefined || !pathInSameCellRecentlyRemoved) {
        newStreetData.svgElement.setAttribute("stroke-width", String(0));
        newStreetData.svgElement.setAttribute("opacity", String(0));
        newStreetData.svgElement.style.willChange = `stroke-width, opacity`;

        if (motorway) {
          newStreetData.svgDash!.setAttribute("stroke-width", String(0));
          newStreetData.svgDash!.setAttribute("opacity", String(0));
          newStreetData.svgDash!.style.willChange = "stroke-width, opacity";
        }

        if (!noShadow) {
          newStreetData.svgElementShadow = createSvgElement("path");
          newStreetData.svgElementShadow.setAttribute("d", newStreetData.d);
          streetShadowLayer.append(newStreetData.svgElementShadow);

          // After transition complete, we don't need the shadow anymore
          setTimeout(() => {
            newStreetData.svgElementShadow?.remove();
            newStreetData.svgElement!.style.willChange = "";
            if (newStreetData.svgDash)
              newStreetData.svgDash.style.willChange = "";
          }, 500);
        }

        setTimeout(() => {
          newStreetData.svgElement!.removeAttribute("stroke-width");
          if (newStreetData.svgDash) {
            newStreetData.svgDash.setAttribute(
              "stroke-width",
              String(MOTORWAY_DASH_WIDTH),
            );
          }
          const opac = String(isPending(newStreetData) ? 0.3 : 1);
          newStreetData.svgElement!.setAttribute("opacity", opac);
          if (newStreetData.svgDash)
            newStreetData.svgDash.setAttribute("opacity", opac);
        }, 20);
      } else if (motorway) {
        newStreetData.svgElement.removeAttribute("stroke-width");
        newStreetData.svgDash!.setAttribute(
          "stroke-width",
          String(MOTORWAY_DASH_WIDTH),
        );
      }
    }
  });

  streetsData = [...newStreetsData];
  recentlyRemoved = [];
};

/** Called from `Street.remove()` — fades out the street's SVGs over 500 ms and notes its
 *  cells so subsequent player-draws in the same cells skip the appear-transition. */
export const fadeOutStreetSvgs = (street: Street): void => {
  streetsData = streetsData.filter((p) => {
    if (p.path === street || p.path1 === street || p.path2 === street) {
      p.svgElement!.setAttribute("opacity", String(0));
      p.svgElement!.setAttribute("stroke-width", String(0));
      if (p.svgEdge) {
        p.svgEdge.setAttribute("opacity", String(0));
        p.svgEdge.setAttribute("stroke-width", String(0));
      }
      if (p.svgDash) {
        p.svgDash.setAttribute("opacity", String(0));
        p.svgDash.setAttribute("stroke-width", String(0));
      }
      setTimeout(() => {
        p.svgElement!.remove();
        p.svgEdge?.remove();
        p.svgDash?.remove();
      }, 500);
      return false;
    }
    return true;
  });
  recentlyRemoved.push(...street.points);
};
