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

const majorStroke = 2.08;
const minorStroke = 1.55;

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
  appendLine(parent, 4.3, 5.1, 4.3, 18.9, { "stroke-width": majorStroke });
};

const drawIcon = (svg: SvgParent, id: RuleChallengeId): void => {
  switch (id) {
    case "tripleSpeed":
      appendPath(svg, "M13.4 4.6 8.8 12h3.15l-1.25 7.4 5.55-9.15h-3.25z", {
        "stroke-width": majorStroke,
      });
      return;
    case "noDelete":
      appendLine(svg, 8.4, 8, 17.4, 8, { "stroke-width": majorStroke });
      appendPath(svg, "M10.3 8V6.4h5.2V8", { "stroke-width": majorStroke });
      appendPath(svg, "M9.6 10.2 10.2 17.6h5.6l.6-7.4", {
        "stroke-width": majorStroke,
      });
      appendLine(svg, 12, 12.1, 12, 15.5, { "stroke-width": minorStroke });
      appendLine(svg, 14, 12.1, 14, 15.5, { "stroke-width": minorStroke });
      return;
    case "autoRoads":
      appendLine(svg, 8.3, 16.85, 12.7, 16.85, { "stroke-width": majorStroke });
      appendLine(svg, 10.5, 14.65, 10.5, 19.05, { "stroke-width": majorStroke });
      appendPath(
        svg,
        "M17.85 5.25h-2.6c-2.35 0-3.45 1-3.45 2.25s1.1 2.25 3.45 2.25h1.2c2.35 0 3.45 1 3.45 2.25s-1.1 2.25-3.45 2.25h-1.7",
        { "stroke-width": majorStroke },
      );
      return;
    case "tinyBudget":
      appendPath(svg, "M9.3 9.7 15.5 7.4l1.2 2.3", {
        "stroke-width": minorStroke,
      });
      appendPath(
        svg,
        "M9.4 9.5h7.7a2 2 0 0 1 2 2v4.2a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2v-3.9a2.3 2.3 0 0 1 2.3-2.3Z",
        { "stroke-width": majorStroke },
      );
      appendLine(svg, 15.7, 13.6, 18.3, 13.6, { "stroke-width": minorStroke });
      return;
    case "noIntersections":
      appendLine(svg, 12.4, 6.7, 12.4, 17.3, { "stroke-width": majorStroke });
      appendLine(svg, 8, 12, 17.5, 12, { "stroke-width": majorStroke });
      appendLine(svg, 8.6, 7.6, 16.5, 16.5, { "stroke-width": minorStroke });
      return;
    case "noPause":
      appendLine(svg, 10.5, 6.9, 10.5, 17.1, { "stroke-width": majorStroke });
      appendLine(svg, 15, 6.9, 15, 17.1, { "stroke-width": majorStroke });
      appendLine(svg, 8.1, 8.2, 17.4, 15.8, { "stroke-width": minorStroke });
      return;
    case "colorLock":
      appendRect(svg, 8.65, 7.75, 3.85, 3.85, {
        rx: 0.7,
        "stroke-width": majorStroke,
      });
      appendRect(svg, 14.45, 13.55, 3.85, 3.85, {
        rx: 0.7,
        "stroke-width": majorStroke,
      });
      appendLine(svg, 12.5, 11.6, 14.45, 13.55, { "stroke-width": minorStroke });
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
    glyph.setAttribute("transform", "translate(-1.05 0)");
  } else {
    glyph.setAttribute("transform", "translate(-0.65 0)");
  }
  iconSvg.append(glyph);
  drawIcon(glyph, id);

  return iconSvg;
};
