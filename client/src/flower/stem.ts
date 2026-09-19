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
import { lerp, sidHash, sideSign, steps } from "./util.ts";

/**
 * A stem's quadratic axis from its base to its tip; curvature bows the
 * midpoint sideways. Build one with `stemAxis` so the curvature already
 * carries the style's modifier: the drawn outline and every part attached
 * through stemPointAt then follow the same curve.
 */
export type StemAxis = {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  curvature: number;
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

/** Generate a stem outline as a closed path (two parallel bezier curves). */
export function generateStem(
  axis: StemAxis,
  halfWidth: number,
  style: StemStyle,
): DrawCmd[] {
  const { fromX, fromY, toX, toY, curvature } = axis;
  const mods = STEM_WIDTH_MODIFIERS[style](halfWidth);
  const effHW = mods.halfWidth;

  const dx = toX - fromX;
  const dy = toY - fromY;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.001) return [];

  // Normal perpendicular to stem direction
  const nx = -dy / len;
  const ny = dx / len;

  // ── Sinuous / Twining: S-curve with two midpoints ──
  if ((style === "Sinuous" || style === "Twining") && len > 0.1) {
    const sway = style === "Twining" ? len * 0.18 : len * 0.22;
    const t1 = 0.33,
      t2 = 0.66;
    const m1x = fromX + dx * t1 + nx * sway;
    const m1y = fromY + dy * t1 + ny * sway;
    const m2x = fromX + dx * t2 - nx * sway;
    const m2y = fromY + dy * t2 - ny * sway;

    const baseW = effHW;
    const tipW = effHW * mods.tipRatio;
    const w1 = baseW * 0.75 + tipW * 0.25;
    const w2 = baseW * 0.35 + tipW * 0.65;

    // Simplified S-curve: base → m1 → m2 → tip, each side
    const pts: Vec2[] = [
      [fromX, fromY],
      [m1x, m1y],
      [m2x, m2y],
      [toX, toY],
    ];
    const ws = [baseW, w1, w2, tipW];

    const left = pts.map((p, i): Vec2 => [
      p[0] + nx * ws[i]!,
      p[1] + ny * ws[i]!,
    ]);
    const right = pts.map((p, i): Vec2 => [
      p[0] - nx * ws[i]!,
      p[1] - ny * ws[i]!,
    ]);
    return assembleOutline(left, right);
  }

  // ── Zigzag: angular segments ──
  if (style === "Zigzag" && len > 0.1) {
    const segs = 4;
    const zigAmt = len * 0.08;
    const zigs: Vec2[] = Array.from({ length: segs - 1 }, (_, k) => {
      const i = k + 1;
      const t = i / segs;
      const sign = i % 2 === 1 ? 1 : -1;
      return [
        fromX + dx * t + nx * zigAmt * sign,
        fromY + dy * t + ny * zigAmt * sign,
      ];
    });
    const pts: Vec2[] = [[fromX, fromY], ...zigs, [toX, toY]];

    const baseW = effHW;
    const tipW = effHW * mods.tipRatio;
    const widthAt = (i: number): number =>
      baseW + (tipW - baseW) * (i / (pts.length - 1));
    const left = pts.map((p, i): Vec2 => [
      p[0] + nx * widthAt(i),
      p[1] + ny * widthAt(i),
    ]);
    const right = pts.map((p, i): Vec2 => [
      p[0] - nx * widthAt(i),
      p[1] - ny * widthAt(i),
    ]);

    // Line segments for the angular look
    const lineTo = (p: Vec2): DrawCmd => ({ op: "L", x: p[0], y: p[1] });
    return [
      { op: "M", x: left[0]![0], y: left[0]![1] },
      ...left.slice(1).map(lineTo),
      ...right.toReversed().map(lineTo),
      { op: "Z" },
    ];
  }

  // ── Standard stem (Straight, Arching, Woody, Succulent, Trailing) ──
  const curvOff = curvature * len * 0.3;
  const midX = (fromX + toX) / 2 + nx * curvOff;
  const midY = (fromY + toY) / 2 + ny * curvOff;

  const baseW = effHW;
  const tipW = effHW * mods.tipRatio;

  // Left side (base → tip)
  const lb1x = fromX + nx * baseW;
  const lb1y = fromY + ny * baseW;
  const lm1x = midX + nx * (baseW + tipW) * 0.5;
  const lm1y = midY + ny * (baseW + tipW) * 0.5;
  const lt1x = toX + nx * tipW;
  const lt1y = toY + ny * tipW;

  // Right side (tip → base)
  const rt1x = toX - nx * tipW;
  const rt1y = toY - ny * tipW;
  const rm1x = midX - nx * (baseW + tipW) * 0.5;
  const rm1y = midY - ny * (baseW + tipW) * 0.5;
  const rb1x = fromX - nx * baseW;
  const rb1y = fromY - ny * baseW;

  return [
    { op: "M", x: lb1x, y: lb1y },
    {
      op: "C",
      c1x: lb1x,
      c1y: lb1y + (lm1y - lb1y) * 0.5,
      c2x: lm1x,
      c2y: lm1y - (lm1y - lb1y) * 0.5,
      x: lm1x,
      y: lm1y,
    },
    {
      op: "C",
      c1x: lm1x,
      c1y: lm1y + (lt1y - lm1y) * 0.5,
      c2x: lt1x,
      c2y: lt1y - (lt1y - lm1y) * 0.5,
      x: lt1x,
      y: lt1y,
    },
    { op: "L", x: rt1x, y: rt1y },
    {
      op: "C",
      c1x: rt1x,
      c1y: rt1y + (rm1y - rt1y) * 0.5,
      c2x: rm1x,
      c2y: rm1y - (rm1y - rt1y) * 0.5,
      x: rm1x,
      y: rm1y,
    },
    {
      op: "C",
      c1x: rm1x,
      c1y: rm1y + (rb1y - rm1y) * 0.5,
      c2x: rb1x,
      c2y: rb1y - (rb1y - rm1y) * 0.5,
      x: rb1x,
      y: rb1y,
    },
    { op: "Z" },
  ];
}

