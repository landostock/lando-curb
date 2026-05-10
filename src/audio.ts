interface AudioRuntime {
  context?: AudioContext;
  master?: GainNode;
  sfx?: GainNode;
  music?: GainNode;
  musicNodes?: AudioNode[];
  musicTimer?: number;
  musicEl?: HTMLAudioElement;
  musicTrack?: string;
  musicStartTimer?: number;
  musicVolumeTimer?: number;
  musicLastActivityAt?: number;
  musicActivityScore?: number;
  musicFadeStartedAt?: number;
  musicPendingPlay?: boolean;
  initialized: boolean;
  listenersBound?: boolean;
  mode: AudioMode;
  muted: boolean;
}

export type AudioMode = "all" | "muted" | "music" | "sfx";

interface AudioApi {
  setMuted: (muted: boolean) => void;
  toggleMuted: () => boolean;
  setMode: (mode: AudioMode) => AudioMode;
  cycleMode: () => AudioMode;
  currentMode: () => AudioMode;
  nextTrack: () => void;
  currentTrack: () => string | undefined;
}

declare global {
  interface Window {
    __landoAudio?: AudioRuntime;
    __landoAudioApi?: AudioApi;
  }
}

const runtime = (window.__landoAudio ??= {
  initialized: false,
  mode: parseAudioMode(sessionStorage.getItem("lando.audio.mode")) ?? "all",
  muted: false,
});

runtime.muted = runtime.mode === "muted";

const AudioContextCtor = window.AudioContext;

const MUSIC_PASSIVE_VOLUME = 0.11;
const MUSIC_ACTION_VOLUME = 0.078;
const MUSIC_BUSY_VOLUME = 0.052;
const MUSIC_FADE_IN_MS = 16000;
const MUSIC_CROSSFADE_OUT_MS = 6500;
const MUSIC_ACTIVITY_HOLD_MS = 2200;
const MUSIC_RECOVERY_MS = 8500;
const MUSIC_VOLUME_INTERVAL_MS = 160;
const MUSIC_TRACKS = [
  new URL("../music/leberch-piano-516448.mp3", import.meta.url).href,
  new URL("../music/the_mountain-happy-end-158086.mp3", import.meta.url).href,
  new URL("../music/leberch-ambient-517427 (1).mp3", import.meta.url).href,
  new URL("../music/leberch-ambient-517427.mp3", import.meta.url).href,
  new URL(
    "../music/leberch-inspirational-calm-romantic-story-piano-375930.mp3",
    import.meta.url,
  ).href,
  new URL("../music/leberch-timeless-sorrow-297866.mp3", import.meta.url).href,
  new URL("../music/leberch-nature-437475.mp3", import.meta.url).href,
];

function parseAudioMode(value: string | null): AudioMode | undefined {
  if (
    value === "all" ||
    value === "muted" ||
    value === "music" ||
    value === "sfx"
  ) {
    return value;
  }
  return undefined;
}

const now = (): number => runtime.context?.currentTime ?? 0;

const stopLegacyMusic = (): void => {
  window.clearInterval(runtime.musicTimer);
  runtime.musicTimer = undefined;
  for (const node of runtime.musicNodes ?? []) {
    if (node instanceof OscillatorNode) {
      try {
        node.stop();
      } catch {
        // Already stopped.
      }
    }
    node.disconnect();
  }
  runtime.musicNodes = [];
  runtime.music?.disconnect();
  runtime.music = undefined;
};

stopLegacyMusic();
window.clearTimeout(runtime.musicStartTimer);
window.clearInterval(runtime.musicVolumeTimer);
runtime.musicStartTimer = undefined;
runtime.musicVolumeTimer = undefined;

const easeOutCubic = (value: number): number => 1 - (1 - value) ** 3;

const musicFadeMultiplier = (): number => {
  if (!runtime.musicFadeStartedAt) return 0;
  const elapsed = performance.now() - runtime.musicFadeStartedAt;
  return easeOutCubic(Math.min(1, elapsed / MUSIC_FADE_IN_MS));
};

