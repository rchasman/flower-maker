/**
 * Inflorescence (spec section 3.2): where a plant's florets sit on its stem
 * and the pedicels and branches that carry them. The stem tip is the origin
 * and the stem hangs below it in y-down screen space, so "up the stem" is
 * toward smaller y. Every distance derives from the stem length L: florets
 * are 0.12 to 0.20 L across whatever the kind, and the terminal one is just
 * the topmost floret. Each floret arrives at the exact end of its own stalk
 * and faces along it.
 */

import type { InflorescenceKind, LifeStage } from "../data/flower-enums.ts";
import type { Vec2 } from "./geometry.ts";
import {
  bentEnd,
  branch,
  branchDirectionAt,
  branchHalfWidthAt,
  branchPointAt,
  branchTipHeading,
  drawnHalfWidthAt,
  headingOf,
  rotate,
  stalkPlan,
  stemAxisLength,
  stemPointAt,
  stemTangentAt,
  stemTipHeading,
  type Branch,
  type StalkPlan,
  type StemPlan,
} from "./stem.ts";
import { GOLDEN_ANGLE, clamp, lerp, sidHash, unreachable } from "./util.ts";

export type Floret = {
  offsetX: number;
  offsetY: number;
  /** multiplies the head plan, which is drawn in its own unit space */
  scale: number;
  /** rotation of the head's up vector, radians, 0 screen up, positive toward +x */
  angle: number;
  stage: LifeStage;
  /** drawn first, a little smaller and darker */
  back: boolean;
  /** 0 at the front of the plant to 1 at the back: what the draw order sorts on */
  depth: number;
  /** the pedicel that ends at this floret, in the stem color; null for a sessile floret */
  stalk: StalkPlan | null;
};

export type InflorescenceLayout = {
  /** the terminal floret first */
  florets: readonly [Floret, ...Floret[]];
  /** branches that carry several florets, drawn before the pedicels */
  branches: readonly StalkPlan[];
};

export type InflorescenceParams = {
  kind: InflorescenceKind;
  headCount: number;
  /** 0-1 floret size class: 0.12 to 0.20 of the stem length across */
  headScale: number;
  /** 0-1 how far the florets sit from the axis */
  spread: number;
  stem: StemPlan;
  /** reach of the bloom head's petals from its centre, in the head's unit space */
  headRadius: number;
  /** the spec's stage: what the lowest, most mature florets show */
  stage: LifeStage;
  sid: number;
};

/** A solitary head on the stem tip, leaning the way the tip does. */
export function solitaryLayout(
  stem: StemPlan | null,
  scale: number,
  stage: LifeStage,
): InflorescenceLayout {
  return {
    florets: [
      {
        offsetX: 0,
        offsetY: 0,
        scale,
        angle: stem ? stemTipHeading(stem.axis) : 0,
        stage,
        back: false,
        depth: 0,
        stalk: null,
      },
    ],
    branches: [],
  };
}

const DEG = Math.PI / 180;
/** floret diameter as a share of the stem length, over the head size class */
const FLORET_DIAMETER = [0.12, 0.2] as const;
const SIZE_JITTER = [0.85, 1.15] as const;
const ANGLE_JITTER = 3 * DEG;
const BACK_SCALE = 0.9;
/** heads on a dome span this arc */
const DOME_ARC = 160 * DEG;
/** stages of florets above the spec stage ones, top first: the top quarter buds, the next quarter opening */
const YOUNG_STAGES: readonly LifeStage[] = ["Bud", "Opening"];
const STAGED_KINDS: readonly LifeStage[] = ["Opening", "Bloom", "Fading"];

type Frame = {
  stem: StemPlan;
  length: number;
  /** floret diameter, plan units */
  diameter: number;
  /** floret.scale for a bloom of `diameter` */
  unitScale: number;
  /** 0.5-1.5 multiplier on every distance from the axis */
  lateral: number;
  stage: LifeStage;
  firstSide: 1 | -1;
  rnd: (salt: number) => number;
};

/** A floret before its stage is known. */
type Placed = Omit<Floret, "stage">;

const unit = (t: number): number => clamp(0, 1, t);

