/**
 * Stem geometry: the closed outline of a tapered, curved stem and the point on
 * its axis at a fraction of its length. Leaves, thorns and inflorescence
 * pedicels all attach through stemPointAt.
 */

import type {
  BranchPattern,
  Side,
  StemStyle,
  SurfaceTexture,
} from "../data/flower-enums.ts";
import { darkenColor, lightenColor } from "./color.ts";
import {
  assembleOutline,
  circleCmds,
  smoothCmds,
  type DrawCmd,
  type Vec2,
} from "./geometry.ts";
import { clamp, lerp, sidHash, sideSign, steps } from "./util.ts";

const TAU = Math.PI * 2;

/**
 * A stem's axis from its base to its tip. Curvature bows the axis sideways
 * and the style shapes it (an S for Sinuous, corners for Zigzag). Build one
 * with `stemAxis` so the curvature already carries the style's modifier:
 * the drawn outline and every part attached through stemPointAt then follow
 * the one centreline that stemCentreAt defines.
 */
export type StemAxis = {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  curvature: number;
  style: StemStyle;
};

/** How each stem style bends the spec's curvature before anything is drawn. */
const STYLE_CURVATURE: Record<StemStyle, (curvature: number) => number> = {
  Straight: curvature => curvature,
  Arching: curvature => Math.max(0.2, curvature + 0.15),
  Sinuous: curvature => curvature,
  Zigzag: () => 0,
  Twining: curvature => curvature,
  Succulent: curvature => curvature * 0.5,
  Woody: curvature => curvature * 0.7,
  Trailing: curvature => Math.min(-0.2, curvature - 0.3),
};

/** The axis from `from` to `to` with the style's effective curvature. */
export function stemAxis(
  [fromX, fromY]: Vec2,
  [toX, toY]: Vec2,
  curvature: number,
  style: StemStyle,
): StemAxis {
  return {
    fromX,
    fromY,
    toX,
    toY,
    curvature: STYLE_CURVATURE[style](curvature),
    style,
  };
}

export type ThornPlan = {
  cmds: DrawCmd[];
  color: number;
};

/** One layer of surface detail over the stem fill: strokes (lines, ticks, chevrons) and fills (dots) in one color. */
export type StemSurfacePlan = {
  strokes: DrawCmd[];
  fills: DrawCmd[];
  color: number;
};

export type StemPlan = {
  cmds: DrawCmd[];
  color: number;
  thorns: readonly ThornPlan[];
  axis: StemAxis;
  halfWidth: number;
  /** bark from a Woody style, then the surface texture's own detail; empty for a smooth stem */
  surface: readonly StemSurfacePlan[];
  /** closed outlines of side branches, drawn in the stem color */
  branches: DrawCmd[];
};

type StemWidthModifiers = {
  halfWidth: number;
  tipRatio: number;
};

/** Stem style width modifiers: adjusted half width and tip taper ratio. */
const STEM_WIDTH_MODIFIERS: Record<
  StemStyle,
  (halfWidth: number) => StemWidthModifiers
> = {
  Straight: halfWidth => ({ halfWidth, tipRatio: 0.5 }),
  Arching: halfWidth => ({ halfWidth, tipRatio: 0.45 }),
  Sinuous: halfWidth => ({ halfWidth, tipRatio: 0.5 }),
  Zigzag: halfWidth => ({ halfWidth: halfWidth * 0.9, tipRatio: 0.6 }),
  Twining: halfWidth => ({ halfWidth: halfWidth * 0.85, tipRatio: 0.5 }),
  Succulent: halfWidth => ({ halfWidth: halfWidth * 2.2, tipRatio: 0.8 }),
  Woody: halfWidth => ({ halfWidth: halfWidth * 1.6, tipRatio: 0.35 }),
  Trailing: halfWidth => ({ halfWidth, tipRatio: 0.55 }),
};

/** Half width of the drawn outline at t, after the style's width and taper. */
function drawnHalfWidthAt(
  halfWidth: number,
  style: StemStyle,
  t: number,
): number {
  const mods = STEM_WIDTH_MODIFIERS[style](halfWidth);
  return mods.halfWidth * lerp(1, mods.tipRatio, t);
}

