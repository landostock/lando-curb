import { session } from "./state";

export type ChallengeId =
  | "zen"
  | "tripleSpeed"
  | "noDelete"
  | "autoRoads"
  | "tinyBudget"
  | "noIntersections"
  | "noPause"
  | "colorLock";

export type StartMode = "zen" | "challenge";
export type RuleChallengeId = Exclude<ChallengeId, "zen">;

export interface ChallengeDefinition {
  id: ChallengeId;
  title: string;
  shortTitle: string;
  description: string;
  accent: string;
  incompatibleWith?: RuleChallengeId[];
  rules: {
    autoRoadUpgrade?: boolean;
    bonusHomeActions?: number;
    disableDelete?: boolean;
    forcedSpeed?: 3;
    noColorMixing?: boolean;
    noIntersections?: boolean;
    noPauseInteraction?: boolean;
    startingRoadsMultiplier?: number;
  };
}

export const challenges: ChallengeDefinition[] = [
  {
    id: "zen",
    title: "Zen Mode",
    shortTitle: "Zen",
    description: "Classic play.",
    accent: "#443",
    rules: {},
  },
  {
    id: "tripleSpeed",
    title: "3x Only",
    shortTitle: "3x",
    description: "Locked at 3x speed.",
    accent: "#e90",
    rules: { forcedSpeed: 3 },
  },
  {
    id: "noDelete",
    title: "Ink Roads",
    shortTitle: "No Delete",
    description: "Roads are permanent.",
    accent: "#e31",
    rules: { disableDelete: true },
  },
  {
    id: "autoRoads",
    title: "Auto Roads",
    shortTitle: "Auto Roads",
    description: "Roads arrive automatically. No upgrades.",
    accent: "#29f",
    rules: { autoRoadUpgrade: true },
  },
  {
    id: "tinyBudget",
    title: "Tiny Budget",
    shortTitle: "Tiny Budget",
    description: "Fewer starting roads.",
    accent: "#2f5d70",
    rules: { startingRoadsMultiplier: 0.55 },
  },
  {
    id: "noIntersections",
    title: "No Four-Ways",
    shortTitle: "No Four-Ways",
    description: "No 4-way junctions.",
    accent: "#6b5aa6",
    rules: { noIntersections: true },
  },
  {
    id: "noPause",
    title: "No Pause",
    shortTitle: "No Pause",
    description: "Pause freezes input.",
    accent: "#6f7d3c",
    rules: { noPauseInteraction: true },
  },
  {
    id: "colorLock",
    title: "Color Lock",
    shortTitle: "Color Lock",
    description: "No mixed networks. +1 Home Action.",
    accent: "#c14f8a",
    rules: { bonusHomeActions: 1, noColorMixing: true },
  },
];

const challengeById = new Map(
  challenges.map((challenge) => [challenge.id, challenge]),
);

export const ruleChallenges = challenges.filter(
  (challenge): challenge is ChallengeDefinition & { id: RuleChallengeId } =>
    challenge.id !== "zen",
);

const ruleChallengeIds = ruleChallenges.map((challenge) => challenge.id);

const sortRuleChallengeIds = (
  ids: Iterable<RuleChallengeId>,
): RuleChallengeId[] => {
  const selected = new Set(ids);
  return ruleChallengeIds.filter((id) => selected.has(id));
};

export let selectedStartMode: StartMode = "zen";
export let activeChallengeIds: RuleChallengeId[] = [];

const getActiveChallenges = (): ChallengeDefinition[] =>
  sortRuleChallengeIds(activeChallengeIds)
    .map((id) => challengeById.get(id))
    .filter((challenge): challenge is ChallengeDefinition => !!challenge);

export const getActiveChallengeDefinitions = (): ChallengeDefinition[] =>
  getActiveChallenges();

export const setSelectedStartMode = (mode: StartMode): void => {
  selectedStartMode = mode;
  if (mode === "zen") activeChallengeIds = [];
};

export const challengeStartModeSelected = (): boolean =>
  selectedStartMode === "challenge";

export const setActiveChallenges = (ids: RuleChallengeId[]): void => {
  const accepted: RuleChallengeId[] = [];
  for (const id of ids) {
    if (!accepted.includes(id) && canCombineChallenge(id, accepted))
      accepted.push(id);
  }
  activeChallengeIds = sortRuleChallengeIds(accepted);
};

export const clearActiveChallenges = (): void => {
  activeChallengeIds = [];
};

export const canCombineChallenge = (
  id: RuleChallengeId,
  selectedIds: Iterable<RuleChallengeId>,
): boolean => {
  const challenge = challengeById.get(id);
  if (!challenge) return false;
  const selected = [...selectedIds];
  if (selected.includes(id)) return true;
  if (challenge.incompatibleWith?.some((other) => selected.includes(other)))
    return false;
  return !selected.some((otherId) => {
    const other = challengeById.get(otherId);
    return other?.incompatibleWith?.includes(id) === true;
  });
};

export const resetChallenge = (): void => {
  selectedStartMode = "zen";
  activeChallengeIds = [];
};

export const applyChallengeStartRules = (): void => {
  for (const challenge of getActiveChallenges()) {
    const multiplier = challenge.rules.startingRoadsMultiplier;
    if (multiplier !== undefined)
      session.paths = Math.max(1, Math.ceil(session.paths * multiplier));

    session.homeActions += challenge.rules.bonusHomeActions ?? 0;
  }
};

export const challengeDisablesDelete = (): boolean =>
  getActiveChallenges().some((challenge) => challenge.rules.disableDelete);

export const challengeUsesAutoRoadUpgrades = (): boolean =>
  getActiveChallenges().some((challenge) => challenge.rules.autoRoadUpgrade);

export const challengeBlocksIntersections = (): boolean =>
  getActiveChallenges().some((challenge) => challenge.rules.noIntersections);

export const challengeBlocksColorMixing = (): boolean =>
  getActiveChallenges().some((challenge) => challenge.rules.noColorMixing);

export const challengeDisablesPausedInteraction = (): boolean =>
  getActiveChallenges().some((challenge) => challenge.rules.noPauseInteraction);

export const challengeForcedSpeed = (): 3 | undefined =>
  getActiveChallenges().some((challenge) => challenge.rules.forcedSpeed === 3)
    ? 3
    : undefined;
