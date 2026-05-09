import { colors } from "./colors";
import { addGridBackgroundToSvg, addGridToSvg } from "./grid";
import { gridSvgHeight, gridSvgWidth, svgElement } from "./svg";
import { createSvgElement } from "./svg-utils";

const addGridBlockLayer = (): SVGGElement => {
  const gridBlockLayer = createSvgElement("g");
  gridBlockLayer.setAttribute("fill", "none");
  svgElement.append(gridBlockLayer);
  return gridBlockLayer;
};

const addBorderLayer = (): SVGGElement => {
  const borderLayer = createSvgElement("g");
  borderLayer.setAttribute("stroke-linecap", "round");
  borderLayer.setAttribute("fill", "none");
  svgElement.append(borderLayer);
  return borderLayer;
};

const addBaseLayer = (): SVGGElement => {
  const baseLayer = createSvgElement("g");
  baseLayer.setAttribute("fill", colors.base);
  svgElement.append(baseLayer);
  return baseLayer;
};

const addStreetShadowLayer = (): SVGGElement => {
  const streetShadowLayer = createSvgElement("g");
  streetShadowLayer.setAttribute("stroke-linecap", "round");
  streetShadowLayer.setAttribute("stroke-linejoin", "round");
  streetShadowLayer.setAttribute("fill", "none");
  streetShadowLayer.setAttribute("stroke", colors.base);
  streetShadowLayer.setAttribute("stroke-width", String(3.14));
  svgElement.append(streetShadowLayer);
  return streetShadowLayer;
};

const addMotorwayEdgeLayer = (): SVGGElement => {
  const layer = createSvgElement("g");
  layer.setAttribute("stroke-linecap", "round");
  layer.setAttribute("stroke-linejoin", "round");
  layer.setAttribute("fill", "none");
  layer.setAttribute("stroke", colors.motorwayEdge);
  svgElement.append(layer);
  return layer;
};

const addStreetLayer = (): SVGGElement => {
  const streetLayer = createSvgElement("g");
  streetLayer.setAttribute("stroke-linecap", "round");
  streetLayer.setAttribute("stroke-linejoin", "round");
  streetLayer.setAttribute("fill", "none");
  streetLayer.setAttribute("stroke", colors.road);
  streetLayer.setAttribute("stroke-width", String(3.14));
  svgElement.append(streetLayer);
  return streetLayer;
};

const addMotorwayDashLayer = (): SVGGElement => {
  const layer = createSvgElement("g");
  layer.setAttribute("stroke-linecap", "round");
  layer.setAttribute("stroke-linejoin", "round");
  layer.setAttribute("fill", "none");
  layer.setAttribute("stroke", colors.motorwayDash);
  svgElement.append(layer);
  return layer;
};

const addCommuterLayer = (): SVGGElement => {
  const commuterLayer = createSvgElement("g");
  commuterLayer.setAttribute("stroke-linecap", "round");
  commuterLayer.setAttribute("fill", "none");
  svgElement.append(commuterLayer);
  return commuterLayer;
};

const addLakeLayer = (): SVGGElement => {
  const lakeLayer = createSvgElement("g");
  svgElement.append(lakeLayer);
  return lakeLayer;
};

const addHouseShadowLayer = (): SVGGElement => {
  const shadowLayer = createSvgElement("g");
  shadowLayer.setAttribute("stroke-linecap", "round");
  shadowLayer.setAttribute("fill", "none");
  shadowLayer.setAttribute("stroke", colors.black);
  shadowLayer.setAttribute("opacity", String(0.2));
  svgElement.append(shadowLayer);
  return shadowLayer;
};

const addHouseLayer = (): SVGGElement => {
  const houseLayer = createSvgElement("g");
  houseLayer.setAttribute("stroke-linecap", "round");
  houseLayer.setAttribute("fill", colors.house);
  svgElement.append(houseLayer);
  return houseLayer;
};

const addLandmarkLayer = (): SVGGElement => {
  const landmarkLayer = createSvgElement("g");
  svgElement.append(landmarkLayer);
  return landmarkLayer;
};

const addTreeShadowLayer = (): SVGGElement => {
  const treeShadowLayer = createSvgElement("g");
  svgElement.append(treeShadowLayer);
  return treeShadowLayer;
};

const addTreeLayer = (): SVGGElement => {
  const treeLayer = createSvgElement("g");
  svgElement.append(treeLayer);
  return treeLayer;
};

const addPinLayer = (): SVGGElement => {
  const pinLayer = createSvgElement("g");
  pinLayer.setAttribute("stroke-linecap", "round");
  svgElement.append(pinLayer);
  return pinLayer;
};

const addGridPointerLayer = (): SVGRectElement => {
  const gridPointerLayer = createSvgElement("rect");
  gridPointerLayer.setAttribute("width", `${gridSvgWidth}px`);
  gridPointerLayer.setAttribute("height", `${gridSvgHeight}px`);
  gridPointerLayer.setAttribute("fill", "none");
  gridPointerLayer.setAttribute("stroke-width", String(0));
  gridPointerLayer.style.pointerEvents = "all";
  svgElement.append(gridPointerLayer);
  return gridPointerLayer;
};

// Order is important here, because it determines stacking in the SVG
addGridBackgroundToSvg();
export const lakeLayer = addLakeLayer();
addGridToSvg();
export const gridBlockLayer = addGridBlockLayer();
export const baseLayer = addBaseLayer();
export const streetShadowLayer = addStreetShadowLayer();
export const motorwayEdgeLayer = addMotorwayEdgeLayer();
export const streetLayer = addStreetLayer();
export const motorwayDashLayer = addMotorwayDashLayer();
export const houseShadowLayer = addHouseShadowLayer();
export const commuterLayer = addCommuterLayer();
export const borderLayer = addBorderLayer();
export const treeShadowLayer = addTreeShadowLayer();
export const houseLayer = addHouseLayer();
export const landmarkLayer = addLandmarkLayer();
export const treeLayer = addTreeLayer();
export const pinLayer = addPinLayer();
export const gridPointerLayer = addGridPointerLayer();

export const clearLayers = (): void => {
  baseLayer.innerHTML = "";
  borderLayer.innerHTML = "";
  gridBlockLayer.innerHTML = "";
  streetLayer.innerHTML = "";
  streetShadowLayer.innerHTML = "";
  motorwayEdgeLayer.innerHTML = "";
  motorwayDashLayer.innerHTML = "";
  commuterLayer.innerHTML = "";
  pinLayer.innerHTML = "";
  lakeLayer.innerHTML = "";
  treeLayer.innerHTML = "";
  treeShadowLayer.innerHTML = "";
  houseShadowLayer.innerHTML = "";
  houseLayer.innerHTML = "";
  landmarkLayer.innerHTML = "";
};