const targetMusicVolume = (): number => {
  const lastActivityAt = runtime.musicLastActivityAt;
  const fadeMultiplier = musicFadeMultiplier();
  if (!lastActivityAt) return MUSIC_PASSIVE_VOLUME * fadeMultiplier;

  const elapsed = performance.now() - lastActivityAt;
  const activityScore = Math.max(
    0,
    (runtime.musicActivityScore ?? 0) - elapsed / MUSIC_RECOVERY_MS,
  );
  const activeVolume =
    MUSIC_ACTION_VOLUME -
    Math.min(1, activityScore) * (MUSIC_ACTION_VOLUME - MUSIC_BUSY_VOLUME);

  if (elapsed <= MUSIC_ACTIVITY_HOLD_MS) {
    return activeVolume * fadeMultiplier;
  }

  const recovery = Math.min(
    1,
    (elapsed - MUSIC_ACTIVITY_HOLD_MS) / MUSIC_RECOVERY_MS,
  );
  return (
    (activeVolume +
      (MUSIC_PASSIVE_VOLUME - activeVolume) * easeOutCubic(recovery)) *
    fadeMultiplier
  );
};

const updateMusicVolume = (): void => {
  const music = runtime.musicEl;
  if (!music) return;
  music.muted = runtime.mode === "muted" || runtime.mode === "sfx";

  const target = targetMusicVolume();
  const smoothing = target < music.volume ? 0.055 : 0.035;
  music.volume += (target - music.volume) * smoothing;
  if (Math.abs(music.volume - target) < 0.002) {
    music.volume = target;
  }
};

const ensureMusicVolumeLoop = (): void => {
  if (runtime.musicVolumeTimer !== undefined) return;
  runtime.musicVolumeTimer = window.setInterval(
    updateMusicVolume,
    MUSIC_VOLUME_INTERVAL_MS,
  );
};

const markMusicActivity = (strength = 1): void => {
  const nowMs = performance.now();
  const elapsedSinceLast = runtime.musicLastActivityAt
    ? nowMs - runtime.musicLastActivityAt
    : 0;
  const previousActivity = runtime.musicActivityScore ?? 0;
  const decayedActivity = Math.max(
    0,
    previousActivity - elapsedSinceLast / MUSIC_RECOVERY_MS,
  );
  runtime.musicActivityScore = Math.min(1, decayedActivity * 0.78 + strength);
  runtime.musicLastActivityAt = nowMs;
  ensureMusicVolumeLoop();
};

const chooseRandomTrack = (): string | undefined => {
  const tracks =
    MUSIC_TRACKS.length > 1
      ? MUSIC_TRACKS.filter((track) => track !== runtime.musicTrack)
      : MUSIC_TRACKS;
  const track = tracks[Math.floor(Math.random() * tracks.length)];
  if (!track) return undefined;
  runtime.musicTrack = track;
  return track;
};

const stopMusicElement = (music: HTMLAudioElement): void => {
  music.pause();
  music.removeAttribute("src");
  music.load();
};

const fadeOutMusicElement = (music: HTMLAudioElement): void => {
  const startVolume = music.volume;
  const startedAt = performance.now();
  const timer = window.setInterval(() => {
    const progress = Math.min(
      1,
      (performance.now() - startedAt) / MUSIC_CROSSFADE_OUT_MS,
    );
    music.volume = startVolume * (1 - easeOutCubic(progress));
    if (progress >= 1) {
      window.clearInterval(timer);
      stopMusicElement(music);
    }
  }, MUSIC_VOLUME_INTERVAL_MS);
};

export const fadeOutGameMusic = (): void => {
  const music = runtime.musicEl;
  if (!music) return;

  runtime.musicEl = undefined;
  runtime.musicFadeStartedAt = undefined;
  runtime.musicPendingPlay = false;
  runtime.musicLastActivityAt = undefined;
  runtime.musicActivityScore = 0;
  fadeOutMusicElement(music);
};

const createMusicElement = (
  track: string,
  fadePrevious = false,
): HTMLAudioElement => {
  const previousMusic = runtime.musicEl;
  if (previousMusic) {
    if (fadePrevious && !previousMusic.paused) {
      fadeOutMusicElement(previousMusic);
    } else {
      stopMusicElement(previousMusic);
    }
  }

  const music = new Audio(track);
  music.loop = true;
  music.preload = "auto";
  music.volume = 0;
  music.muted = runtime.mode === "muted" || runtime.mode === "sfx";
  runtime.musicEl = music;
  return music;
};

const ensureMusicElement = (): HTMLAudioElement | undefined => {
  ensureMusicVolumeLoop();
  if (runtime.musicEl) return runtime.musicEl;

  const track = chooseRandomTrack();
  if (!track) return undefined;

  return createMusicElement(track);
};

