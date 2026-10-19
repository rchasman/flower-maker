/**
 * A petal as a lit surface: a grid over the petal frame's (t, u) whose
 * vertices carry the blade's height, so each one has a normal the light can
 * fall on. The drawn outline and this grid trace the same curve, because both
 * map through petalLocalToFlower.
 *
 * Height above the receptacle, in unit flower space:
 *   z(t, u) = rise(t) + cup(t)·u² + lift(t)·band(u)
 * where lift is the side's buckling wave and band confines it to the margin,
 * or spreads it across the blade when the blade rises as one sheet.
 */

import { petalLocalToFlower, petalSpineAt, type PetalFrame } from "./petal.ts";
import { lerp, smoothstep, steps } from "./util.ts";

export type PetalSurface = {
  /** x, y per vertex, unit flower space */
  positions: Float32Array;
  /** unit normal per vertex, x and y in flower space, z toward the viewer */
  normals: Float32Array;
  /** t along the petal and how thin the blade is there (0 at the midrib base, 1 at the margin and tip) per vertex */
  surface: Float32Array;
  indices: Uint32Array;
};

/** Grid rows per spine segment: the rim follows the outline's curve between stations. */
const ROWS_PER_STATION = 3;
/** Grid columns across the blade, an odd count so the midrib is a column. */
export const COLUMNS = 9;
/** The buckled band reaches this far in from the margin, in half widths. */
const BAND = 0.55;

type Point3 = readonly [number, number, number];

function heightAt(frame: PetalFrame, t: number, u: number): number {
  const s = petalSpineAt(frame, t);
  const lift = u >= 0 ? s.leftLift : s.rightLift;
  const band = lerp(smoothstep(1 - BAND, 1, Math.abs(u)), 1, frame.coupling);
  return s.rise + s.cup * u * u + lift * band;
}

const sub = (a: Point3, b: Point3): Point3 => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2],
];

const cross = (a: Point3, b: Point3): Point3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/** The unit normal facing the viewer, null where the grid pinches to a point; a blade turned away shows its back, lit the same way. */
function facingNormal(n: Point3): Point3 | null {
  const length = Math.hypot(n[0], n[1], n[2]);
  if (length < 1e-12) return null;
  const sign = n[2] < 0 ? -1 : 1;
  return [
    (n[0] / length) * sign,
    (n[1] / length) * sign,
    (n[2] / length) * sign,
  ];
}

export function petalSurface(frame: PetalFrame): PetalSurface {
  const ts = steps((frame.spine.length - 1) * ROWS_PER_STATION);
  const us = steps(COLUMNS - 1).map(k => k * 2 - 1);
  const point = (t: number, u: number): Point3 => {
    const [x, y] = petalLocalToFlower(t, u, frame);
    return [x, y, heightAt(frame, t, u)];
  };
  const grid = ts.map(t => us.map(u => point(t, u)));
  const at = (i: number, j: number): Point3 =>
    grid[Math.max(0, Math.min(ts.length - 1, i))]![
      Math.max(0, Math.min(us.length - 1, j))
    ]!;

  const middle = Math.floor((ts.length - 1) / 2);
  // The base and the tip pinch to a point; there a vertex takes the normal
  // of the next row in toward the middle of the petal.
  const normalAt = (i: number, j: number): Point3 =>
    facingNormal(
      cross(sub(at(i, j + 1), at(i, j - 1)), sub(at(i + 1, j), at(i - 1, j))),
    ) ?? (i === middle ? [0, 0, 1] : normalAt(i + Math.sign(middle - i), j));

  const vertices = ts.flatMap((t, i) =>
    us.map((u, j) => {
      const [x, y] = at(i, j);
      return {
        x,
        y,
        normal: normalAt(i, j),
        t,
        thin: Math.min(1, 0.75 * u * u + 0.35 * t * t),
      };
    }),
  );

  const columns = us.length;
  const indices = ts.slice(1).flatMap((_, i) =>
    us.slice(1).flatMap((_, j) => {
      const a = i * columns + j;
      const b = a + 1;
      const c = a + columns;
      const d = c + 1;
      return [a, c, b, b, c, d];
    }),
  );

  return {
    positions: Float32Array.from(vertices.flatMap(v => [v.x, v.y])),
    normals: Float32Array.from(vertices.flatMap(v => v.normal)),
    surface: Float32Array.from(vertices.flatMap(v => [v.t, v.thin])),
    indices: Uint32Array.from(indices),
  };
}
