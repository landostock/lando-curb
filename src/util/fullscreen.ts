type FullscreenMethod = () => Promise<void> | void;

interface FullscreenDocumentApi {
  exitFullscreen?: unknown;
  fullscreenElement?: Element | null;
  fullscreenEnabled?: boolean;
  webkitExitFullscreen?: unknown;
  webkitFullscreenElement?: Element | null;
}

interface FullscreenElementApi {
  requestFullscreen?: unknown;
  webkitRequestFullscreen?: unknown;
}

const fullscreenDocument = document as FullscreenDocumentApi;
const fullscreenElement = document.documentElement as FullscreenElementApi;

const fullscreenMethod = (
  owner: object,
  method: unknown,
): FullscreenMethod | undefined =>
  typeof method === "function" ? (method as FullscreenMethod).bind(owner) : undefined;

const requestFullscreenMethod = (): FullscreenMethod | undefined =>
  fullscreenMethod(
    document.documentElement,
    fullscreenElement.requestFullscreen ?? fullscreenElement.webkitRequestFullscreen,
  );

const exitFullscreenMethod = (): FullscreenMethod | undefined =>
  fullscreenMethod(
    document,
    fullscreenDocument.exitFullscreen ?? fullscreenDocument.webkitExitFullscreen,
  );

export const fullscreenSupported = (): boolean =>
  fullscreenDocument.fullscreenEnabled !== false &&
  requestFullscreenMethod() !== undefined;

export const fullscreenActive = (): boolean =>
  !!fullscreenDocument.fullscreenElement ||
  !!fullscreenDocument.webkitFullscreenElement;

export const requestFullscreen = async (): Promise<boolean> => {
  if (!fullscreenSupported() || fullscreenActive()) return fullscreenActive();
  try {
    await requestFullscreenMethod()?.();
    return fullscreenActive();
  } catch {
    return false;
  }
};

export const exitFullscreen = async (): Promise<boolean> => {
  if (!fullscreenActive()) return true;
  try {
    await exitFullscreenMethod()?.();
    return !fullscreenActive();
  } catch {
    return false;
  }
};

export const toggleFullscreen = async (): Promise<boolean> =>
  fullscreenActive() ? exitFullscreen() : requestFullscreen();