// ── Centreline ──

/** Sideways bow of the axis at its middle, as a fraction of its length. */
const CURVATURE_BOW = 0.3;
/** Sideways reach of the S in a Sinuous or Twining stem, as a fraction of its length. */
const SWAY: Partial<Record<StemStyle, number>> = {
  Sinuous: 0.22,
  Twining: 0.18,
};
const ZIGZAG_SEGMENTS = 4;
/** Sideways reach of each Zigzag corner, as a fraction of the stem length. */
const ZIGZAG_AMOUNT = 0.08;
/** Stations along a smooth centreline that its outline is sampled at. */
const OUTLINE_SEGMENTS = 8;

/** A point on the centreline with the unnormalised tangent toward the tip. */
type CentrePoint = { x: number; y: number; tx: number; ty: number };

type ChordFrame = { len: number; nx: number; ny: number };

/** The chord's length and unit normal, or null for a degenerate axis. */
function chordFrame(axis: StemAxis): ChordFrame | null {
  const dx = axis.toX - axis.fromX;
  const dy = axis.toY - axis.fromY;
  const len = Math.hypot(dx, dy);
  if (len < 0.001) return null;
  return { len, nx: -dy / len, ny: dx / len };
}

/**
 * The quadratic Bezier through the chord midpoint bowed sideways by the
 * curvature. The control point sits twice as far out as the bow, so the
 * curve itself passes through the bowed midpoint at t = 0.5.
 */
function quadraticCentreAt(axis: StemAxis, t: number): CentrePoint {
  const { fromX, fromY, toX, toY, curvature } = axis;
  const frame = chordFrame(axis);
  const bow = frame ? curvature * frame.len * CURVATURE_BOW * 2 : 0;
  const cx = (fromX + toX) / 2 + (frame?.nx ?? 0) * bow;
  const cy = (fromY + toY) / 2 + (frame?.ny ?? 0) * bow;
  const u = 1 - t;
  return {
    x: u * u * fromX + 2 * u * t * cx + t * t * toX,
    y: u * u * fromY + 2 * u * t * cy + t * t * toY,
    tx: 2 * u * (cx - fromX) + 2 * t * (toX - cx),
    ty: 2 * u * (cy - fromY) + 2 * t * (toY - cy),
  };
}

/** The quadratic centreline with one full S wave laid over it. */
function swayingCentreAt(axis: StemAxis, sway: number, t: number): CentrePoint {
  const frame = chordFrame(axis);
  const base = quadraticCentreAt(axis, t);
  if (!frame) return base;
  const reach = frame.len * sway;
  const wave = Math.sin(TAU * t) * reach;
  const slope = Math.cos(TAU * t) * reach * TAU;
  return {
    x: base.x + frame.nx * wave,
    y: base.y + frame.ny * wave,
    tx: base.tx + frame.nx * slope,
    ty: base.ty + frame.ny * slope,
  };
}

/** Corner k of a Zigzag stem, k from 0 (base) to ZIGZAG_SEGMENTS (tip). */
function zigzagCorner(axis: StemAxis, k: number): Vec2 {
  const frame = chordFrame(axis);
  const t = k / ZIGZAG_SEGMENTS;
  const onChord: Vec2 = [
    lerp(axis.fromX, axis.toX, t),
    lerp(axis.fromY, axis.toY, t),
  ];
  if (!frame || k === 0 || k === ZIGZAG_SEGMENTS) return onChord;
  const sign = k % 2 === 1 ? 1 : -1;
  const reach = frame.len * ZIGZAG_AMOUNT * sign;
  return [onChord[0] + frame.nx * reach, onChord[1] + frame.ny * reach];
}

/**
 * Straight runs between the Zigzag corners. The tangent is the chord's, not
 * the run's: the outline offsets every corner along the chord normal so the
 * corners stay sharp, and parts attach perpendicular to that same normal.
 */
function zigzagCentreAt(axis: StemAxis, t: number): CentrePoint {
  const scaled = clamp(0, ZIGZAG_SEGMENTS, t * ZIGZAG_SEGMENTS);
  const k = Math.min(ZIGZAG_SEGMENTS - 1, Math.floor(scaled));
  const [ax, ay] = zigzagCorner(axis, k);
  const [bx, by] = zigzagCorner(axis, k + 1);
  const s = scaled - k;
  return {
    x: lerp(ax, bx, s),
    y: lerp(ay, by, s),
    tx: axis.toX - axis.fromX,
    ty: axis.toY - axis.fromY,
  };
}