const playPreparedMusic = (): void => {
  const music = ensureMusicElement();
  if (!music) return;

  runtime.musicPendingPlay = true;
  runtime.musicFadeStartedAt = performance.now();
  music.volume = 0;
  music.muted = runtime.mode === "muted" || runtime.mode === "sfx";
  updateMusicVolume();
  void music
    .play()
    .then(() => {
      runtime.musicPendingPlay = false;
    })
    .catch(() => {
      runtime.musicPendingPlay = true;
      runtime.musicFadeStartedAt = undefined;
      music.volume = 0;
    });
};

export const startGameMusic = (): void => {
  const track = chooseRandomTrack();
  if (!track) return;

  runtime.musicFadeStartedAt = undefined;
  runtime.musicPendingPlay = false;
  runtime.musicLastActivityAt = undefined;
  runtime.musicActivityScore = 0;
  createMusicElement(track);
  ensureMusicVolumeLoop();

  playPreparedMusic();
};

export const playNextMusicTrack = (): void => {
  const track = chooseRandomTrack();
  if (!track) return;

  runtime.musicFadeStartedAt = undefined;
  runtime.musicPendingPlay = false;
  createMusicElement(track, true);
  ensureMusicVolumeLoop();
  playPreparedMusic();
};

const ensureContext = (): AudioContext => {
  const ctx = runtime.context ?? new AudioContextCtor();
  runtime.context = ctx;

  if (!runtime.master) {
    runtime.master = ctx.createGain();
    runtime.master.connect(ctx.destination);
  }
  runtime.master.gain.value = 0.7;

  if (!runtime.sfx) {
    runtime.sfx = ctx.createGain();
    runtime.sfx.connect(runtime.master);
  }
  runtime.sfx.gain.value =
    runtime.mode === "all" || runtime.mode === "sfx" ? 0.85 : 0;

  return ctx;
};

const ramp = (
  param: AudioParam,
  start: number,
  peak: number,
  end: number,
  duration: number,
): void => {
  const t = now();
  param.cancelScheduledValues(t);
  param.setValueAtTime(start, t);
  param.exponentialRampToValueAtTime(peak, t + duration * 0.18);
  param.exponentialRampToValueAtTime(end, t + duration);
};

const setMuted = (muted: boolean): void => {
  setMode(muted ? "muted" : "all");
};

const setMode = (mode: AudioMode): AudioMode => {
  runtime.mode = mode;
  runtime.muted = mode === "muted";
  sessionStorage.setItem("lando.audio.mode", mode);
  if (runtime.master) {
    runtime.master.gain.setTargetAtTime(0.7, now(), 0.04);
  }
  if (runtime.sfx) {
    runtime.sfx.gain.setTargetAtTime(
      mode === "all" || mode === "sfx" ? 0.85 : 0,
      now(),
      0.04,
    );
  }
  if (runtime.musicEl) {
    runtime.musicEl.muted = mode === "muted" || mode === "sfx";
  }
  window.dispatchEvent(
    new CustomEvent("lando-audio-mode-change", { detail: { mode } }),
  );
  return runtime.mode;
};

const toggleMuted = (): boolean => {
  setMode(runtime.mode === "muted" ? "all" : "muted");
  return runtime.muted;
};

const cycleMode = (): AudioMode => {
  const nextModeByMode: Record<AudioMode, AudioMode> = {
    all: "muted",
    muted: "music",
    music: "sfx",
    sfx: "all",
  };
  return setMode(nextModeByMode[runtime.mode]);
};

const unlock = (): void => {
  const ctx = ensureContext();
  void ctx.resume().finally(() => {
    if (runtime.musicPendingPlay && runtime.musicStartTimer === undefined) {
      playPreparedMusic();
    }
  });
};

const playTone = ({
  frequency,
  duration,
  volume,
  type = "sine",
  bend = 1,
  lowpass,
}: {
  frequency: number;
  duration: number;
  volume: number;
  type?: OscillatorType;
  bend?: number;
  lowpass?: number;
}): void => {
  const ctx = ensureContext();
  const destination = runtime.sfx;
  if (!destination) return;
  if (ctx.state !== "running") {
    void ctx
      .resume()
      .then(() =>
        playTone({ frequency, duration, volume, type, bend, lowpass }),
      );
    return;
  }

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = lowpass ? ctx.createBiquadFilter() : undefined;
  const t = ctx.currentTime;

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, t);
  osc.frequency.exponentialRampToValueAtTime(frequency * bend, t + duration);
  if (filter && lowpass !== undefined) {
    filter.type = "lowpass";
    filter.frequency.value = lowpass;
    filter.Q.value = 0.7;
  }
  ramp(gain.gain, 0.0001, volume, 0.0001, duration);

  osc.connect(gain);
  if (filter) {
    gain.connect(filter);
    filter.connect(destination);
  } else {
    gain.connect(destination);
  }
  osc.start(t);
  osc.stop(t + duration + 0.02);
};

