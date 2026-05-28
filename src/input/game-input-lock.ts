type GameInputLockSource = "session-menu" | "help" | "upgrade-picker";

const lockedBy = new Set<GameInputLockSource>();

export const setGameInputLocked = (
  source: GameInputLockSource,
  locked: boolean,
): void => {
  if (locked) lockedBy.add(source);
  else lockedBy.delete(source);
};

export const gameInputLocked = (): boolean => lockedBy.size > 0;