const axisAt = (frame: Frame, t: number): Vec2 => {
  const p = stemPointAt(frame.stem.axis, t);
  return [p.x, p.y];
};

const stemWidthAt = (frame: Frame, t: number): number =>
  drawnHalfWidthAt(frame.stem.halfWidth, frame.stem.axis.style, t);

/** Sides alternate up the axis; the seed picks the first. */
const opposite = (side: 1 | -1): 1 | -1 => (side === 1 ? -1 : 1);
const sideOf = (frame: Frame, k: number): 1 | -1 =>
  k % 2 === 0 ? frame.firstSide : opposite(frame.firstSide);

/** Florets on the far half of the phyllotaxis spiral are behind the axis. */
const isBack = (k: number): boolean => Math.cos(k * GOLDEN_ANGLE) < -0.1;

function floretScale(frame: Frame, k: number, size: number, back: boolean) {
  const jitter = lerp(SIZE_JITTER[0], SIZE_JITTER[1], frame.rnd(100 + k));
  return frame.unitScale * size * jitter * (back ? BACK_SCALE : 1);
}

const angleJitter = (frame: Frame, k: number): number =>
  (frame.rnd(200 + k) * 2 - 1) * ANGLE_JITTER;

/** A floret at the tip of `b`, facing along it. */
function stalked(
  frame: Frame,
  k: number,
  b: Branch,
  size: number,
  back: boolean,
): Placed {
  return {
    offsetX: b.p1[0],
    offsetY: b.p1[1],
    scale: floretScale(frame, k, size, back),
    angle: branchTipHeading(b) + angleJitter(frame, k),
    back,
    depth: back ? 1 : 0,
    stalk: stalkPlan(b),
  };
}

/** A branch of `length` off the axis at t, leaving `angle` from the axis toward `side` and bending `bend` toward the ground. */
function axisBranch(
  frame: Frame,
  t: number,
  side: 1 | -1,
  angle: number,
  length: number,
  bend: number,
): Branch {
  const p0 = axisAt(frame, t);
  const d0 = rotate(stemTangentAt(frame.stem.axis, t), side * angle);
  const { p1, d1 } = bentEnd(p0, d0, length, bend);
  return branch(p0, d0, p1, d1, stemWidthAt(frame, t));
}

/** A twig of `length` off branch `parent` at s, leaving `angle` toward `side` of the branch and bending toward the ground. */
function twig(
  parent: Branch,
  s: number,
  side: 1 | -1,
  angle: number,
  length: number,
  bend: number,
): Branch {
  const at = branchPointAt(parent, s);
  const d0 = rotate(branchDirectionAt(parent, s), side * angle);
  const { p1, d1 } = bentEnd([at.x, at.y], d0, length, bend);
  return branch([at.x, at.y], d0, p1, d1, branchHalfWidthAt(parent, s));
}

/**
 * Top quarter buds, next quarter opening, the rest at the spec stage. A spec
 * stage that is itself a bud or past bloom applies to every floret.
 */
function stagedByHeight(frame: Frame, placed: readonly Placed[]): Floret[] {
  if (!STAGED_KINDS.includes(frame.stage)) {
    return placed.map(p => ({ ...p, stage: frame.stage }));
  }
  const byHeight = placed.map(p => p.offsetY).toSorted((a, b) => a - b);
  return placed.map(p => {
    const rank = byHeight.indexOf(p.offsetY) / placed.length;
    const young = YOUNG_STAGES[Math.floor(rank * 4)];
    return { ...p, stage: young ?? frame.stage };
  });
}

const allAt = (stage: LifeStage, placed: readonly Placed[]): Floret[] =>
  placed.map(p => ({ ...p, stage }));

function layoutOf(
  florets: readonly Floret[],
  branches: readonly StalkPlan[] = [],
): InflorescenceLayout {
  const [first, ...rest] = florets;
  if (!first) throw new Error("an inflorescence needs at least one floret");
  return { florets: [first, ...rest], branches };
}

