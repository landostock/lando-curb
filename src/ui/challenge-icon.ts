import type { RuleChallengeId } from "../challenge";
import { createSvgElement } from "../gfx/svg-utils";

interface ChallengeIconOptions {
  rail?: boolean;
  size: number;
  stroke?: string;
  strokeWidth?: number;
}

type SvgAttrs = Record<string, number | string>;
type SvgParent = SVGElement;

const setAttrs = (element: SVGElement, attrs: SvgAttrs): void => {
  for (const [key, value] of Object.entries(attrs)) {
    element.setAttribute(key, String(value));
  }
};

const appendPath = (
  parent: SvgParent,
  d: string,
  attrs: SvgAttrs = {},
): void => {
  const path = createSvgElement("path");
  path.setAttribute("d", d);
  setAttrs(path, attrs);
  parent.append(path);
};

const appendLine = (
  parent: SvgParent,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  attrs: SvgAttrs = {},
): void => {
  const line = createSvgElement("line");
  setAttrs(line, { x1, y1, x2, y2, ...attrs });
  parent.append(line);
};

const appendRect = (
  parent: SvgParent,
  x: number,
  y: number,
  width: number,
  height: number,
  attrs: SvgAttrs = {},
): void => {
  const rect = createSvgElement("rect");
  setAttrs(rect, { x, y, width, height, ...attrs });
  parent.append(rect);
};

const appendRail = (parent: SvgParent): void => {
  appendLine(parent, 4.3, 5.1, 4.3, 18.9, { "stroke-width": 2.05 });
};

const drawIcon = (svg: SvgParent, id: RuleChallengeId): void => {
  switch (id) {
    case "tripleSpeed":
      appendPath(svg, "M12.9 4.9 8.4 12h3.1l-1.2 7.1 5.4-8.8h-3.2z", {
        "stroke-width": 2.05,
      });
      return;
    case "noDelete":
      appendLine(svg, 8.4, 8, 17.4, 8, { "stroke-width": 1.85 });
      appendPath(svg, "M10.3 8V6.4h5.2V8", { "stroke-width": 1.85 });
      appendPath(svg, "M9.6 10.2 10.2 17.6h5.6l.6-7.4", {
        "stroke-width": 1.85,
      });
      appendLine(svg, 12, 12.1, 12, 15.5, { "stroke-width": 1.25 });
      appendLine(svg, 14, 12.1, 14, 15.5, { "stroke-width": 1.25 });
      return;
    case "autoRoads":
      appendLine(svg, 7.4, 17.25, 11.35, 17.25, { "stroke-width": 2.05 });
      appendLine(svg, 9.38, 15.25, 9.38, 19.25, { "stroke-width": 2.05 });
      appendPath(
        svg,
        "M17.45 5.45h-2.35c-2.25 0-3.25 1-3.25 2.25s1 2.25 3.25 2.25h1.05c2.25 0 3.25.98 3.25 2.25s-1 2.25-3.25 2.25h-1.3",
        { "stroke-width": 2.25 },
      );
      return;
    case "tinyBudget":
      appendPath(svg, "M9.3 9.7 15.5 7.4l1.2 2.3", { "stroke-width": 1.75 });
      appendPath(
        svg,
        "M9.4 9.5h7.7a2 2 0 0 1 2 2v4.2a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2v-3.9a2.3 2.3 0 0 1 2.3-2.3Z",
        { "stroke-width": 1.95 },
      );
      appendLine(svg, 15.7, 13.6, 18.3, 13.6, { "stroke-width": 1.7 });
      return;
    case "noIntersections":
      appendLine(svg, 12.4, 6.7, 12.4, 17.3, { "stroke-width": 2.45 });
      appendLine(svg, 8, 12, 17.5, 12, { "stroke-width": 2.45 });
      appendLine(svg, 8.6, 7.6, 16.5, 16.5, { "stroke-width": 1.8 });
      return;
    case "noPause":
      appendLine(svg, 10.5, 6.9, 10.5, 17.1, { "stroke-width": 2.15 });
      appendLine(svg, 15, 6.9, 15, 17.1, { "stroke-width": 2.15 });
      appendLine(svg, 8.1, 15.8, 17.4, 8.2, { "stroke-width": 1.95 });
      return;
    case "colorLock":
      appendRect(svg, 9.1, 8.2, 3.5, 3.5, {
        rx: 0.7,
        "stroke-width": 1.8,
      });
      appendRect(svg, 14.4, 13.5, 3.5, 3.5, {
        rx: 0.7,
        "stroke-width": 1.8,
      });
      appendLine(svg, 12.6, 11.7, 14.4, 13.5, { "stroke-width": 1.65 });
      return;
  }
};

export const createChallengeIcon = (
  id: RuleChallengeId,
  {
    rail = false,
    size,
    stroke = "currentColor",
    strokeWidth = 2,
  }: ChallengeIconOptions,
): SVGSVGElement => {
  const iconSvg = createSvgElement("svg");
  iconSvg.setAttribute("viewBox", "0 0 24 24");
  iconSvg.setAttribute("width", String(size));
  iconSvg.setAttribute("height", String(size));
  iconSvg.setAttribute("aria-hidden", "true");
  iconSvg.setAttribute("fill", "none");
  iconSvg.setAttribute("stroke", stroke);
  iconSvg.setAttribute("stroke-width", String(strokeWidth));
  iconSvg.setAttribute("stroke-linecap", "round");
  iconSvg.setAttribute("stroke-linejoin", "round");
  iconSvg.style.display = "block";

  const glyph = createSvgElement("g");
  if (rail) {
    const railGroup = createSvgElement("g");
    railGroup.setAttribute("transform", "translate(-2.15 0)");
    iconSvg.append(railGroup);
    appendRail(railGroup);
    glyph.setAttribute("transform", "translate(-0.75 0)");
  }
  iconSvg.append(glyph);
  drawIcon(glyph, id);

  return iconSvg;
};