/** The one centreline every stem style is drawn around and attached to. */
function stemCentreAt(axis: StemAxis, t: number): CentrePoint {
  const sway = SWAY[axis.style];
  if (sway !== undefined) return swayingCentreAt(axis, sway, t);
  if (axis.style === "Zigzag") return zigzagCentreAt(axis, t);
  return quadraticCentreAt(axis, t);
}

/** Unit vector perpendicular to the tangent, pointing to the stem's left. */
function centreNormal({ tx, ty }: CentrePoint): Vec2 {
  const len = Math.hypot(tx, ty);
  if (len < 1e-9) return [0, 0];
  return [-ty / len, tx / len];
}

type EdgePair = { left: Vec2; right: Vec2 };

/** The outline's two edge points at t: the centre pushed out to each side along `normal`. */
function edgePairAt(
  axis: StemAxis,
  halfWidth: number,
  t: number,
  normal: Vec2,
): EdgePair {
  const c = stemCentreAt(axis, t);
  const w = drawnHalfWidthAt(halfWidth, axis.style, t);
  return {
    left: [c.x + normal[0] * w, c.y + normal[1] * w],
    right: [c.x - normal[0] * w, c.y - normal[1] * w],
  };
}

/** Zigzag edges are offset along the chord normal so every corner stays sharp. */
function zigzagOutline(
  axis: StemAxis,
  halfWidth: number,
  frame: ChordFrame,
): DrawCmd[] {
  const pairs = Array.from({ length: ZIGZAG_SEGMENTS + 1 }, (_, k) =>
    edgePairAt(axis, halfWidth, k / ZIGZAG_SEGMENTS, [frame.nx, frame.ny]),
  );
  const lineTo = (p: Vec2): DrawCmd => ({ op: "L", x: p[0], y: p[1] });
  const left = pairs.map(pair => pair.left);
  const right = pairs.map(pair => pair.right);
  return [
    { op: "M", x: left[0]![0], y: left[0]![1] },
    ...left.slice(1).map(lineTo),
    ...right.toReversed().map(lineTo),
    { op: "Z" },
  ];
}

/** Generate a stem outline as a closed path around the axis centreline. */
export function generateStem(axis: StemAxis, halfWidth: number): DrawCmd[] {
  const frame = chordFrame(axis);
  if (!frame) return [];
  if (axis.style === "Zigzag") return zigzagOutline(axis, halfWidth, frame);

  const pairs = steps(OUTLINE_SEGMENTS).map(t =>
    edgePairAt(axis, halfWidth, t, centreNormal(stemCentreAt(axis, t))),
  );
  return assembleOutline(
    pairs.map(pair => pair.left),
    pairs.map(pair => pair.right),
  );
}

/** Get a point and tangent angle along a curved stem at parameter t in [0,1] (base to tip). */
export function stemPointAt(
  axis: StemAxis,
  t: number,
): { x: number; y: number; angle: number } {
  const { x, y, tx, ty } = stemCentreAt(axis, t);
  return { x, y, angle: Math.atan2(-tx, ty) };
}

/**
 * Heading of a part that leaves the stem on `side` at an axis point whose
 * perpendicular is `stemAngle`, turned `rise` radians from that perpendicular
 * toward the tip. Left parts land at smaller x on an upright stem, Right
 * parts at larger x.
 */
export function sideHeading(
  stemAngle: number,
  side: Side,
  rise: number,
): number {
  return stemAngle + Math.PI / 2 - sideSign(side) * (Math.PI / 2 - rise);
}

/** Length of the axis chord from base to tip. */
export function stemAxisLength(axis: StemAxis): number {
  return Math.hypot(axis.toX - axis.fromX, axis.toY - axis.fromY);
}

// ── Surface texture ──