/** The terminal floret on the stem tip, leaning with it. */
function terminal(frame: Frame, size = 1): Placed {
  return {
    offsetX: 0,
    offsetY: 0,
    scale: floretScale(frame, 0, size, false),
    angle: stemTipHeading(frame.stem.axis),
    back: false,
    depth: 0,
    stalk: null,
  };
}

// ── Spike ──

const SPIKE_SPAN = [0.45, 0.6] as const;
const SPIKE_FACE = [20 * DEG, 35 * DEG] as const;
/** the lowest floret of the cone is this much bigger than the top one */
const SPIKE_CONE = 0.7;

/** Sessile florets packed on the upper stem, alternating sides on the phyllotaxis spiral, a cone tapering to the tip. */
function spike(frame: Frame, count: number): InflorescenceLayout {
  const span = lerp(SPIKE_SPAN[0], SPIKE_SPAN[1], unit((count - 8) / 12));
  const spread = frame.diameter * 0.35 * frame.lateral;
  const placed = Array.from({ length: count }, (_, i): Placed => {
    const k = count - 1 - i;
    const up = k / Math.max(1, count - 1);
    const t = 1 - span * (1 - up);
    const p = stemPointAt(frame.stem.axis, t);
    const offset = Math.sin(k * GOLDEN_ANGLE) * spread;
    const face =
      Math.sign(offset) *
      lerp(SPIKE_FACE[0], SPIKE_FACE[1], Math.abs(offset) / spread);
    const back = isBack(k);
    return {
      offsetX: p.x + Math.cos(p.angle) * offset,
      offsetY: p.y + Math.sin(p.angle) * offset,
      scale: floretScale(frame, k, lerp(1, SPIKE_CONE, up), back),
      angle: axisHeadingAt(frame, t) + face + angleJitter(frame, k),
      back,
      depth: back ? 1 : 0,
      stalk: null,
    };
  });
  return layoutOf(stagedByHeight(frame, placed));
}

/** Heading of the axis tangent at t. */
function axisHeadingAt(frame: Frame, t: number): number {
  const [tx, ty] = stemTangentAt(frame.stem.axis, t);
  return headingOf(tx, ty);
}

// ── Raceme ──

const RACEME_SPAN = [0.45, 0.97] as const;
const RACEME_ANGLE = [35 * DEG, 55 * DEG] as const;
const RACEME_STALK = [1.2, 0.6] as const;
const RACEME_BEND = [55 * DEG, 30 * DEG] as const;
/** same-side neighbours are two steps apart, so half a diameter per step keeps them clear */
const RACEME_MIN_STEP = 0.5;

/** Stalked florets alternating up the axis, the lower ones on longer, heavier pedicels that bend further down. */
function raceme(frame: Frame, count: number): InflorescenceLayout {
  const span = (RACEME_SPAN[1] - RACEME_SPAN[0]) * frame.length;
  const step = span / Math.max(1, count - 1);
  const diameter = Math.min(frame.diameter, step / RACEME_MIN_STEP);
  const fitted: Frame = {
    ...frame,
    diameter,
    unitScale: frame.unitScale * (diameter / frame.diameter),
  };
  const placed = Array.from({ length: count }, (_, i): Placed => {
    const k = count - 1 - i;
    const up = k / Math.max(1, count - 1);
    const t = lerp(RACEME_SPAN[0], RACEME_SPAN[1], up);
    const b = axisBranch(
      fitted,
      t,
      sideOf(fitted, k),
      lerp(RACEME_ANGLE[0], RACEME_ANGLE[1], fitted.rnd(300 + k)),
      diameter * lerp(RACEME_STALK[0], RACEME_STALK[1], up) * fitted.lateral,
      lerp(RACEME_BEND[0], RACEME_BEND[1], up),
    );
    return stalked(fitted, k, b, 1, isBack(k));
  });
  return layoutOf(stagedByHeight(fitted, placed));
}

// ── Umbel and corymb ──

const DOME_MIN_RADIUS = 0.2;
const DOME_MAX_RADIUS = 0.32;
/** heads overlap along the arc, each taking this share of its diameter */
const DOME_PACKING = 0.7;
/** dome heads beyond this angle from the apex are the far side of the dome */
const DOME_BACK_ANGLE = 55 * DEG;

