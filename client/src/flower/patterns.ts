/**
 * Petal pattern marks (spec section 3.1). Marks are laid out in the petal's
 * (t, u) frame, t along the length in [0, 1] and u across the width in
 * [-1, 1], then mapped through petalLocalToFlower, so they sit inside the
 * outline without masks whatever the shape or edge style.
 */

import type { PatternKind } from "../data/flower-enums.ts";
import { polygonCmds, type DrawCmd, type Vec2 } from "./geometry.ts";
import {
  petalLength,
  petalLocalToFlower,
  petalSpineAt,
  type PetalFrame,
} from "./petal.ts";
import { clamp, lerp, sidHash, steps, unreachable } from "./util.ts";

/** Rust `PetalPattern` with its color resolved. */
export type PetalPatternSpec = {
  kind: PatternKind;
  color: number;
  /** 0-1 mark size relative to the petal width */
  scale: number;
  /** 0-1 how many marks */
  density: number;
  /** 0-1 how far the marks reach from their anchor */
  extent: number;
};

/** One fill: every mark of the same color and alpha as sub-paths of one path. */
export type PetalMark = {
  cmds: DrawCmd[];
  color: number;
  alpha: number;
};

/** Petal-local point: [t along the length, u across the width]. */
type TU = readonly [number, number];

/** Interior marks keep this margin from the edge. */
const INTERIOR_U = 0.85;
/** Marks that reach the edge stop just inside the drawn outline. */
const EDGE_U = 0.97;
const T_MIN = 0.03;
const T_MAX = 0.97;

const MARK_ALPHA: Record<PatternKind, number> = {
  None: 0,
  Spots: 0.85,
  Speckle: 0.7,
  Stripes: 0.75,
  Flame: 0.7,
  ThroatBlotch: 0.85,
  Picotee: 0.9,
  Band: 0.8,
};

/** A t-run at fixed u, base to tip when from < to. */
const along = (from: number, to: number, u: number, n = 8): TU[] =>
  steps(n).map((s): TU => [lerp(from, to, s), u]);

/**
 * A u-run at fixed t, through u = 0 so the chord bends with Falcate
 * asymmetry instead of cutting across it.
 */
const across = (t: number, from: number, to: number): TU[] => [
  [t, from],
  [t, 0],
  [t, to],
];

/** Half width at t in unit flower space, averaged over both edges. */
const halfWidthAt = (frame: PetalFrame, t: number): number => {
  const station = petalSpineAt(frame, t);
  return (station.left + station.right) / 2;
};

/**
 * A round mark centred at (tc, uc) with radius rU in u units. The t radius is
 * scaled by the local aspect ratio so the mark is round on the petal.
 */
function roundMark(
  frame: PetalFrame,
  tc: number,
  uc: number,
  rU: number,
  vertices: number,
): TU[] {
  const rT = Math.min(
    0.12,
    (rU * halfWidthAt(frame, tc)) / Math.max(1e-6, petalLength(frame)),
  );
  return Array.from({ length: vertices }, (_, i): TU => {
    const theta = (i / vertices) * Math.PI * 2;
    return [tc + rT * Math.sin(theta), uc + rU * Math.cos(theta)];
  });
}

type ScatterParams = {
  count: number;
  radius: number;
  tRange: readonly [number, number];
  vertices: number;
};

/** Round marks spread over the petal, deterministic from rnd. */
function scatter(
  frame: PetalFrame,
  rnd: (salt: number) => number,
  params: ScatterParams,
): TU[][] {
  const [tLo, tHi] = params.tRange;
  const uMax = INTERIOR_U - params.radius;
  const phase = rnd(999);
  return Array.from({ length: params.count }, (_, k) => {
    const tc = clamp(
      tLo,
      tHi,
      lerp(tLo, tHi, (k + 0.5) / params.count) + 0.1 * (rnd(k) - 0.5),
    );
    const spread = (k * 0.618034 + phase) % 1;
    const uc = uMax * (2 * spread - 1);
    return roundMark(frame, tc, uc, params.radius, params.vertices);
  });
}

/** Evenly spaced centre lines in u, one for count = 1. */
const centreLines = (count: number, span: number): number[] =>
  Array.from({ length: count }, (_, k) =>
    count === 1 ? 0 : lerp(-span, span, k / (count - 1)),
  );

function stripes(pattern: PetalPatternSpec): TU[][] {
  const count = Math.round(pattern.density * 6);
  const halfW = (0.03 + pattern.scale * 0.12) / 2;
  const tEnd = 0.15 + pattern.extent * 0.8;
  return centreLines(count, 0.7).map(uc => {
    const edge = (side: number): TU[] =>
      steps(8).map((s): TU => [
        lerp(0.05, tEnd, s),
        uc + side * halfW * (1 - 0.5 * s * s),
      ]);
    return [...edge(1), ...edge(-1).toReversed()];
  });
}

