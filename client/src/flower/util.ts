import type { Side } from "../data/flower-enums.ts";

/** Deterministic hash from sid — yields a float in [0, 1). */
export function sidHash(sid: number, salt: number): number {
  const n = Math.sin(sid * 9301 + salt * 4973) * 49297;
  return n - Math.floor(n);
}

/** Compile-time exhaustiveness guard for switches over enum unions. */
export function unreachable(value: never): never {
  throw new Error(`Unreachable variant: ${String(value)}`);
}

/** Direction the light comes from, radians in flower space; petals facing it are lit. */
export const LIGHT_ANGLE = -Math.PI / 4;

/** The sunflower spiral step, about 137.5 degrees. */
export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export const clamp = (min: number, max: number, v: number): number =>
  Math.max(min, Math.min(max, v));

export const lerp = (a: number, b: number, s: number): number =>
  a + (b - a) * s;

/** n + 1 values from 0 to 1 inclusive. */
export const steps = (n: number): number[] =>
  Array.from({ length: n + 1 }, (_, i) => i / n);

/** +1 for a part on the stem's left, -1 for its right. */
export function sideSign(side: Side): number {
  switch (side) {
    case "Left":
      return 1;
    case "Right":
      return -1;
    default:
      return unreachable(side);
  }
}
