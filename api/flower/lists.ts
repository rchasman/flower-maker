// Index access that throws instead of returning undefined. The profiles are
// tested non-empty, so a throw here means a broken profile, not bad input.
export function at<T>(list: readonly T[], index: number, what: string): T {
  const value = list[index];
  if (value === undefined) {
    throw new Error(`${what} has no entry at index ${index}`);
  }
  return value;
}

export const first = <T>(list: readonly T[], what: string): T =>
  at(list, 0, what);

export const cycle = <T>(list: readonly T[], index: number, what: string): T =>
  at(list, index % list.length, what);

export const pickUnit = <T>(list: readonly T[], u: number, what: string): T =>
  at(list, Math.min(list.length - 1, Math.floor(u * list.length)), what);