/** The dome radius that fits `count` heads of the frame's diameter along the arc. */
function domeRadius(frame: Frame, count: number): number {
  const needed = (count * frame.diameter * DOME_PACKING) / DOME_ARC;
  return clamp(
    DOME_MIN_RADIUS * frame.length,
    DOME_MAX_RADIUS * frame.length,
    needed * frame.lateral,
  );
}

/** Angles from the apex for `count` heads spread over the dome arc, the middle ones first. */
function domeAngles(count: number): number[] {
  return Array.from({ length: count }, (_, j) =>
    lerp(-DOME_ARC / 2, DOME_ARC / 2, (j + 0.5) / count),
  ).toSorted((a, b) => Math.abs(a) - Math.abs(b));
}

/** The point on a dome of `radius` centred on `centre`, `theta` from its apex. */
const onDome = (centre: Vec2, radius: number, theta: number): Vec2 => [
  centre[0] + Math.sin(theta) * radius,
  centre[1] - Math.cos(theta) * radius,
];

const radial = (theta: number): Vec2 => [Math.sin(theta), -Math.cos(theta)];

/** Equal stalks fanning from the stem tip to heads on one dome, the outer ones behind and lower. */
function umbel(frame: Frame, count: number): InflorescenceLayout {
  const radius = domeRadius(frame, count);
  const fan = axisAt(frame, 1);
  const up = stemTangentAt(frame.stem.axis, 1);
  const width = stemWidthAt(frame, 1);
  const placed = domeAngles(count).map((theta, k): Placed => {
    const b = branch(
      fan,
      rotate(up, theta * 0.6),
      onDome(fan, radius, theta),
      radial(theta),
      width,
    );
    return stalked(frame, k, b, 1, Math.abs(theta) > DOME_BACK_ANGLE);
  });
  return layoutOf(allAt(frame.stage, placed));
}

/** corymb heads overlap their neighbours by this share of their width */
const CORYMB_OVERLAP = 0.45;
/** a corymb stalk shows for at most this many floret diameters under its head */
const CORYMB_STALK = 0.5;
/** the ball's centre sits this far up the axis from the tip, as a share of the stem length */
const CORYMB_HUB_LIFT = 0.04;
/** the ball bulges this share of its radius below the hub at its sides */
const CORYMB_BULGE = 0.2;
/** heads at the rim of the ball are this much smaller than the front centre one */
const CORYMB_RIM_SIZE = 0.8;
/** heads farther than this share of the radius from the front centre are the back of the ball */
const CORYMB_BACK_DEPTH = 0.6;
const CORYMB_MIN_RADIUS = 0.15;
const CORYMB_MAX_RADIUS = 0.35;

/** The radius of a half disc whose area holds `count` heads packed at CORYMB_OVERLAP. */
function corymbRadius(frame: Frame, count: number): number {
  const cell = frame.diameter * (1 - CORYMB_OVERLAP);
  const needed = cell * Math.sqrt((2 * count) / Math.PI) * frame.lateral;
  return clamp(
    CORYMB_MIN_RADIUS * frame.length,
    CORYMB_MAX_RADIUS * frame.length,
    needed,
  );
}

/**
 * A filled hemisphere of heads: a sunflower packing (r grows with the square
 * root of k, the angle steps by the golden angle folded into a half turn)
 * over the upper half disc about the hub, bulging a little below it at the
 * sides. Depth is the distance from the front centre, so the middle heads
 * are largest and drawn last, and each stalk is only the stub under its head.
 */
