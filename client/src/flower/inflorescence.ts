/**
 * Inflorescence (spec section 3.2): where a flower's secondary heads sit
 * relative to the primary at the origin, and the pedicels that carry them.
 * Floret 0 is always the primary at (0, 0) with scale 1. Screen space is
 * y-down: the stem hangs below the primary, so "up the stem" is toward y = 0.
 * Distances along the stem shrink to fit its upper share; distances from the
 * axis follow the head size and `spread`.
 */

import type { InflorescenceKind } from "../data/flower-enums.ts";
import type { DrawCmd } from "./geometry.ts";
import {
  generateStem,
  stemAxis,
  stemAxisLength,
  stemPointAt,
  type StemPlan,
} from "./stem.ts";
import { clamp, sidHash, unreachable } from "./util.ts";

export type Floret = {
  offsetX: number;
  offsetY: number;
  /** head size relative to the primary */
  scale: number;
  /** tilt of the head along its pedicel, radians, 0 upright */
  angle: number;
};

export type InflorescenceLayout = {
  /** the primary first, then the secondary heads in layout order */
  florets: readonly [Floret, ...Floret[]];
  pedicels: DrawCmd[];
};

export type InflorescenceParams = {
  kind: InflorescenceKind;
  headCount: number;
  /** 0-1 size of the secondary heads relative to the primary */
  headScale: number;
  /** 0-1 how far the heads sit from the axis */
  spread: number;
  stem: StemPlan;
  /** reach of the primary head's outline from its centre, plan units */
  headRadius: number;
  sid: number;
};

const PRIMARY_FLORET: Floret = {
  offsetX: 0,
  offsetY: 0,
  scale: 1,
  angle: 0,
};

export const SOLITARY_LAYOUT: InflorescenceLayout = {
  florets: [PRIMARY_FLORET],
  pedicels: [],
};

const MAX_HEADS = 12;
/** Level rings (umbel, corymb) pack heads side by side, so they hold fewer before they sprawl. */
const LEVEL_MAX_HEADS = 9;
const SPRAY_MIN_HEADS = 3;
const SPRAY_MAX_HEADS = 5;
const MIN_HEAD_SCALE = 0.2;
/** the part of the stem, from the tip down, that heads may occupy */
const STEM_SHARE = 0.7;
const STEM_FLOOR = 1 - STEM_SHARE;
/** pedicel half width relative to the stem's */
const PEDICEL_WIDTH = 0.55;
const TILT_DAMPING = 0.35;
const MAX_TILT = 0.5;
/** level-ring spacing between neighbouring heads, in units of (primary + secondary radius) */
const LEVEL_STEP = 0.55;
const RACEME_STALK_ANGLE = Math.PI * 0.2;
const PANICLE_BRANCH_ANGLE = Math.PI * 0.22;
/** how far below its branch's direction a panicle twig leaves the branch */
const PANICLE_TWIG_DROP = Math.PI * 0.3;
const SPRAY_ARCH = 0.6;

type Point = { x: number; y: number };

/** Everything the per-kind layouts share, in plan units. */
type Frame = {
  stem: StemPlan;
  stemLength: number;
  primaryRadius: number;
  secondaryRadius: number;
  secondaryScale: number;
  /** 0.5-1.5 multiplier on every distance from the axis */
  lateral: number;
  firstSide: 1 | -1;
};

type Placed = { floret: Floret; pedicel: DrawCmd[] };

/** Secondaries alternate sides; the seed picks the side of the first. */
const sideOf = (frame: Frame, j: number): number =>
  j % 2 === 1 ? frame.firstSide : -frame.firstSide;

/** 1 for the first pair of secondaries, 2 for the next, and so on. */
const ringOf = (j: number): number => Math.ceil(j / 2);

const isEven = (j: number): boolean => j % 2 === 0;

/** The axis point `drop` plan units below the tip, never below `minT` of the stem. */
function axisPointBelowTip(frame: Frame, drop: number, minT: number): Point {
  const t = clamp(minT, 1, 1 - drop / frame.stemLength);
  return stemPointAt(frame.stem.axis, t);
}

/** Shrink factor that keeps the deepest drop inside the stem's share. */
function fitToStem(frame: Frame, deepestDrop: number): number {
  return Math.min(1, (frame.stemLength * STEM_SHARE) / deepestDrop);
}

/** A secondary head at `head`, tilted along its pedicel from `from`, damped. */
function floretAt(frame: Frame, head: Point, from: Point): Floret {
  const tilt = Math.atan2(head.x - from.x, from.y - head.y) * TILT_DAMPING;
  return {
    offsetX: head.x,
    offsetY: head.y,
    scale: frame.secondaryScale,
    angle: clamp(-MAX_TILT, MAX_TILT, tilt),
  };
}

