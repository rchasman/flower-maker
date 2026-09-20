/**
 * Stem geometry: the closed outline of a tapered, curved stem and the point on
 * its axis at a fraction of its length. Leaves, thorns and inflorescence
 * pedicels all attach through stemPointAt.
 */

import type { Side, StemStyle, SurfaceTexture } from "../data/flower-enums.ts";
import { darkenColor, lightenColor } from "./color.ts";
import {
  assembleOutline,
  circleCmds,
  smoothCmds,
  type DrawCmd,
  type Vec2,
} from "./geometry.ts";
import {
  LIGHT_DIRECTION,
  clamp,
  lerp,
  sidHash,
  sideSign,
  steps,
} from "./util.ts";

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
  /**
   * Heading of the tip tangent, radians from screen up, positive toward +x.
   * The last TIP_BEND_SPAN of the axis bends into it, so a head that sits
   * on the tip leans the way the stem bows under its weight.
   */
  tipBend: number;
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
  tipBend = 0,
): StemAxis {
  return {
    fromX,
    fromY,
    toX,
    toY,
    curvature: STYLE_CURVATURE[style](curvature),
    style,
    tipBend,
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

/**
 * The two open lines that make a stalk read as a cylinder: a highlight along
 * the side that faces the light and a shade line along the other, each
 * stroked `width` wide (plan units) in a tint of the stalk color.
 */
export type StalkShading = {
  shine: DrawCmd[];
  shade: DrawCmd[];
  width: number;
};

export type StemPlan = {
  cmds: DrawCmd[];
  color: number;
  thorns: readonly ThornPlan[];
  axis: StemAxis;
  halfWidth: number;
  /** bark from a Woody style, then the surface texture's own detail; empty for a smooth stem */
  surface: readonly StemSurfacePlan[];
  shading: StalkShading;
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
  Straight: halfWidth => ({ halfWidth, tipRatio: 0.6 }),
  Arching: halfWidth => ({ halfWidth, tipRatio: 0.55 }),
  Sinuous: halfWidth => ({ halfWidth, tipRatio: 0.6 }),
  Zigzag: halfWidth => ({ halfWidth: halfWidth * 0.9, tipRatio: 0.65 }),
  Twining: halfWidth => ({ halfWidth: halfWidth * 0.85, tipRatio: 0.6 }),
  Succulent: halfWidth => ({ halfWidth: halfWidth * 1.6, tipRatio: 0.8 }),
  Woody: halfWidth => ({ halfWidth: halfWidth * 1.25, tipRatio: 0.5 }),
  Trailing: halfWidth => ({ halfWidth, tipRatio: 0.6 }),
};

/** Half width of the drawn outline at t, after the style's width and taper. */
export function drawnHalfWidthAt(
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

function styledCentreAt(axis: StemAxis, t: number): CentrePoint {
  const sway = SWAY[axis.style];
  if (sway !== undefined) return swayingCentreAt(axis, sway, t);
  if (axis.style === "Zigzag") return zigzagCentreAt(axis, t);
  return quadraticCentreAt(axis, t);
}

/** The share of the axis, from the tip down, that bends into the tip heading. */
const TIP_BEND_SPAN = 0.3;

/**
 * The styled centreline with its tip bent to `tipBend`. Below the span the
 * whole axis is shifted sideways by a constant, so the tip still lands on
 * `to` while the tangent there turns to the requested heading.
 */
function stemCentreAt(axis: StemAxis, t: number): CentrePoint {
  const base = styledCentreAt(axis, t);
  const frame = chordFrame(axis);
  if (!frame || axis.tipBend === 0) return base;
  const span = TIP_BEND_SPAN * frame.len;
  const shift = (-Math.tan(axis.tipBend) * span) / 2;
  const u = Math.max(0, (t - (1 - TIP_BEND_SPAN)) / TIP_BEND_SPAN);
  const offset = shift * (1 - u * u);
  const slope = (-2 * shift * u) / TIP_BEND_SPAN;
  return {
    x: base.x + frame.nx * offset,
    y: base.y + frame.ny * offset,
    tx: base.tx + frame.nx * slope,
    ty: base.ty + frame.ny * slope,
  };
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

/** where across the half width the highlight and shade lines run */
const SHINE_OFFSET = 0.45;
const SHADE_OFFSET = 0.55;
/** the lines' stroke width as a share of the mid half width */
const SHADING_WIDTH = 0.5;

/** The unit normal on the side of the centreline that faces the light. */
function litNormal(c: CentrePoint): Vec2 {
  const [nx, ny] = centreNormal(c);
  const facing = nx * LIGHT_DIRECTION[0] + ny * LIGHT_DIRECTION[1];
  return facing >= 0 ? [nx, ny] : [-nx, -ny];
}

/**
 * Highlight and shade lines along a centreline sampled at `ts`, each offset
 * toward or away from the light by a share of the local half width.
 */
function stalkShading(
  ts: readonly number[],
  centreAt: (t: number) => CentrePoint,
  widthAt: (t: number) => number,
): StalkShading {
  const along = (offset: number): Vec2[] =>
    ts.map(t => {
      const c = centreAt(t);
      const [nx, ny] = litNormal(c);
      const w = widthAt(t) * offset;
      return [c.x + nx * w, c.y + ny * w];
    });
  return {
    shine: smoothCmds(along(SHINE_OFFSET)),
    shade: smoothCmds(along(-SHADE_OFFSET)),
    width: widthAt(0.5) * SHADING_WIDTH,
  };
}

/** The stem's cylinder shading along its axis. */
export function stemShading(axis: StemAxis, halfWidth: number): StalkShading {
  return stalkShading(
    steps(OUTLINE_SEGMENTS),
    t => stemCentreAt(axis, t),
    t => drawnHalfWidthAt(halfWidth, axis.style, t),
  );
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

/** Unit tangent toward the tip at t. */
export function stemTangentAt(axis: StemAxis, t: number): Vec2 {
  const { tx, ty } = stemCentreAt(axis, t);
  const len = Math.hypot(tx, ty) || 1;
  return [tx / len, ty / len];
}

/** Rotation of an up vector that points along (tx, ty): 0 is screen up, positive leans toward +x. */
export function headingOf(tx: number, ty: number): number {
  return Math.atan2(tx, -ty);
}

/** Heading of the axis tangent at its tip; a head sitting there leans this way. */
export function stemTipHeading(axis: StemAxis): number {
  const { tx, ty } = stemCentreAt(axis, 1);
  return headingOf(tx, ty);
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

// ── Branches ──

/**
 * A side branch or pedicel: a cubic that leaves its parent at p0 along d0 and
 * arrives at p1 along d1, so the part it carries sits exactly at p1 facing
 * along the branch. Widths flare into the parent at the join.
 */
export type Branch = {
  p0: Vec2;
  c1: Vec2;
  c2: Vec2;
  p1: Vec2;
  /** the parent's half width at the join */
  parentHalfWidth: number;
};

/** fraction of the chord each handle reaches along its tangent */
const BRANCH_HANDLE = 0.38;
/** a branch is this much of its parent's width where it leaves the flare */
const BRANCH_WIDTH = 0.5;
/** width at the branch tip relative to its width after the flare */
const BRANCH_TIP_RATIO = 0.55;
/** the share of the branch over which the base flares to the parent's width */
const FLARE_SPAN = 0.12;
const BRANCH_STATIONS = 8;

/** Unit vector `d` turned by `angle` radians (positive is clockwise on screen). */
export function rotate([x, y]: Vec2, angle: number): Vec2 {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [x * cos - y * sin, x * sin + y * cos];
}

export function branch(
  p0: Vec2,
  d0: Vec2,
  p1: Vec2,
  d1: Vec2,
  parentHalfWidth: number,
): Branch {
  const h = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) * BRANCH_HANDLE;
  return {
    p0,
    c1: [p0[0] + d0[0] * h, p0[1] + d0[1] * h],
    c2: [p1[0] - d1[0] * h, p1[1] - d1[1] * h],
    p1,
    parentHalfWidth,
  };
}

/**
 * The end point and arriving direction of a branch of `length` that leaves
 * along d0 and bends `bend` radians toward the ground. The chord follows
 * the bisector of the two directions, as a circular arc's does.
 */
export function bentEnd(
  p0: Vec2,
  d0: Vec2,
  length: number,
  bend: number,
): { p1: Vec2; d1: Vec2 } {
  const toGround = d0[0] >= 0 ? 1 : -1;
  const d1 = rotate(d0, toGround * bend);
  const mx = d0[0] + d1[0];
  const my = d0[1] + d1[1];
  const m = Math.hypot(mx, my) || 1;
  return {
    p1: [p0[0] + (mx / m) * length, p0[1] + (my / m) * length],
    d1,
  };
}

/** Point and unnormalised tangent at s in [0, 1] along the branch. */
export function branchPointAt(b: Branch, s: number): CentrePoint {
  const u = 1 - s;
  const [x0, y0] = b.p0;
  const [x1, y1] = b.c1;
  const [x2, y2] = b.c2;
  const [x3, y3] = b.p1;
  return {
    x:
      u * u * u * x0 + 3 * u * u * s * x1 + 3 * u * s * s * x2 + s * s * s * x3,
    y:
      u * u * u * y0 + 3 * u * u * s * y1 + 3 * u * s * s * y2 + s * s * s * y3,
    tx: 3 * u * u * (x1 - x0) + 6 * u * s * (x2 - x1) + 3 * s * s * (x3 - x2),
    ty: 3 * u * u * (y1 - y0) + 6 * u * s * (y2 - y1) + 3 * s * s * (y3 - y2),
  };
}

/** Unit tangent at s along the branch. */
export function branchDirectionAt(b: Branch, s: number): Vec2 {
  const { tx, ty } = branchPointAt(b, s);
  const len = Math.hypot(tx, ty) || 1;
  return [tx / len, ty / len];
}

/** Heading of the branch tip: the up vector of whatever it carries. */
export function branchTipHeading(b: Branch): number {
  const { tx, ty } = branchPointAt(b, 1);
  return headingOf(tx, ty);
}

/** Half width of a branch at its tip, for whatever grows on from it. */
export const branchTipHalfWidth = (parentHalfWidth: number): number =>
  parentHalfWidth * BRANCH_WIDTH * BRANCH_TIP_RATIO;

/** Drawn half width at s: the parent's width at the join, flaring down to the tapered branch. */
export function branchHalfWidthAt(b: Branch, s: number): number {
  const body = b.parentHalfWidth * BRANCH_WIDTH * lerp(1, BRANCH_TIP_RATIO, s);
  const flare = Math.max(0, 1 - s / FLARE_SPAN);
  return body + b.parentHalfWidth * (1 - BRANCH_WIDTH) * flare * flare;
}

/** A drawn stalk: the closed fill, the two open edge strokes, so no cap is stroked across the parent, and its cylinder shading. */
export type StalkPlan = {
  fill: DrawCmd[];
  edges: DrawCmd[];
  shading: StalkShading;
};

export function stalkPlan(b: Branch): StalkPlan {
  const stations = steps(BRANCH_STATIONS);
  const pairs = stations.map((s): EdgePair => {
    const c = branchPointAt(b, s);
    const [nx, ny] = centreNormal(c);
    const w = branchHalfWidthAt(b, s);
    return {
      left: [c.x + nx * w, c.y + ny * w],
      right: [c.x - nx * w, c.y - ny * w],
    };
  });
  const left = pairs.map(pair => pair.left);
  const right = pairs.map(pair => pair.right);
  return {
    fill: assembleOutline(left, right),
    edges: [...smoothCmds(left), ...smoothCmds(right)],
    shading: stalkShading(
      stations,
      s => branchPointAt(b, s),
      s => branchHalfWidthAt(b, s),
    ),
  };
}