/** The axis point at t pushed sideways by `offset` (plan units, signed). */
function lateralPoint(axis: StemAxis, t: number, offset: number): Vec2 {
  const p = stemPointAt(axis, t);
  return [p.x + Math.cos(p.angle) * offset, p.y + Math.sin(p.angle) * offset];
}

type SurfaceFrame = {
  axis: StemAxis;
  /** drawn half width at t */
  widthAt: (t: number) => number;
  rnd: (salt: number) => number;
};

/** A smooth line up the stem at a fraction of the local half width. */
function longLine(
  frame: SurfaceFrame,
  fraction: number,
  wobble: number,
): DrawCmd[] {
  const pts = steps(8).map(s => {
    const t = lerp(0.05, 0.95, s);
    const sway = Math.sin(s * 9 + fraction * 5) * wobble;
    return lateralPoint(frame.axis, t, frame.widthAt(t) * (fraction + sway));
  });
  return smoothCmds(pts);
}

/** Short ticks leaning toward the base, alternating sides. */
function ticks(frame: SurfaceFrame, count: number, length: number): DrawCmd[] {
  return Array.from({ length: count }, (_, i): DrawCmd[] => {
    const t = lerp(0.08, 0.92, (i + 0.5) / count);
    const side = i % 2 === 0 ? 1 : -1;
    const w = frame.widthAt(t);
    const from = lateralPoint(frame.axis, t, side * w * 0.9);
    const to = lateralPoint(
      frame.axis,
      t - 0.03 * length,
      side * w * (0.9 + length),
    );
    return [
      { op: "M", x: from[0], y: from[1] },
      { op: "L", x: to[0], y: to[1] },
    ];
  }).flat();
}

/** V marks across the stem, points toward the base. */
function chevrons(frame: SurfaceFrame, count: number): DrawCmd[] {
  return Array.from({ length: count }, (_, i): DrawCmd[] => {
    const t = lerp(0.1, 0.9, (i + 0.5) / count);
    const w = frame.widthAt(t) * 0.75;
    const left = lateralPoint(frame.axis, t, -w);
    const right = lateralPoint(frame.axis, t, w);
    const point = lateralPoint(frame.axis, t - 0.035, 0);
    return [
      { op: "M", x: left[0], y: left[1] },
      { op: "L", x: point[0], y: point[1] },
      { op: "L", x: right[0], y: right[1] },
    ];
  }).flat();
}

/** Small hexagonal dots scattered inside the outline. */
function dots(
  frame: SurfaceFrame,
  count: number,
  radiusFraction: number,
): DrawCmd[] {
  return Array.from({ length: count }, (_, i) => {
    const t = lerp(0.06, 0.94, (i + 0.5) / count) + 0.02 * (frame.rnd(i) - 0.5);
    const w = frame.widthAt(t);
    const [cx, cy] = lateralPoint(
      frame.axis,
      t,
      (frame.rnd(50 + i) * 2 - 1) * w * 0.55,
    );
    return circleCmds(cx, cy, w * radiusFraction, 6);
  }).flat();
}

type SurfaceBuilder = (frame: SurfaceFrame, color: number) => StemSurfacePlan;

/** Long bark lines up the stem, the mark of a Woody style. */
const bark =
  (fractions: readonly number[], shade: number): SurfaceBuilder =>
  (frame, color) => ({
    strokes: fractions.flatMap(fraction => longLine(frame, fraction, 0.06)),
    fills: [],
    color: darkenColor(color, shade),
  });

const SURFACE_BUILDERS: Record<SurfaceTexture, SurfaceBuilder | null> = {
  Smooth: null,
  Velvet: null,
  Silk: null,
  Papery: null,
  Waxy: (frame, color) => ({
    strokes: longLine(frame, -0.45, 0.04),
    fills: [],
    color: lightenColor(color, 0.35),
  }),
  Rough: (frame, color) => ({
    strokes: [],
    fills: dots(frame, 12, 0.22),
    color: darkenColor(color, 0.6),
  }),
  Hairy: (frame, color) => ({
    strokes: ticks(frame, 14, 0.9),
    fills: [],
    color: lightenColor(color, 0.2),
  }),
  Glassy: null,
  Crystalline: null,
  Scaled: (frame, color) => ({
    strokes: chevrons(frame, 7),
    fills: [],
    color: darkenColor(color, 0.6),
  }),
  Metallic: null,
  Pearlescent: null,
  Fuzzy: (frame, color) => ({
    strokes: ticks(frame, 22, 0.45),
    fills: [],
    color: lightenColor(color, 0.25),
  }),
  Frosted: (frame, color) => ({
    strokes: [],
    fills: dots(frame, 16, 0.16),
    color: lightenColor(color, 0.6),
  }),
  Leathery: bark([-0.3, 0.35], 0.7),
  Powdery: null,
};