function pedicel(
  frame: Frame,
  from: Point,
  to: Point,
  curvature = 0,
): DrawCmd[] {
  return generateStem(
    stemAxis([from.x, from.y], [to.x, to.y], curvature, "Straight"),
    frame.stem.halfWidth * PEDICEL_WIDTH,
    "Straight",
  );
}

/** A secondary head on its own pedicel from `from`. */
const stalked = (
  frame: Frame,
  from: Point,
  head: Point,
  curvature = 0,
): Placed => ({
  floret: floretAt(frame, head, from),
  pedicel: pedicel(frame, from, head, curvature),
});

const assemble = (placed: readonly Placed[]): InflorescenceLayout => ({
  florets: [PRIMARY_FLORET, ...placed.map(p => p.floret)],
  pedicels: placed.flatMap(p => p.pedicel),
});

const secondaries = (count: number): number[] =>
  Array.from({ length: count }, (_, k) => k + 1);

/** Heads on the axis itself, packed from just under the primary down the stem. */
function spike(frame: Frame, count: number): InflorescenceLayout {
  const { primaryRadius: rp, secondaryRadius: rs } = frame;
  const first = 0.8 * (rp + rs);
  const step = 1.6 * rs;
  const fit = fitToStem(frame, first + (count - 1) * step);
  return assemble(
    secondaries(count).map(j => {
      const p = axisPointBelowTip(frame, (first + (j - 1) * step) * fit, 0);
      return {
        floret: {
          offsetX: p.x,
          offsetY: p.y,
          scale: frame.secondaryScale,
          angle: 0,
        },
        pedicel: [],
      };
    }),
  );
}

/** Short stalks alternating up the stem, each angled upward from its node. */
function raceme(frame: Frame, count: number): InflorescenceLayout {
  const { primaryRadius: rp, secondaryRadius: rs } = frame;
  const first = 0.6 * rp + 0.4 * rs;
  const step = 1.2 * rs;
  const fit = fitToStem(frame, first + (count - 1) * step);
  const stalk = frame.stem.halfWidth + rs * 0.9 * frame.lateral;
  return assemble(
    secondaries(count).map(j => {
      const attach = axisPointBelowTip(
        frame,
        (first + (j - 1) * step) * fit,
        0,
      );
      const head = {
        x: attach.x + sideOf(frame, j) * Math.cos(RACEME_STALK_ANGLE) * stalk,
        y: attach.y - Math.sin(RACEME_STALK_ANGLE) * stalk,
      };
      return stalked(frame, attach, head);
    }),
  );
}

/** Head j of a level ring: pairs step outward from the primary at the primary's height. */
function levelHead(frame: Frame, j: number): Point {
  const step =
    (frame.primaryRadius + frame.secondaryRadius) * LEVEL_STEP * frame.lateral;
  return { x: sideOf(frame, j) * ringOf(j) * step, y: 0 };
}

/** Stalks fanning from one point below the primary to a level ring of heads. */
function umbel(frame: Frame, count: number): InflorescenceLayout {
  const fan = axisPointBelowTip(
    frame,
    frame.primaryRadius * (0.6 + 0.4 * frame.lateral),
    STEM_FLOOR,
  );
  return assemble(
    secondaries(count).map(j => stalked(frame, fan, levelHead(frame, j))),
  );
}

/** Stalks from different heights, the outer ones lower, all reaching a level top. */
function corymb(frame: Frame, count: number): InflorescenceLayout {
  const rp = frame.primaryRadius;
  const dropOf = (j: number): number =>
    rp * (0.5 + 0.5 * ringOf(j)) + (isEven(j) ? rp * 0.2 : 0);
  const fit = fitToStem(frame, dropOf(count));
  return assemble(
    secondaries(count).map(j => {
      const attach = axisPointBelowTip(frame, dropOf(j) * fit, STEM_FLOOR);
      return stalked(frame, attach, levelHead(frame, j));
    }),
  );
}

/**
 * Branches alternating down the stem, each with a head at its tip and a second
 * head on a twig from its middle; lower branches are longer, so the heads form
 * a pyramid under the primary. On a short stem the branches flatten rather
 * than rise past the primary.
 */
