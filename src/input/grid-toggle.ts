import { challengeDisablesDelete } from "../challenge";
import { gridRect, gridRectRed } from "../gfx/grid";
import { svgElement, svgHazardLines, svgHazardLinesRed } from "../gfx/svg";
import {
  gridRedToggleButton,
  gridRedToggleSvgPath,
  gridRedToggleTooltip,
  gridToggleSvgPath,
  gridToggleTooltip,
} from "../ui/ui";

let gridLocked = localStorage.getItem("Lando Curbg") === "true";

export const gridRedState = {
  locked: false,
  on: false,
};

const deleteModeIcon =
  "M3.65 9.5 8.35 4.8q.5-.5 1 0l2.6 2.6q.5.5 0 1l-3.2 3.2h-3.5L3.65 10q-.25-.25 0-.5ZM6.75 6.4l3.1 3.1M5.25 11.6h6.3";

const setDeleteModeButtonState = (
  state: "idle" | "working" | "locked",
): void => {
  const locked = state === "locked";
  const working = state === "working";
  gridRedToggleButton.style.background = locked
    ? "#cf3b2d"
    : working
      ? "#fff0ea"
      : "#fff8f5";
  gridRedToggleButton.style.boxShadow = locked
    ? "0 0 0 2px #fff, 0 0 0 4px #e313, 0 10px 22px #0001"
    : working
      ? "0 0 0 1px #e314, 0 8px 18px #0001"
      : "0 0 0 1px #e312, 0 8px 18px #0001";
  gridRedToggleButton.title = locked ? "Delete mode: on" : "Delete mode";
  gridRedToggleButton.setAttribute(
    "aria-label",
    locked ? "Delete mode: on" : "Delete mode",
  );
  gridRedToggleSvgPath.setAttribute("d", deleteModeIcon);
  gridRedToggleSvgPath.setAttribute("stroke", locked ? "#fff" : "#bd3b2e");
  gridRedToggleSvgPath.style.transform = locked
    ? "rotate(-9deg) scale(1.04)"
    : working
      ? "rotate(-9deg) translateY(-.2px)"
      : "none";
};

export const gridShow = (): void => {
  svgHazardLines.style.opacity = "0.9";
  gridRect.style.opacity = "1";

  if (!gridLocked) {
    // #
    gridToggleSvgPath.setAttribute(
      "d",
      "M6 5 6 11M10 5 10 11M5 6 8 6 11 6M5 10 11 10",
    );
    gridToggleSvgPath.style.transform = "rotate(180deg)";
  }
};

export const gridHide = (): void => {
  if (!gridLocked) {
    svgHazardLines.style.opacity = "0";
    gridRect.style.opacity = "0";

    // A
    gridToggleSvgPath.setAttribute(
      "d",
      "M8 4.5 5 11M8 4.5 11 11M5 11 8 4.5 11 11M6 9.5 10 9.5",
    );
    gridToggleSvgPath.style.transform = "rotate(0)";
  }
};

if (gridLocked) {
  gridToggleTooltip.innerHTML = "Grid: <u>On";
  gridShow();
  gridToggleSvgPath.setAttribute(
    "d",
    "M6 5 6 11M10 5 10 11M5 6 8 6 11 6M5 10 11 10",
  );
  gridToggleSvgPath.style.transform = "rotate(180deg)";
} else {
  gridToggleTooltip.innerHTML = "Grid: <u>Auto";
  gridHide();
}

export const gridLockToggle = (): void => {
  if (gridLocked) {
    gridLocked = false;
    gridHide();
    localStorage.setItem("Lando Curbg", "false");
    gridToggleTooltip.innerHTML = "Grid: <u>Auto";
  } else {
    gridShow();
    localStorage.setItem("Lando Curbg", "true");
    gridLocked = true;
    gridToggleTooltip.innerHTML = "Grid: <u>On";
  }
};

export const gridRedShow = (): void => {
  if (challengeDisablesDelete()) return;
  svgElement.style.cursor = "crosshair";
  gridRectRed.style.opacity = "0.9";
  svgHazardLinesRed.style.opacity = "0.9";
  gridRedState.on = true;
  setDeleteModeButtonState(gridRedState.locked ? "locked" : "working");

  if (!gridRedState.locked) setDeleteModeButtonState("working");
};

export const gridRedHide = (): void => {
  if (!gridRedState.locked) {
    gridRectRed.style.opacity = "0";
    svgHazardLinesRed.style.opacity = "0";
    gridRedState.on = false;
    setDeleteModeButtonState("idle");
  }
};

if (gridRedState.locked) {
  gridRedToggleTooltip.innerHTML = "Delete: <u>On";
  setDeleteModeButtonState("locked");
} else {
  gridRedToggleTooltip.innerHTML = "Delete: Touch";
  setDeleteModeButtonState("idle");
}

export const gridRedLockToggle = (): void => {
  if (challengeDisablesDelete()) return;
  if (gridRedState.locked) {
    gridRedState.locked = false;
    gridRedHide();
    gridRedState.on = false;
    gridRedToggleTooltip.innerHTML = "Delete: Touch";
  } else {
    gridRedState.locked = true;
    gridRedShow();
    setDeleteModeButtonState("locked");
    gridRedToggleTooltip.innerHTML = "Delete: <u>On";
  }
};