export const initAudio = (): void => {
  runtime.initialized = true;

  if (!runtime.listenersBound) {
    runtime.listenersBound = true;
    const unlockOnce = (): void => unlock();
    window.addEventListener("pointerdown", unlockOnce, {
      capture: true,
      passive: true,
    });
    window.addEventListener("keydown", unlockOnce, { capture: true });
    window.addEventListener("keydown", (event) => {
      if (event.key.toLowerCase() === "m") toggleMuted();
      if (event.key.toLowerCase() === "s") playNextMusicTrack();
    });
  }

  window.__landoAudioApi = {
    setMuted,
    toggleMuted,
    setMode,
    cycleMode,
    currentMode: () => runtime.mode,
    nextTrack: playNextMusicTrack,
    currentTrack: () => runtime.musicTrack,
  };
};

export const playRoadPop = ({
  bridge = false,
  motorway = false,
}: {
  bridge?: boolean;
  motorway?: boolean;
} = {}): void => {
  markMusicActivity(motorway || bridge ? 0.16 : 0.12);
  const base = bridge ? 460 : motorway ? 360 : 410;
  playTone({
    frequency: base + Math.random() * 55,
    duration: 0.055,
    volume: bridge ? 0.12 : 0.105,
    type: "sine",
    bend: bridge ? 1.2 : 1.16,
  });
  setTimeout(() => {
    playTone({
      frequency: base * 1.9 + Math.random() * 90,
      duration: 0.025,
      volume: 0.026,
      type: "triangle",
      bend: 0.92,
    });
  }, 18);
};

export const playRemoveThup = (): void => {
  markMusicActivity(0.22);
  playTone({
    frequency: 190 + Math.random() * 30,
    duration: 0.07,
    volume: 0.085,
    type: "triangle",
    bend: 0.78,
    lowpass: 1200,
  });
};

export const playAppearChime = (): void => {
  playTone({
    frequency: 520 + Math.random() * 35,
    duration: 0.09,
    volume: 0.035,
    type: "sine",
    bend: 1.18,
  });
  setTimeout(() => {
    playTone({
      frequency: 780 + Math.random() * 45,
      duration: 0.12,
      volume: 0.024,
      type: "sine",
      bend: 1.08,
    });
  }, 65);
};

export const playUpgradeSound = (): void => {
  markMusicActivity(0.38);
  playTone({ frequency: 392, duration: 0.12, volume: 0.045, bend: 1.5 });
  setTimeout(
    () =>
      playTone({ frequency: 587, duration: 0.16, volume: 0.038, bend: 1.25 }),
    90,
  );
};

export const playUpgradeReadyFanfare = (): void => {
  markMusicActivity(0.55);
  const notes = [392, 523.25, 659.25, 783.99];
  notes.forEach((frequency, i) => {
    setTimeout(() => {
      playTone({
        frequency,
        duration: i === notes.length - 1 ? 0.24 : 0.12,
        volume: i === notes.length - 1 ? 0.07 : 0.052,
        type: "sine",
        bend: i === notes.length - 1 ? 1.06 : 1.14,
      });
    }, i * 95);
  });
  setTimeout(() => {
    playTone({
      frequency: 196,
      duration: 0.28,
      volume: 0.035,
      type: "triangle",
      bend: 1.01,
      lowpass: 900,
    });
  }, 285);
};

export const playGameOverSound = (): void => {
  markMusicActivity(0.72);
  playTone({
    frequency: 392,
    duration: 0.18,
    volume: 0.06,
    type: "sine",
    bend: 0.82,
  });
  setTimeout(() => {
    playTone({
      frequency: 311.13,
      duration: 0.22,
      volume: 0.055,
      type: "triangle",
      bend: 0.86,
      lowpass: 1100,
    });
  }, 130);
  setTimeout(() => {
    playTone({
      frequency: 196,
      duration: 0.46,
      volume: 0.048,
      type: "triangle",
      bend: 0.72,
      lowpass: 750,
    });
  }, 315);
};

export const stopAllAudio = (): void => {
  const ctx = runtime.context;
  if (!ctx || !runtime.master) return;
  runtime.master.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
  setTimeout(() => setMuted(runtime.muted), 120);
};

/* music uses real audio files from /music; short action SFX stay synthesized. */
