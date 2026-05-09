import { colors } from "../gfx/colors";
import { treeLayer } from "../gfx/layers";
import { createSvgElement, toSvgEdge, toSvgPoint } from "../gfx/svg-utils";
import { updateGridData } from "../logic/find-route";
import { addStreet } from "../state";
import type { Cell } from "../types";
import { Street } from "./street";

export const spawnBoulevard = (waypoints: Cell[]): void => {
  // Create normal Street objects (locked = can't be removed by player)
  // They participate in the connection system so commuters can route onto them
  for (let i = 0; i < waypoints.length - 1; i++) {
    addStreet(
      new Street({
        points: [
          { x: waypoints[i]!.x, y: waypoints[i]!.y, locked: true },
          { x: waypoints[i + 1]!.x, y: waypoints[i + 1]!.y, locked: true },
        ],
      }),
    );
  }
  updateGridData();

  // Tree dots along each side
  for (let i = 0; i < waypoints.length; i++) {
    const wp = waypoints[i]!;
    const { x: sx, y: sy } = toSvgPoint(wp);

    // Determine perpendicular direction for tree offset
    let dx = 0,
      dy = 0;
    if (i < waypoints.length - 1) {
      dx = waypoints[i + 1]!.x - wp.x;
      dy = waypoints[i + 1]!.y - wp.y;
    } else {
      dx = wp.x - waypoints[i - 1]!.x;
      dy = wp.y - waypoints[i - 1]!.y;
    }
    // Perpendicular: rotate 90deg
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const px = (-dy / len) * toSvgEdge(0.4);
    const py = (dx / len) * toSvgEdge(0.4);

    for (const side of [-1, 1]) {
      const tree = createSvgElement("circle");
      tree.setAttribute("cx", String(sx + px * side));
      tree.setAttribute("cy", String(sy + py * side));
      tree.setAttribute("r", String(0.8));
      tree.setAttribute("fill", colors.leaf);
      treeLayer.append(tree);
    }
  }
};
