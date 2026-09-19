/**
 * Fused corolla (spec section 3.1). A layer whose fusion kind is not Free is
 * drawn as one cup seen from above: the body is the cup's silhouette, the
 * throat the dark opening at its centre, and `count` lobes sit on the rim.
 * Each lobe is a petal frame, so texture, marks and veins draw on it exactly
 * as on a free petal.
 */

import type {
  EdgeStyle,
  FusionKind,
  PetalShape,
} from "../data/flower-enums.ts";
import { darkenColor, lightenColor } from "./color.ts";
import { closedSmoothCmds, type DrawCmd, type Vec2 } from "./geometry.ts";
import {
  createPetalFrame,
  petalLength,
  placePetal,
  type PetalFrame,
  type PlacedPetal,
} from "./petal.ts";
import { sidHash } from "./util.ts";

export type FusedKind = Exclude<FusionKind, "Free">;

export const isFused = (kind: FusionKind): kind is FusedKind => kind !== "Free";

/** The petal layer fields a corolla is built from, color already resolved. */
export type CorollaLayer = {
  shape: PetalShape;
  edge: EdgeStyle;
  /** spec layer.length (0.1-5.0) */
  length: number;
  /** spec layer.width (0.1-3.0) */
  width: number;
  curvature: number;
  curl: number;
  color: number;
};

export type Throat = {
  /** radius of the dark opening; the center disc is clamped to it */
  radius: number;
  innerColor: number;
  rimColor: number;
};

export type Corolla = {
  /** one closed scalloped outline, the cup's silhouette from above */
  body: DrawCmd[];
  /** silhouette radius at the lobe centres */
  bodyRadius: number;
  /** radius of the rim opening where the lobes attach; equals bodyRadius when the cup is widest at the rim */
  rimRadius: number;
  lobes: PlacedPetal[];
  throat: Throat;
};

type CupShape = {
  /** projected radius fraction of the fused extent at s in [0, 1], base to rim */
  profile: (s: number) => number;
  /** rim dip between lobes as a fraction of the body radius */
  scallop: number;
  /** lobe length relative to the free fraction of the petal */
  lobeScale: number;
};

const CUP_SHAPES: Record<FusedKind, CupShape> = {
  // widens, is widest at three quarters, then curves in to the rim
  Bell: {
    profile: s => 0.15 + 0.85 * Math.sin(Math.PI * (0.05 + 0.6 * s)),
    scallop: 0.04,
    lobeScale: 1,
  },
  // narrow tube flaring outward, widest at the rim
  Trumpet: {
    profile: s => 0.15 + 0.85 * s * s,
    scallop: 0.1,
    lobeScale: 1,
  },
  // bulges past the middle, then narrows to a rim inside the bulge
  Urn: {
    profile: s => 0.2 + 0.8 * Math.sin(Math.PI * (0.08 + 0.75 * s)),
    scallop: 0.02,
    lobeScale: 0.8,
  },
  Funnel: {
    profile: s => 0.15 + 0.85 * s,
    scallop: 0.08,
    lobeScale: 1,
  },
  Tube: {
    profile: s => 0.25 + 0.1 * s,
    scallop: 0.06,
    lobeScale: 0.6,
  },
};

const MIN_DEPTH = 0.1;
const MAX_DEPTH = 0.9;
const PROFILE_SAMPLES = 16;
const BODY_POINTS_PER_LOBE = 8;
const MIN_BODY_POINTS = 24;
const TAU = Math.PI * 2;

/** Projected radius fraction of the fused extent at s in [0, 1], base to rim. */
export function corollaProfile(kind: FusedKind, s: number): number {
  return CUP_SHAPES[kind].profile(Math.max(0, Math.min(1, s)));
}

const clampDepth = (depth: number): number =>
  Math.max(MIN_DEPTH, Math.min(MAX_DEPTH, depth));

const frameAngle = (frame: PetalFrame): number =>
  Math.atan2(frame.sinA, frame.cosA);

/** The same frame with its base moved so the spine starts at `along`. */
function frameStartingAt(frame: PetalFrame, along: number): PetalFrame {
  const shift = along - frame.spine[0]!.along;
  return {
    ...frame,
    spine: frame.spine.map(station => ({
      ...station,
      along: station.along + shift,
    })),
  };
}

function generateBody(
  bodyRadius: number,
  count: number,
  angle: number,
  scallop: number,
): DrawCmd[] {
  const pointCount = Math.max(MIN_BODY_POINTS, count * BODY_POINTS_PER_LOBE);
  const points = Array.from({ length: pointCount }, (_, k): Vec2 => {
    const local = (k / pointCount) * TAU;
    const sinus = 0.5 - 0.5 * Math.cos(count * local);
    const rho = bodyRadius * (1 - scallop * sinus);
    const theta = angle + local;
    return [Math.cos(theta) * rho, Math.sin(theta) * rho];
  });
  return closedSmoothCmds(points);
}

/**
 * One fused corolla for a layer. `frame` is the layer's reference petal at the
 * layer's base angle: its base offset and length set the fused extent, and the
 * lobes fan out from its angle. `depth` is the fused fraction of the petal
 * length, `count` the number of lobes, `seed` drives the per-lobe jitter.
 */
export function generateCorolla(
  layer: CorollaLayer,
  frame: PetalFrame,
  kind: FusedKind,
  depth: number,
  count: number,
  seed: number,
): Corolla {
  const cup = CUP_SHAPES[kind];
  const fused = clampDepth(depth);
  const baseAlong = frame.spine[0]!.along;
  const fusedLength = petalLength(frame) * fused;
  const angle = frameAngle(frame);

  const profileMax = Math.max(
    ...Array.from({ length: PROFILE_SAMPLES + 1 }, (_, i) =>
      cup.profile(i / PROFILE_SAMPLES),
    ),
  );
  const bodyRadius = baseAlong + fusedLength * profileMax;
  const rimRadius = baseAlong + fusedLength * cup.profile(1);
  const throatRadius = baseAlong + fusedLength * cup.profile(0);

  const lobes = Array.from({ length: count }, (_, i): PlacedPetal => {
    const lobeAngle = angle + (i / count) * TAU;
    const lenJitter = 1 + (sidHash(seed, 400 + i) * 0.08 - 0.04);
    const widJitter = 1 + (sidHash(seed, 500 + i) * 0.06 - 0.03);
    const lobeFrame = createPetalFrame({
      angle: lobeAngle,
      shape: layer.shape,
      edge: layer.edge,
      length: layer.length * lenJitter,
      width: layer.width * widJitter,
      curvature: layer.curvature,
      curl: layer.curl,
      seed: sidHash(seed, 10 + i),
      radialOffset: (1 - fused) * cup.lobeScale,
    });
    return placePetal(frameStartingAt(lobeFrame, rimRadius), lobeAngle);
  });

  return {
    body: generateBody(bodyRadius, count, angle, cup.scallop),
    bodyRadius,
    rimRadius,
    lobes,
    throat: {
      radius: throatRadius,
      innerColor: darkenColor(layer.color, 0.35),
      rimColor: lightenColor(layer.color, 0.05),
    },
  };
}
