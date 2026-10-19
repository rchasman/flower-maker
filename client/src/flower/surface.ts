/**
 * A petal as a lit surface: a grid over the petal frame's (t, u) whose
 * vertices carry the blade's height, so each one has a normal the light can
 * fall on. The drawn outline and this grid trace the same curve, because both
 * map the same interpolated stations through stationToFlower.
 *
 * Height above the receptacle, in unit flower space:
 *   z(t, u) = rise(t) + cup(t)·u² + lift(t)·band(u)
 * where lift is the side's buckling wave and band confines it to the margin,
 * or spreads it across the blade when the blade rises as one sheet.
 */

import {
  petalSpineAt,
  stationToFlower,
  type PetalFrame,
  type SpineSample,
} from "./petal.ts";
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
const ROWS_PER_STATION = 2;
/** Grid columns across the blade, an odd count so the midrib is a column. */
export const COLUMNS = 7;
/** The buckled band reaches this far in from the margin, in half widths. */
const BAND = 0.55;

type Point3 = readonly [number, number, number];

function heightAt(s: SpineSample, u: number, frame: PetalFrame): number {
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
  const grid = ts.map(t => {
    const station = petalSpineAt(frame, t);
    return us.map((u): Point3 => {
      const [x, y] = stationToFlower(station, u, frame);
      return [x, y, heightAt(station, u, frame)];
    });
  });
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

  const columns = us.length;
  const count = ts.length * columns;
  const rowOf = (v: number) => Math.floor(v / columns);
  const normals = Array.from({ length: count }, (_, v) =>
    normalAt(rowOf(v), v % columns),
  );
  /** the six corners of the two triangles in grid cell `cell`, as offsets from its first vertex */
  const CELL = [0, columns, 1, 1, columns, columns + 1];
  const cells = (ts.length - 1) * (columns - 1);

  return {
    positions: Float32Array.from({ length: count * 2 }, (_, k) => {
      const v = k >> 1;
      return at(rowOf(v), v % columns)[k & 1]!;
    }),
    normals: Float32Array.from(
      { length: count * 3 },
      (_, k) => normals[Math.floor(k / 3)]![k % 3]!,
    ),
    surface: Float32Array.from({ length: count * 2 }, (_, k) => {
      const v = k >> 1;
      const t = ts[rowOf(v)]!;
      const u = us[v % columns]!;
      return k & 1 ? Math.min(1, 0.75 * u * u + 0.35 * t * t) : t;
    }),
    indices: Uint32Array.from({ length: cells * 6 }, (_, k) => {
      const cell = Math.floor(k / 6);
      const first =
        Math.floor(cell / (columns - 1)) * columns + (cell % (columns - 1));
      return first + CELL[k % 6]!;
    }),
  };
}
