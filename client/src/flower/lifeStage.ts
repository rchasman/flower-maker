/**
 * Life stage (spec section 3.3): how a head at each LifeStage differs from
 * the bloom, the seed head that replaces the petals, and the side buds on the
 * stem. Nothing here depends on render.ts, so render.ts can import it.
 */

import type {
  FlowerFamily,
  FusionKind,
  LifeStage,
  PetalArrangement,
  PetalShape,
  Side,
} from "../data/flower-enums.ts";
import { darkenColor, lerpColor } from "./color.ts";
import {
  circleCmds,
  closedSmoothCmds,
  smoothCmds,
  type DrawCmd,
  type Vec2,
} from "./geometry.ts";
import {
  generateStem,
  sideHeading,
  stemAxis,
  stemPointAt,
  type StemAxis,
} from "./stem.ts";
import {
  GOLDEN_ANGLE,
  clamp,
  sidHash,
  sideSign,
  steps,
  unreachable,
} from "./util.ts";

const TAU = Math.PI * 2;

// ═══════════════════════════════════════════════════════════════════════════
// Stage profile: what the head does at each stage besides its petal layers
// ═══════════════════════════════════════════════════════════════════════════

export type StageProfile = {
  /** scales every petal's phyllotaxis radial offset; below 1 pulls the ring in over the centre */
  radialOffset: number;
  /** stamens, pollen and the nectary are drawn only while the throat is open */
  throatOpen: boolean;
  /** how far the petal colors move toward gray */
  desaturation: number;
  /** the sepal frame: cupped and wide around a bud, reflexed under a fading head */
  sepals: { curvature: number; width: number; lengthScale: number };
};

/** The Rust `#[default]`, which is not the first LifeStage variant. */
export const DEFAULT_LIFE_STAGE: LifeStage = "Bloom";

const BLOOM_SEPALS = { curvature: 0.1, width: 0.3, lengthScale: 1 };

