/** Shuffle a copy of `array` via a random-key sort. Non-destructive. */
export const shuffle = <T>(array: readonly T[]): T[] =>
  array
    .map((value) => ({ value, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ value }) => value);

/** Pick an index weighted by `weights`. `undefined` iff all weights sum to ≤ 0. */
export const weightedRandom = (weights: readonly number[]): number | undefined => {
  const total = weights.reduce((s, w) => s + w, 0);
  if (total <= 0) return undefined;
  const r = Math.random() * total;
  let acc = 0;
  for (let i = 0; i < weights.length; i++) {
    acc += weights[i]!;
    if (r < acc) return i;
  }
  return undefined;
};

/** Pick a uniformly-random element, or `undefined` for an empty array. */
export const pickRandom = <T>(arr: readonly T[]): T | undefined =>
  arr[Math.floor(Math.random() * arr.length)];