/** Get a point and tangent angle along a curved stem at parameter t ∈ [0,1] (base → tip). */
export function stemPointAt(
  axis: StemAxis,
  t: number,
): { x: number; y: number; angle: number } {
  const { fromX, fromY, toX, toY, curvature } = axis;
  const dx = toX - fromX;
  const dy = toY - fromY;
  const len = Math.sqrt(dx * dx + dy * dy);
  const nx = -dy / len;
  const ny = dx / len;
  const curvOff = curvature * len * 0.3;
  const midX = (fromX + toX) / 2 + nx * curvOff;
  const midY = (fromY + toY) / 2 + ny * curvOff;

  // Quadratic bezier: B(t) = (1-t)²·from + 2(1-t)t·mid + t²·to
  const u = 1 - t;
  const x = u * u * fromX + 2 * u * t * midX + t * t * toX;
  const y = u * u * fromY + 2 * u * t * midY + t * t * toY;

  // Tangent: B'(t) = 2(1-t)(mid-from) + 2t(to-mid)
  const tx = 2 * u * (midX - fromX) + 2 * t * (toX - midX);
  const ty = 2 * u * (midY - fromY) + 2 * t * (toY - midY);
  const angle = Math.atan2(-tx, ty); // perpendicular to stem direction

  return { x, y, angle };
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

/** Half width of the drawn outline at t, after the style's width and taper. */
function drawnHalfWidthAt(
  halfWidth: number,
  style: StemStyle,
  t: number,
): number {
  const mods = STEM_WIDTH_MODIFIERS[style](halfWidth);
  return mods.halfWidth * lerp(1, mods.tipRatio, t);
}

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
 * Surface detail for the stem: bark when the style is Woody, then whatever
 * the texture adds. Empty when there is nothing to draw over the fill.
 */
export function generateStemSurface(
  axis: StemAxis,
  halfWidth: number,
  style: StemStyle,
  surface: SurfaceTexture,
  color: number,
  seed: number,
): StemSurfacePlan[] {
  const frame: SurfaceFrame = {
    axis,
    widthAt: t => drawnHalfWidthAt(halfWidth, style, t),
    rnd: salt => sidHash(seed, salt),
  };
  const texture = SURFACE_BUILDERS[surface];
  return [
    ...(style === "Woody" ? [WOODY_BARK(frame, color)] : []),
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
      "Straight",
    );
  });
}