export const STAGE_PROFILES: Record<LifeStage, StageProfile> = {
  Bud: {
    radialOffset: 0.8,
    throatOpen: false,
    desaturation: 0,
    sepals: { curvature: 0.7, width: 0.45, lengthScale: 1.8 },
  },
  Opening: {
    radialOffset: 1,
    throatOpen: true,
    desaturation: 0,
    sepals: { curvature: 0.4, width: 0.35, lengthScale: 1 },
  },
  Bloom: {
    radialOffset: 1,
    throatOpen: true,
    desaturation: 0,
    sepals: BLOOM_SEPALS,
  },
  Fading: {
    radialOffset: 1,
    throatOpen: true,
    desaturation: 0.35,
    sepals: { ...BLOOM_SEPALS, curvature: -0.2 },
  },
  SeedHead: {
    radialOffset: 1,
    throatOpen: false,
    desaturation: 0,
    sepals: { ...BLOOM_SEPALS, curvature: -0.3 },
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// Petal layers per stage
// ═══════════════════════════════════════════════════════════════════════════

/** The petal layer fields a stage reads or rewrites; render.ts's parsed layer satisfies it. */
export type StageLayerFields = {
  count: number;
  shape: PetalShape;
  arrangement: PetalArrangement;
  width: number;
  length: number;
  curvature: number;
  droop: number;
  opacity: number;
  color: number | null;
  fusion: { kind: FusionKind; depth: number };
};

const BUD_SHELL_MIN = 3;
const BUD_SHELL_MAX = 5;
/** a shell petal must be wide enough for three to five of them to close over the centre */
const BUD_SHELL_MIN_WIDTH = 0.9;
/** the shell stays inside the sepals, which grow past their bloom length around a bud */
const BUD_SHELL_LENGTH = 0.7;
/** how far a bud's shell is tinted from the sepal color toward the petal color */
const BUD_SHELL_PETAL_TINT = 0.4;

/** A closed bud is mostly sepal green with the petal color showing through. */
export const budShellColor = (sepalColor: number, petalColor: number): number =>
  lerpColor(sepalColor, petalColor, BUD_SHELL_PETAL_TINT);
const OPENING_LENGTH = 0.6;
const OPENING_CURVATURE = 0.4;
const FADING_LOSS = 0.2;
const FADING_DROOP = 0.3;
const FADING_OPACITY = 0.85;

/** About a fifth of the petals have dropped, never below one. */
export const fadedCount = (count: number): number =>
  Math.max(1, count - Math.round(count * FADING_LOSS));

/**
 * The layers a head at `stage` draws. Bud: one closed shell of ovate petals in
 * `shellColor`. Opening: the outer layer only, shorter and more cupped.
 * Fading: every layer with fewer, drooping, paler petals. SeedHead: none.
 */
export function stageLayers<L extends StageLayerFields>(
  stage: LifeStage,
  layers: readonly L[],
  shellColor: number,
): L[] {
  const outer = layers[0];
  switch (stage) {
    case "Bud":
      return outer
        ? [
            {
              ...outer,
              count: clamp(BUD_SHELL_MIN, BUD_SHELL_MAX, outer.count),
              shape: "Ovate",
              arrangement: "Radial",
              width: Math.max(outer.width, BUD_SHELL_MIN_WIDTH),
              length: outer.length * BUD_SHELL_LENGTH,
              curvature: 0.9,
              color: shellColor,
              fusion: { kind: "Free", depth: 0 },
            },
          ]
        : [];
    case "Opening":
      return outer
        ? [
            {
              ...outer,
              length: outer.length * OPENING_LENGTH,
              curvature: outer.curvature + OPENING_CURVATURE,
            },
          ]
        : [];
    case "Bloom":
      return [...layers];
    case "Fading":
      return layers.map(layer => ({
        ...layer,
        count: fadedCount(layer.count),
        droop: layer.droop + FADING_DROOP,
        opacity: layer.opacity * FADING_OPACITY,
      }));
    case "SeedHead":
      return [];
    default:
      return unreachable(stage);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Seed head
// ═══════════════════════════════════════════════════════════════════════════

export type SeedHeadPlan = {
  /** the enlarged receptacle, plan units */
  discRadius: number;
  /** dense golden-angle dots over the receptacle, closed polygons */
  stipple: DrawCmd[];
  stippleColor: number;
  /** pappus anthers for disc families, teardrop seed marks otherwise */
  fills: DrawCmd[];
  fillColor: number;
  /** straight pappus hairs from the disc edge; empty outside disc families */
  strokes: DrawCmd[];
  strokeColor: number;
  /** plan units */
  strokeWidth: number;
};

/** Families whose seed head is a clock of straight pale hairs, like a dandelion. */
const PAPPUS_FAMILIES: readonly FlowerFamily[] = ["Asteraceae", "Apiaceae"];

export const hasPappus = (family: FlowerFamily): boolean =>
  PAPPUS_FAMILIES.includes(family);

const SEED_HEAD_SCALE = 1.8;
const MIN_BLOOM_DISC = 0.05;
const STIPPLE_COUNT = 48;
const PAPPUS_COUNT = 28;
const SEED_COUNT = 24;
const PAPPUS_COLOR = 0xefe9dc;
const PAPPUS_ANTHER_COLOR = 0xf8f3e9;

/** A rounded seed pointing along `angle`, centred at (cx, cy). */
function teardropCmds(
  cx: number,
  cy: number,
  angle: number,
  length: number,
  halfWidth: number,
): DrawCmd[] {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const local: Vec2[] = [
    [-0.4, 0],
    [-0.15, 0.85],
    [0.15, 0.7],
    [0.6, 0],
    [0.15, -0.7],
    [-0.15, -0.85],
  ];
  return closedSmoothCmds(
    local.map(([along, perp]): Vec2 => {
      const a = along * length;
      const p = perp * halfWidth;
      return [cx + cos * a - sin * p, cy + sin * a + cos * p];
    }),
  );
}

/**
 * The receptacle after the petals have gone: 1.8 times the bloom's disc,
 * densely stippled, with a pappus for disc families and seed marks otherwise.
 */
export function buildSeedHead(
  bloomDiscRadius: number,
  discColor: number,
  family: FlowerFamily,
  sid: number,
): SeedHeadPlan {
  const r = Math.max(MIN_BLOOM_DISC, bloomDiscRadius) * SEED_HEAD_SCALE;
  const stipple = Array.from({ length: STIPPLE_COUNT }, (_, i) => {
    const dist = r * 0.92 * Math.sqrt((i + 0.5) / STIPPLE_COUNT);
    const theta = i * GOLDEN_ANGLE;
    return circleCmds(
      Math.cos(theta) * dist,
      Math.sin(theta) * dist,
      r * 0.045,
      6,
    );
  }).flat();

  if (hasPappus(family)) {
    const hairs = Array.from({ length: PAPPUS_COUNT }, (_, j) => {
      const theta =
        (j / PAPPUS_COUNT) * TAU + (sidHash(sid, 1900 + j) - 0.5) * 0.12;
      return { cos: Math.cos(theta), sin: Math.sin(theta) };
    });
    const inner = r * 0.8;
    const outer = r * 2.1;
    return {
      discRadius: r,
      stipple,
      stippleColor: darkenColor(discColor, 0.55),
      fills: hairs.flatMap(h =>
        circleCmds(h.cos * outer, h.sin * outer, r * 0.07, 8),
      ),
      fillColor: PAPPUS_ANTHER_COLOR,
      strokes: hairs.flatMap((h): DrawCmd[] => [
        { op: "M", x: h.cos * inner, y: h.sin * inner },
        { op: "L", x: h.cos * outer, y: h.sin * outer },
      ]),
      strokeColor: PAPPUS_COLOR,
      strokeWidth: 0.006,
    };
  }

  const seeds = Array.from({ length: SEED_COUNT }, (_, i) => {
    const dist = r * (0.25 + 0.6 * Math.sqrt((i + 0.5) / SEED_COUNT));
    const theta = i * GOLDEN_ANGLE + sidHash(sid, 2000 + i) * 0.2;
    return teardropCmds(
      Math.cos(theta) * dist,
      Math.sin(theta) * dist,
      theta,
      r * 0.18,
      r * 0.08,
    );
  }).flat();
  return {
    discRadius: r,
    stipple,
    stippleColor: darkenColor(discColor, 0.55),
    fills: seeds,
    fillColor: darkenColor(discColor, 0.45),
    strokes: [],
    strokeColor: PAPPUS_COLOR,
    strokeWidth: 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Side buds on the stem
// ═══════════════════════════════════════════════════════════════════════════

/** Rust `Bud`. */
export type BudSource = {
  /** 0 base, 1 head, along the stem */
  position: number;
  side: Side;
  /** relative to the primary head */
  size: number;
  /** 0 closed, 1 nearly open */
  openness: number;
};

export type BudPlan = {
  /** closed outline from the stem to the shell base */
  pedicel: DrawCmd[];
  pedicelColor: number;
  /** the closed sepal shell */
  shell: DrawCmd[];
  shellColor: number;
  /** two sepal seams along the shell, strokes */
  seams: DrawCmd[];
  /** petal color showing between the sepals; empty until openness passes 0.6 */
  petal: DrawCmd[];
  petalColor: number;
};

export type BudContext = {
  axis: StemAxis;
  stemHalfWidth: number;
  stemColor: number;
  /** reach of the primary head; a bud of size 1 is almost that long */
  headReach: number;
  shellColor: number;
  petalColor: number;
};

const BUD_OPEN_THRESHOLD = 0.6;
/** how far the bud leans from the stem's perpendicular toward its tip */
const BUD_LEAN = Math.PI * 0.3;
const BUD_STATIONS = 12;
const BUD_LENGTH = 0.9;
const BUD_HALF_WIDTH = 0.32;
const PEDICEL_LENGTH = 0.5;
const PEDICEL_HALF_WIDTH = 0.45;

/** Half width of an ovate shell at t along it, widest below the middle. */
const shellWidthAt = (t: number, halfWidth: number): number =>
  halfWidth * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.75)), 0.8);

/** A closed outline around the axis from stations sampled once per side; the ends are shared. */
function spindleCmds(
  ts: readonly number[],
  point: (t: number, u: number) => Vec2,
  widthAt: (t: number) => number,
): DrawCmd[] {
  return closedSmoothCmds([
    ...ts.map(t => point(t, widthAt(t))),
    ...ts
      .slice(1, -1)
      .toReversed()
      .map(t => point(t, -widthAt(t))),
  ]);
}

function generateBud(bud: BudSource, ctx: BudContext): BudPlan {
  const pt = stemPointAt(ctx.axis, clamp(0.05, 0.95, bud.position));
  const dirAngle = sideHeading(pt.angle, bud.side, BUD_LEAN);
  const dx = Math.cos(dirAngle);
  const dy = Math.sin(dirAngle);
  const nx = -dy;
  const ny = dx;

  const length = ctx.headReach * clamp(0.05, 1, bud.size) * BUD_LENGTH;
  const halfWidth = length * BUD_HALF_WIDTH;
  const pedicelLength = length * PEDICEL_LENGTH + ctx.stemHalfWidth;
  const base: Vec2 = [pt.x + dx * pedicelLength, pt.y + dy * pedicelLength];
  const point = (t: number, u: number): Vec2 => [
    base[0] + dx * t * length + nx * u,
    base[1] + dy * t * length + ny * u,
  ];
  const width = (t: number) => shellWidthAt(t, halfWidth);

  const sliverTs = steps(6).map(s => 0.5 + s * 0.58);
  const sliverWidth = (t: number) =>
    halfWidth * 0.25 * Math.sin((Math.PI * (t - 0.5)) / 0.58);

  return {
    pedicel: generateStem(
      stemAxis([pt.x, pt.y], base, sideSign(bud.side) * 0.2, "Straight"),
      ctx.stemHalfWidth * PEDICEL_HALF_WIDTH,
    ),
    pedicelColor: ctx.stemColor,
    shell: spindleCmds(steps(BUD_STATIONS), point, width),
    shellColor: ctx.shellColor,
    seams: [-0.35, 0.35].flatMap(u =>
      smoothCmds([0.02, 0.35, 0.7, 0.95].map(t => point(t, u * width(t)))),
    ),
    petal:
      bud.openness > BUD_OPEN_THRESHOLD
        ? spindleCmds(sliverTs, point, sliverWidth)
        : [],
    petalColor: ctx.petalColor,
  };
}

/** One shell per bud, on its side of the stem, drawn before the heads. */
export function generateBuds(
  buds: readonly BudSource[],
  ctx: BudContext,
): BudPlan[] {
  return buds.map(bud => generateBud(bud, ctx));
}