function panicle(frame: Frame, count: number): InflorescenceLayout {
  const { primaryRadius: rp, secondaryRadius: rs } = frame;
  const branchCount = Math.ceil(count / 2);
  const dropOf = (b: number): number => (rp + rs) * (0.9 + 0.8 * (b - 1));
  const fit = fitToStem(frame, dropOf(branchCount));
  const tipFloor = rs * 0.3;
  const placed = secondaries(branchCount).flatMap(b => {
    const side = sideOf(frame, b);
    const attach = axisPointBelowTip(frame, dropOf(b) * fit, STEM_FLOOR);
    const length = (rp + rs * 1.2 * b) * frame.lateral;
    const rise = Math.min(
      Math.sin(PANICLE_BRANCH_ANGLE) * length,
      Math.max(0, attach.y - tipFloor),
    );
    const run = Math.sqrt(length * length - rise * rise);
    const dir = { x: (side * run) / length, y: -rise / length };
    const tip = { x: attach.x + dir.x * length, y: attach.y + dir.y * length };
    const branch = stalked(frame, attach, tip);
    if (2 * b > count) return [branch];
    const fork = {
      x: attach.x + dir.x * length * 0.45,
      y: attach.y + dir.y * length * 0.45,
    };
    const twigAngle = Math.atan2(rise, run) - PANICLE_TWIG_DROP;
    const twigDir = { x: side * Math.cos(twigAngle), y: -Math.sin(twigAngle) };
    const roomBelow = frame.stem.axis.fromY - fork.y;
    const twigLength =
      twigDir.y > 0
        ? Math.min(length * 0.6, roomBelow / twigDir.y)
        : length * 0.6;
    const twig = {
      x: fork.x + twigDir.x * twigLength,
      y: fork.y + twigDir.y * twigLength,
    };
    return [branch, stalked(frame, fork, twig)];
  });
  return assemble(placed);
}

/** Arching branches from the upper stem to heads beside and below the primary. */
function spray(frame: Frame, count: number): InflorescenceLayout {
  const { primaryRadius: rp, secondaryRadius: rs } = frame;
  return assemble(
    secondaries(count).map(j => {
      const side = sideOf(frame, j);
      const ring = ringOf(j);
      const head = {
        x: side * (rp + rs) * 0.85 * frame.lateral * (1 + 0.3 * (ring - 1)),
        y: rs * 0.6 + rp * 0.4 * (ring - 1) + (isEven(j) ? rs * 0.4 : 0),
      };
      const attach = axisPointBelowTip(
        frame,
        frame.stemLength * (0.25 + 0.18 * (ring - 1) + (isEven(j) ? 0.09 : 0)),
        STEM_FLOOR,
      );
      return stalked(frame, attach, head, -SPRAY_ARCH * side);
    }),
  );
}

/** The head count a kind draws for a requested count: Solitary is 1, Spray 3-5, level rings 1-9, the rest 1-12. */
function headCountFor(kind: InflorescenceKind, requested: number): number {
  const wanted = Number.isFinite(requested) ? Math.round(requested) : 1;
  switch (kind) {
    case "Solitary":
      return 1;
    case "Spray":
      return clamp(SPRAY_MIN_HEADS, SPRAY_MAX_HEADS, wanted);
    case "Umbel":
    case "Corymb":
      return clamp(1, LEVEL_MAX_HEADS, wanted);
    case "Spike":
    case "Raceme":
    case "Panicle":
      return clamp(1, MAX_HEADS, wanted);
    default:
      return unreachable(kind);
  }
}

/** Positions and pedicels for every head of the inflorescence. Deterministic in all inputs. */
export function layoutInflorescence(
  params: InflorescenceParams,
): InflorescenceLayout {
  const { kind, stem, sid } = params;
  const headCount = headCountFor(kind, params.headCount);
  const stemLength = stemAxisLength(stem.axis);
  if (headCount <= 1 || stemLength < 1e-6) return SOLITARY_LAYOUT;

  const secondaryScale = clamp(MIN_HEAD_SCALE, 1, params.headScale);
  const frame: Frame = {
    stem,
    stemLength,
    primaryRadius: params.headRadius,
    secondaryRadius: params.headRadius * secondaryScale,
    secondaryScale,
    lateral: 0.5 + clamp(0, 1, params.spread),
    firstSide: sidHash(sid, 1) < 0.5 ? -1 : 1,
  };
  const count = headCount - 1;

  switch (kind) {
    case "Solitary":
      return SOLITARY_LAYOUT;
    case "Spike":
      return spike(frame, count);
    case "Raceme":
      return raceme(frame, count);
    case "Umbel":
      return umbel(frame, count);
    case "Corymb":
      return corymb(frame, count);
    case "Panicle":
      return panicle(frame, count);
    case "Spray":
      return spray(frame, count);
    default:
      return unreachable(kind);
  }
}