const WOODY_BARK = bark([-0.5, 0.05, 0.45], 0.55);

/**
 * Surface detail for the stem: bark when the axis style is Woody, then
 * whatever the texture adds. Empty when there is nothing to draw over the fill.
 */
export function generateStemSurface(
  axis: StemAxis,
  halfWidth: number,
  surface: SurfaceTexture,
  color: number,
  seed: number,
): StemSurfacePlan[] {
  const frame: SurfaceFrame = {
    axis,
    widthAt: t => drawnHalfWidthAt(halfWidth, axis.style, t),
    rnd: salt => sidHash(seed, salt),
  };
  const texture = SURFACE_BUILDERS[surface];
  return [
    ...(axis.style === "Woody" ? [WOODY_BARK(frame, color)] : []),
    ...(texture ? [texture(frame, color)] : []),
  ];
}

// ── Branching ──

type BranchNode = {
  /** 0-1 along the stem */
  t: number;
  side: 1 | -1;
  /** relative to the standard branch length */
  length: number;
  /** radians above the perpendicular, toward the tip */
  rise: number;
};

const BRANCH_RISE = Math.PI * 0.28;
const STEEP_RISE = Math.PI * 0.38;
/** fraction of the stem length for a full-length branch */
const BRANCH_LENGTH = 0.16;

const node = (
  t: number,
  side: 1 | -1,
  length: number,
  rise = BRANCH_RISE,
): BranchNode => ({ t, side, length, rise });

const BRANCH_NODES: Record<BranchPattern, readonly BranchNode[]> = {
  None: [],
  Alternate: [node(0.38, 1, 1), node(0.58, -1, 0.85), node(0.76, 1, 0.7)],
  Opposite: [
    node(0.42, 1, 1),
    node(0.42, -1, 1),
    node(0.68, 1, 0.75),
    node(0.68, -1, 0.75),
  ],
  Whorled: [
    node(0.45, 1, 0.9),
    node(0.45, -1, 0.9),
    node(0.45, 1, 0.55, STEEP_RISE),
    node(0.45, -1, 0.55, STEEP_RISE),
    node(0.72, 1, 0.6),
    node(0.72, -1, 0.6),
  ],
  Dichotomous: [
    node(0.55, 1, 1.1),
    node(0.55, -1, 1.1),
    node(0.8, 1, 0.6),
    node(0.8, -1, 0.6),
  ],
  // grow by replacing or extending the main axis: no side branches to draw
  Sympodial: [],
  Monopodial: [],
};

/**
 * Side branches as closed outlines at half the stem's width; the
 * inflorescence draws its own pedicels, these are the stem's own habit.
 */
export function generateBranches(
  axis: StemAxis,
  halfWidth: number,
  branching: BranchPattern,
): DrawCmd[] {
  const stemLength = stemAxisLength(axis);
  if (stemLength < 0.001) return [];
  const upX = (axis.toX - axis.fromX) / stemLength;
  const upY = (axis.toY - axis.fromY) / stemLength;
  return BRANCH_NODES[branching].flatMap(({ t, side, length, rise }) => {
    const p = stemPointAt(axis, t);
    const perpX = Math.cos(p.angle) * side;
    const perpY = Math.sin(p.angle) * side;
    const dirX = perpX * Math.cos(rise) + upX * Math.sin(rise);
    const dirY = perpY * Math.cos(rise) + upY * Math.sin(rise);
    const len = stemLength * BRANCH_LENGTH * length;
    return generateStem(
      stemAxis(
        [p.x, p.y],
        [p.x + dirX * len, p.y + dirY * len],
        0.25 * side,
        "Straight",
      ),
      halfWidth * 0.5,
    );
  });
}
