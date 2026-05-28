const cssPx = (value: number): string => `${Math.max(0, value).toFixed(2)}px`;

const readVisualViewport = (): {
  width: number;
  height: number;
  left: number;
  top: number;
} => {
  const viewport = window.visualViewport;
  return {
    width: viewport?.width ?? window.innerWidth,
    height: viewport?.height ?? window.innerHeight,
    left: viewport?.offsetLeft ?? 0,
    top: viewport?.offsetTop ?? 0,
  };
};

const updateAppViewport = (): void => {
  const viewport = readVisualViewport();
  const root = document.documentElement;
  root.style.setProperty("--app-width", cssPx(viewport.width));
  root.style.setProperty("--app-height", cssPx(viewport.height));
  root.style.setProperty("--app-left", cssPx(viewport.left));
  root.style.setProperty("--app-top", cssPx(viewport.top));
};

export const initAppViewport = (): (() => void) => {
  const controller = new AbortController();
  const { signal } = controller;
  const update = () => updateAppViewport();

  update();
  window.addEventListener("resize", update, { signal });
  window.addEventListener("orientationchange", update, { signal });
  window.visualViewport?.addEventListener("resize", update, { signal });
  window.visualViewport?.addEventListener("scroll", update, { signal });

  return () => controller.abort();
};
