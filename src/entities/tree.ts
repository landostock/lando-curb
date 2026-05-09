import { GameObjectClass, Vector } from "kontra";

import { colors } from "../gfx/colors";
import { treeLayer, treeShadowLayer } from "../gfx/layers";
import { createSvgElement, toSvgPoint } from "../gfx/svg-utils";
import { removeTree } from "../state";

export class Tree extends GameObjectClass {
  svgGroup!: SVGGElement;
  shadowGroup!: SVGGElement;

  constructor(properties: Record<string, unknown>) {
    super(properties);
    this.addToSvg();
  }

  addToSvg() {
    const minDotGap = 0.5;
    const numTrees = Math.random() * 4;
    const { x, y } = toSvgPoint(this);

    this.svgGroup = createSvgElement("g");
    this.svgGroup.style.transform = `translate(${x}px,${y}px)`;
    treeLayer.append(this.svgGroup);

    this.shadowGroup = createSvgElement("g");
    this.shadowGroup.style.transform = `translate(${x}px,${y}px)`;
    treeShadowLayer.append(this.shadowGroup);

    // Sibling branches placed so far in this cell — used only during this build loop.
    const dots: Array<{ position: Vector; size: number }> = [];

    for (let i = 0; i < numTrees; i++) {
      const size = Math.random() / 2 + 1;
      const position = Vector(Math.random() * 8 - 4, Math.random() * 8 - 4);

      // Skip this branch if it's too close to a sibling — larger branches naturally end up
      // with fewer siblings since they cover more of the cell.
      if (
        dots.some(
          (d) => d.position.distance(position) < d.size + size + minDotGap,
        )
      ) {
        continue;
      }

      dots.push({ position, size });

      const circle = createSvgElement("circle");
      circle.style.transform = `translate(${position.x}px, ${position.y}px)`;
      circle.setAttribute("fill", colors.leaf);
      circle.style.transition = `r .4s cubic-bezier(.5, 1.5, .5, 1)`;
      setTimeout(() => circle.setAttribute("r", String(size)), 100 * i);

      this.svgGroup.append(circle);

      const shadow = createSvgElement("ellipse");
      shadow.setAttribute("rx", String(0));
      shadow.setAttribute("ry", String(0));
      shadow.style.opacity = "0";
      shadow.style.transform = `translate(${position.x}px,${position.y}px) rotate(45deg)`;
      shadow.style.transition = `all .4s cubic-bezier(.5, 1.5, .5, 1)`;
      setTimeout(() => {
        shadow.setAttribute("rx", String(size * 1.2));
        shadow.setAttribute("ry", String(size * 0.9));
        shadow.style.opacity = "0.1";
        shadow.style.transform = `translate(${position.x + size * 0.7}px,${position.y + size * 0.7}px) rotate(45deg)`;
      }, 100 * i);
      this.shadowGroup.append(shadow);
    }
  }

  remove() {
    this.svgGroup.remove();
    this.shadowGroup.remove();
    removeTree(this);
  }
}