function corymb(frame: Frame, count: number): InflorescenceLayout {
  const tip = axisAt(frame, 1);
  const up = stemTangentAt(frame.stem.axis, 1);
  const lift = frame.length * CORYMB_HUB_LIFT;
  const hub: Vec2 = [tip[0] + up[0] * lift, tip[1] + up[1] * lift];
  const radius = corymbRadius(frame, count);
  const shown = frame.diameter * CORYMB_STALK;
  const placed = Array.from({ length: count }, (_, k): Placed => {
    const depth = Math.sqrt((k + 0.5) / count);
    const r = radius * depth;
    const phi = ((k * GOLDEN_ANGLE) % Math.PI) - Math.PI / 2;
    const bulge = radius * CORYMB_BULGE * (1 - Math.cos(phi)) * depth;
    const head: Vec2 = [
      hub[0] + Math.sin(phi) * r,
      hub[1] - Math.cos(phi) * r + bulge,
    ];
    const dx = head[0] - hub[0];
    const dy = head[1] - hub[1];
    const dist = Math.hypot(dx, dy) || 1;
    const dir: Vec2 = dist > 1e-6 ? [dx / dist, dy / dist] : radial(0);
    const stub = Math.min(shown, dist);
    const p0: Vec2 = [head[0] - dir[0] * stub, head[1] - dir[1] * stub];
    const b = branch(p0, dir, head, dir, stemWidthAt(frame, 1) * 0.8);
    const back = depth > CORYMB_BACK_DEPTH;
    return {
      ...stalked(frame, k, b, lerp(1, CORYMB_RIM_SIZE, depth), back),
      depth,
    };
  });
  return layoutOf(allAt(frame.stage, placed));
}

// ── Panicle ──

const PANICLE_BRANCHES = [3, 5] as const;
const PANICLE_SPAN = [0.5, 0.9] as const;
const PANICLE_LENGTH = [0.32, 0.14] as const;
const PANICLE_ANGLE = 35 * DEG;
const PANICLE_BEND = [50 * DEG, 30 * DEG] as const;
const PANICLE_TWIG = 0.7;
const PANICLE_TWIG_ANGLE = 45 * DEG;
const PANICLE_TWIG_BEND = 30 * DEG;

/** Florets on a branch: one at its tip and the rest on twigs alternating along it. */
function branchFlorets(
  frame: Frame,
  b: Branch,
  count: number,
  firstK: number,
): Placed[] {
  return Array.from({ length: count }, (_, j): Placed => {
    const k = firstK + j;
    if (j === 0) return stalked(frame, k, b, 1, false);
    const s = lerp(0.75, 0.35, (j - 1) / Math.max(1, count - 2));
    const side: 1 | -1 = j % 2 === 1 ? -1 : 1;
    const tw = twig(
      b,
      s,
      side,
      PANICLE_TWIG_ANGLE,
      frame.diameter * PANICLE_TWIG * frame.lateral,
      PANICLE_TWIG_BEND,
    );
    return stalked(frame, k, tw, 1, side === -1);
  });
}

/** Three to five branches alternating up the axis, each a little raceme, shorter toward the top under a terminal floret. */
function panicle(frame: Frame, count: number): InflorescenceLayout {
  const branchCount = clamp(
    PANICLE_BRANCHES[0],
    PANICLE_BRANCHES[1],
    Math.ceil((count - 1) / 3),
  );
  const perBranch = Array.from({ length: branchCount }, (_, b) => {
    const base = Math.floor((count - 1) / branchCount);
    return base + (b < (count - 1) % branchCount ? 1 : 0);
  });
  const branches = Array.from({ length: branchCount }, (_, b) => {
    const up = b / Math.max(1, branchCount - 1);
    return axisBranch(
      frame,
      lerp(PANICLE_SPAN[0], PANICLE_SPAN[1], up),
      sideOf(frame, b),
      PANICLE_ANGLE,
      frame.length *
        lerp(PANICLE_LENGTH[0], PANICLE_LENGTH[1], up) *
        frame.lateral,
      lerp(PANICLE_BEND[0], PANICLE_BEND[1], up),
    );
  });
  const firstKs = perBranch.reduce<number[]>(
    (acc, n, b) => [...acc, (acc[b - 1] ?? 1) + (perBranch[b - 1] ?? 0)],
    [],
  );
  const placed = [
    terminal(frame),
    ...branches.flatMap((b, i) =>
      branchFlorets(frame, b, perBranch[i] ?? 0, firstKs[i] ?? 1),
    ),
  ];
  return layoutOf(
    stagedByHeight(frame, placed),
    branches.map(b => stalkPlan(b)),
  );
}

// ── Spray ──