function flame(
  pattern: PetalPatternSpec,
  rnd: (salt: number) => number,
): TU[][] {
  const count = Math.round(pattern.density * 5);
  const baseHalfW = (0.08 + pattern.scale * 0.2) / 2;
  const tEnd = 0.15 + pattern.extent * 0.8;
  return centreLines(count, 0.6).map((uc, k) => {
    const phase = rnd(k) * Math.PI * 2;
    const edge = (side: number): TU[] =>
      steps(8).map((s): TU => {
        const wiggle = 0.06 * Math.sin(s * 6 + phase) * s;
        const half = baseHalfW * Math.pow(1 - s, 0.8);
        return [lerp(T_MIN, tEnd, s), uc + wiggle + side * half];
      });
    return [...edge(1), ...edge(-1).toReversed()];
  });
}

function throatBlotch(pattern: PetalPatternSpec): TU[][] {
  const uMax = 0.5 + pattern.scale * 0.35;
  const tEnd = 0.1 + pattern.extent * 0.8;
  const dip = 0.2 * (tEnd - T_MIN);
  const top = steps(8).map((s): TU => {
    const u = lerp(-uMax, uMax, s);
    return [tEnd - dip * Math.pow(u / uMax, 2), u];
  });
  return [
    [
      ...along(T_MIN, tEnd - dip, -uMax, 6),
      ...top,
      ...along(tEnd - dip, T_MIN, uMax, 6),
      ...across(T_MIN, uMax, -uMax),
    ],
  ];
}

/**
 * A closed ring between the outline (|u| = EDGE_U) and |u| = EDGE_U - width,
 * open at the base, so the band scales with the petal instead of a stroke.
 */
function picotee(pattern: PetalPatternSpec): TU[][] {
  const width = 0.12 + pattern.scale * 0.4;
  const uInner = EDGE_U - width;
  const tBase = 0.05;
  const tInner = 1 - (0.05 + pattern.scale * 0.12);
  return [
    [
      ...along(tBase, T_MAX, EDGE_U, 14),
      ...along(T_MAX, tBase, -EDGE_U, 14),
      ...along(tBase, tInner, -uInner, 12),
      ...across(tInner, -uInner, uInner),
      ...along(tInner, tBase, uInner, 12),
    ],
  ];
}

function band(pattern: PetalPatternSpec): TU[][] {
  const tc = 0.1 + pattern.extent * 0.8;
  const half = 0.03 + pattern.scale * 0.12;
  const tLo = Math.max(T_MIN, tc - half);
  const tHi = Math.min(T_MAX, tc + half);
  return [
    [
      ...across(tLo, -EDGE_U, EDGE_U),
      ...along(tLo, tHi, EDGE_U, 6),
      ...across(tHi, EDGE_U, -EDGE_U),
      ...along(tHi, tLo, -EDGE_U, 6),
    ],
  ];
}

function markPolygons(
  pattern: PetalPatternSpec,
  frame: PetalFrame,
  rnd: (salt: number) => number,
): TU[][] {
  switch (pattern.kind) {
    case "None":
      return [];
    case "Spots":
      return scatter(frame, rnd, {
        count: Math.round(pattern.density * 12),
        radius: 0.08 + pattern.scale * 0.22,
        tRange: [0.15, 0.85],
        vertices: 10,
      });
    case "Speckle":
      return scatter(frame, rnd, {
        count: Math.round(pattern.density * 48),
        radius: 0.04,
        tRange: [0.1, 0.9],
        vertices: 6,
      });
    case "Stripes":
      return stripes(pattern);
    case "Flame":
      return flame(pattern, rnd);
    case "ThroatBlotch":
      return throatBlotch(pattern);
    case "Picotee":
      return picotee(pattern);
    case "Band":
      return band(pattern);
    default:
      return unreachable(pattern.kind);
  }
}

const toFlower = (frame: PetalFrame, polygon: TU[]): Vec2[] =>
  polygon.map(([t, u]) =>
    petalLocalToFlower(clamp(0, 1, t), clamp(-1, 1, u), frame),
  );

/**
 * Marks for one petal, deterministic from seed. Every mark of a pattern shares
 * one color and alpha, so they come back as one fill with many sub-paths.
 */
export function generatePetalMarks(
  pattern: PetalPatternSpec,
  frame: PetalFrame,
  seed: number,
): PetalMark[] {
  const rnd = (salt: number): number => sidHash(seed, salt);
  const cmds = markPolygons(pattern, frame, rnd).flatMap(polygon =>
    polygonCmds(toFlower(frame, polygon)),
  );
  if (cmds.length === 0) return [];
  return [{ cmds, color: pattern.color, alpha: MARK_ALPHA[pattern.kind] }];
}