const SPRAY_SPAN = [0.68, 0.92] as const;
const SPRAY_LENGTH = [0.25, 0.17] as const;
const SPRAY_ANGLE = [30 * DEG, 45 * DEG] as const;
const SPRAY_BEND = [55 * DEG, 95 * DEG] as const;
const SPRAY_BUD_AT = 0.78;
const SPRAY_BUD_LENGTH = 0.45;
const SPRAY_BUD_ANGLE = 40 * DEG;
const SPRAY_BUD_BEND = 20 * DEG;
const SPRAY_BUD_SIZE = 1;

/** Branches from the upper third arching down to a nodding head each, with a bud just behind it, under a terminal head. */
function spray(frame: Frame, count: number): InflorescenceLayout {
  const branchCount = count - 1;
  const branches = Array.from({ length: branchCount }, (_, b) => {
    const up = b / Math.max(1, branchCount - 1);
    return axisBranch(
      frame,
      lerp(SPRAY_SPAN[0], SPRAY_SPAN[1], up),
      sideOf(frame, b),
      lerp(SPRAY_ANGLE[0], SPRAY_ANGLE[1], frame.rnd(400 + b)),
      frame.length * lerp(SPRAY_LENGTH[0], SPRAY_LENGTH[1], up) * frame.lateral,
      lerp(SPRAY_BEND[0], SPRAY_BEND[1], frame.rnd(500 + b)),
    );
  });
  const heads = branches.map((b, i) => stalked(frame, 1 + i, b, 1, false));
  const buds = branches.map((b, i): Placed => {
    const tw = twig(
      b,
      SPRAY_BUD_AT,
      -1,
      SPRAY_BUD_ANGLE,
      frame.diameter * SPRAY_BUD_LENGTH,
      SPRAY_BUD_BEND,
    );
    return stalked(frame, 20 + i, tw, SPRAY_BUD_SIZE, true);
  });
  return layoutOf(
    [...allAt(frame.stage, [terminal(frame), ...heads]), ...allAt("Bud", buds)],
    branches.map(b => stalkPlan(b)),
  );
}

// ── Entry ──

const MAX_HEADS: Record<InflorescenceKind, number> = {
  Solitary: 1,
  Spike: 20,
  Raceme: 12,
  Umbel: 16,
  Corymb: 24,
  Panicle: 16,
  Spray: 5,
};
const SPRAY_MIN_HEADS = 3;

/** The head count a kind draws for a requested count. */
export function headCountFor(
  kind: InflorescenceKind,
  requested: number,
): number {
  const wanted = Number.isFinite(requested) ? Math.round(requested) : 1;
  const floor = kind === "Spray" ? SPRAY_MIN_HEADS : 1;
  return clamp(floor, MAX_HEADS[kind], wanted);
}

/** Positions, stages and stalks for every floret of the inflorescence. Deterministic in all inputs. */
export function layoutInflorescence(
  params: InflorescenceParams,
): InflorescenceLayout {
  const { kind, stem, sid, stage } = params;
  const headCount = headCountFor(kind, params.headCount);
  const length = stemAxisLength(stem.axis);
  const diameter =
    length *
    lerp(FLORET_DIAMETER[0], FLORET_DIAMETER[1], unit(params.headScale));
  const frame: Frame = {
    stem,
    length,
    diameter,
    unitScale: diameter / (2 * Math.max(1e-6, params.headRadius)),
    lateral: 0.5 + unit(params.spread),
    stage,
    firstSide: sidHash(sid, 1) < 0.5 ? -1 : 1,
    rnd: salt => sidHash(sid, salt),
  };
  if (headCount <= 1 || length < 1e-6) {
    return solitaryLayout(stem, frame.unitScale, stage);
  }

  switch (kind) {
    case "Solitary":
      return solitaryLayout(stem, frame.unitScale, stage);
    case "Spike":
      return spike(frame, headCount);
    case "Raceme":
      return raceme(frame, headCount);
    case "Umbel":
      return umbel(frame, headCount);
    case "Corymb":
      return corymb(frame, headCount);
    case "Panicle":
      return panicle(frame, headCount);
    case "Spray":
      return spray(frame, headCount);
    default:
      return unreachable(kind);
  }
}
