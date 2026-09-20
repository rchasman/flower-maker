/**
 * Leaf geometry: the outline, its veins and its variegation marks, all built
 * in one leaf-local frame. `t` runs petiole to tip in [0, 1]; `u` runs across
 * the blade in [-1, 1], where |u| = 1 is the drawn edge on that side. Marks
 * laid out in (t, u) therefore stay inside the outline for every shape,
 * serration and droop.
 */

import type {
  LeafShape,
  Serration,
  VariegationKind,
} from "../data/flower-enums.ts";
import {
  polygonCmds,
  smoothCmds,
  type DrawCmd,
  type Vec2,
} from "./geometry.ts";
import {
  branch,
  branchTipHalfWidth,
  stalkPlan,
  type StalkPlan,
} from "./stem.ts";
import { lerp, sidHash, unreachable } from "./util.ts";

// ── Leaf shape profiles — width at t ∈ [0,1] (petiole → tip) ──

const LEAF_PROFILES: Record<LeafShape, (t: number) => number> = {
  // Egg-shaped — widest at ~35%
  Ovate: t => Math.sin(Math.PI * Math.pow(t, 0.65)),
  // Narrow lance — widest near 25%, long taper
  Lanceolate: t => Math.sin(Math.PI * t) * Math.pow(1 - t, 0.2) * 1.1,
  // Heart-shaped — very wide base, notched tip
  Cordate: t => {
    const base = Math.sin(Math.PI * Math.pow(t, 0.5)) * 1.2;
    return t < 0.1 ? base * (0.4 + t * 6) : base;
  },
  // Hand-shaped — wide with undulations suggesting lobes
  Palmate: t => {
    const base = Math.sin(Math.PI * Math.pow(t, 0.55));
    const lobes = 1 + Math.sin(t * Math.PI * 5) * 0.15 * Math.sin(Math.PI * t);
    return base * lobes;
  },
  // Feather-like — narrow, with slight scallops
  Pinnate: t => {
    const base = Math.sin(Math.PI * t) * 0.7;
    const scallop = 1 + Math.sin(t * Math.PI * 8) * 0.1;
    return base * scallop;
  },
  // Grass-like — uniform narrow width
  Linear: t => {
    if (t < 0.05) return (t / 0.05) * 0.35;
    if (t > 0.9) return 0.35 * (1 - (t - 0.9) / 0.1);
    return 0.35;
  },
  // Kidney-shaped — very wide and rounded
  Reniform: t => Math.sqrt(Math.max(0, Math.sin(Math.PI * t))) * 1.3,
  // Arrow-shaped — barbed base
  Sagittate: t => {
    if (t < 0.15) return 0.6 + (1 - t / 0.15) * 0.5;
    return Math.sin(Math.PI * Math.pow(t, 0.7)) * 0.9;
  },
  // Shield-shaped — round
  Peltate: t => Math.sqrt(Math.max(0, Math.sin(Math.PI * t))) * 1.1,
  // Needle — very narrow
  Acicular: t => {
    if (t < 0.05) return (t / 0.05) * 0.18;
    return 0.18 * (1 - Math.pow(t, 2));
  },
  // Halberd-shaped
  Hastate: t => {
    if (t < 0.12) return 0.5 + (1 - t / 0.12) * 0.4;
    return Math.sin(Math.PI * Math.pow(t, 0.65)) * 0.85;
  },
  // Reverse egg — widest near tip (~65%)
  Obovate: t => Math.sin(Math.PI * Math.pow(t, 1.4)),
  // Evenly oval — symmetric, widest at center
  Elliptic: t => Math.sin(Math.PI * t) * 0.95,
  // Reverse lance — widest near tip, long basal taper
  Oblanceolate: t => Math.sin(Math.PI * t) * Math.pow(t, 0.3) * 1.05,
  // Triangular — widest at base, straight taper
  Deltoid: t => Math.max(0, 1 - t * 0.9) * Math.sqrt(Math.min(1, t * 6)),
  // Spoon-shaped — narrow stalk, rounded broad tip
  Spatulate: t =>
    t < 0.35
      ? (t / 0.35) * 0.25
      : 0.25 + 0.75 * Math.sin((Math.PI * (t - 0.35)) / 0.65),
  // Round — nearly circular outline
  Orbicular: t => Math.sqrt(Math.max(0, Math.sin(Math.PI * t))) * 1.3,
  // Lyre-shaped — large terminal lobe, smaller basal lobes
  Lyrate: t => {
    if (t < 0.15) return 0.5 + Math.sin((Math.PI * t) / 0.15) * 0.3;
    if (t < 0.35) return 0.3 + ((t - 0.15) / 0.2) * 0.2;
    return 0.5 + 0.5 * Math.sin((Math.PI * (t - 0.35)) / 0.65);
  },
  // Wedge — narrow base, widens steadily to blunt tip
  Cuneate: t =>
    t < 0.85
      ? Math.pow(t / 0.85, 1.3) * 0.9
      : 0.9 * Math.cos((Math.PI * 0.5 * (t - 0.85)) / 0.15),
  // Sickle-shaped — asymmetric curve (handled via the profile + noise)
  Falcate: t => Math.sin(Math.PI * t) * 0.6,
  // Doubly feathered — fern-like with pronounced scallops
  Bipinnate: t => {
    const base = Math.sin(Math.PI * t) * 0.65;
    const fronds = 1 + Math.sin(t * Math.PI * 12) * 0.2 * Math.sin(Math.PI * t);
    return base * fronds;
  },
};

function leafProfile(shape: LeafShape, t: number): number {
  return LEAF_PROFILES[shape](Math.max(0, Math.min(1, t)));
}

/** Edge serration modifier for leaves. */
const LEAF_SERRATIONS: Record<Serration, (t: number, seed: number) => number> =
  {
    None: () => 1,
    Fine: (t, seed) => 1 + Math.sin(t * 30 + seed) * 0.06,
    Coarse: (t, seed) => 1 + Math.sin(t * 12 + seed) * 0.12,
    Lobed: (t, seed) =>
      1 + Math.sin(t * 5 + seed) * 0.2 * Math.sin(Math.PI * t),
    Crenate: (t, seed) => 1 + (Math.sin(t * 16 + seed) > 0 ? 0.08 : -0.04),
    Dentate: (t, seed) => 1 + ((t * 14 + seed * 0.1) % 1 < 0.5 ? 0.1 : -0.05),
    Doubly: (t, seed) =>
      1 + Math.sin(t * 20 + seed) * 0.07 + Math.sin(t * 8 + seed * 2) * 0.1,
    Spinose: (t, seed) => 1 + ((t * 8 + seed * 0.1) % 1 < 0.3 ? 0.18 : -0.02),
    Ciliate: (t, seed) => 1 + Math.sin(t * 40 + seed) * 0.04,
  };

/** Seeded pseudo-noise in [-1, 1] for edge variation. */
function leafNoise(t: number, seed: number): number {
  const x = Math.sin(t * 17.3 + seed * 7.9) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

/** The leaf fields its geometry depends on; the renderer's parsed leaf satisfies it. */
export type LeafParams = {
  shape: LeafShape;
  serration: Serration;
  /** 0-1, sags the blade toward its tip */
  droop: number;
  variegation: { kind: VariegationKind };
};

export type LeafGeometry = {
  outline: DrawCmd[];
  veins: DrawCmd[];
  /** closed marks in the second color, empty when the kind is None */
  variegation: DrawCmd[];
  /** the stalk from the stem to the blade, in the stem color; null when the blade sits on the stem */
  petiole: StalkPlan | null;
};

/** Where a leaf hangs: its stem attachment, heading and the lengths of its two parts, plan units. */
export type LeafPose = {
  x: number;
  y: number;
  /** midrib heading, radians, y-down screen space */
  angle: number;
  blade: number;
  petiole: number;
  /** the stem's half width at the attachment, which the petiole flares into */
  stemHalfWidth: number;
};

/** Leaf-local point: [t along the midrib, u across the blade]. */
type TU = readonly [number, number];

const OUTLINE_SEGMENTS = 16;
/** Marks keep this far inside the drawn edge. */
const EDGE_U = 0.9;
const INTERIOR_U = 0.85;

type LeafFrame = {
  /** `along` runs from the stem attachment, so the blade starts at `petiole` */
  toWorld: (along: number, perp: number) => Vec2;
  /** half width of the blade at t on the side of u's sign, interpolated between the outline's own stations */
  edgeAt: (t: number, side: number) => number;
  petiole: number;
  len: number;
};

/** Piecewise-linear read of values sampled at i / OUTLINE_SEGMENTS. */
function sampledAt(samples: readonly number[], t: number): number {
  const scaled = Math.max(0, Math.min(1, t)) * OUTLINE_SEGMENTS;
  const i = Math.min(OUTLINE_SEGMENTS - 1, Math.floor(scaled));
  return lerp(samples[i]!, samples[i + 1]!, scaled - i);
}

/**
 * The edge is sampled once at the outline's stations so marks measure
 * against the same edge the outline is drawn through: the noise is white in
 * t, so reading it between stations would describe an edge that is never
 * drawn. The two sides differ in noise phase and are slightly asymmetric.
 */
function createLeafFrame(pose: LeafPose, leaf: LeafParams): LeafFrame {
  const { angle, blade: len, petiole } = pose;
  const halfW = len * 0.3;
  const total = petiole + len;
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const sagAmt = leaf.droop * total * GRAVITY_SAG;
  const seed = angle * 7.3 + len * 3.1;
  const serration = LEAF_SERRATIONS[leaf.serration];
  const stalkW = petiole > 0 ? branchTipHalfWidth(pose.stemHalfWidth) : 0;
  const edgeSamples = (side: number): number[] =>
    Array.from({ length: OUTLINE_SEGMENTS + 1 }, (_, i) => {
      const t = i / OUTLINE_SEGMENTS;
      const baseW = halfW * leafProfile(leaf.shape, t) * serration(t, seed);
      const noise = leafNoise(t, side > 0 ? seed : seed + 5) * baseW * 0.1;
      const wider = side > 0 === t < 0.5;
      const bladeW = (baseW + noise) * (wider ? 1.04 : 0.96);
      const flare = smoothstep(Math.min(1, t / BASE_FLARE));
      return lerp(stalkW, bladeW, flare);
    });
  const plus = edgeSamples(1);
  const minus = edgeSamples(-1);
  return {
    petiole,
    len,
    // (cos a, sin a) is the midrib heading in y-down screen space, the same
    // convention as petals, stems and buds. Droop is gravity: it pulls the
    // blade toward larger y whichever way the midrib points, more toward the tip.
    toWorld: (along, perp) => {
      const sag = sagAmt * (along / total) * (along / total);
      return [
        pose.x + cosA * along - sinA * perp,
        pose.y + sinA * along + cosA * perp + sag,
      ];
    },
    edgeAt: (t, side) => sampledAt(side > 0 ? plus : minus, t),
  };
}

/** Tip drop of a fully drooping leaf as a fraction of its whole length. */
const GRAVITY_SAG = 0.4;
/** The share of the blade over which its base widens out of the petiole. */
const BASE_FLARE = 0.12;

const smoothstep = (s: number): number => s * s * (3 - 2 * s);

const leafPoint = (frame: LeafFrame, [t, u]: TU): Vec2 =>
  frame.toWorld(
    frame.petiole + t * frame.len,
    u * frame.edgeAt(t, Math.sign(u) || 1),
  );

/** The outline's own stations, minus the pinched petiole and tip where the edge runs to zero. */
const sampleTs = (): number[] =>
  Array.from(
    { length: OUTLINE_SEGMENTS - 4 },
    (_, i) => (i + 2) / OUTLINE_SEGMENTS,
  );

/** A band on one side between |u| = inner and |u| = EDGE_U, petiole to tip. */
function marginBand(side: number, inner: number): TU[] {
  const ts = sampleTs();
  return [
    ...ts.map((t): TU => [t, side * EDGE_U]),
    ...ts.toReversed().map((t): TU => [t, side * inner]),
  ];
}

function centerBlaze(): TU[] {
  const ts = sampleTs();
  const blaze = (t: number): number => 0.45 * Math.sqrt(Math.sin(Math.PI * t));
  return [
    ...ts.map((t): TU => [t, blaze(t)]),
    ...ts.toReversed().map((t): TU => [t, -blaze(t)]),
  ];
}

function splashBlobs(seed: number): TU[][] {
  const count = 4;
  return Array.from({ length: count }, (_, k) => {
    const tc =
      lerp(0.22, 0.75, (k + 0.5) / count) + 0.06 * (sidHash(seed, k) - 0.5);
    const uc = (sidHash(seed, 10 + k) * 2 - 1) * 0.4;
    const rT = 0.06;
    const rU = 0.28;
    return Array.from({ length: 8 }, (_, i): TU => {
      const theta = (i / 8) * Math.PI * 2;
      return [tc + rT * Math.sin(theta), uc + rU * Math.cos(theta)];
    });
  });
}

/** Bands one station wide across the blade, on the outline's own stations. */
function crossStripes(): TU[][] {
  const station = 1 / OUTLINE_SEGMENTS;
  return [4, 7, 10].map((k): TU[] => {
    const from = k * station;
    const to = (k + 1) * station;
    return [
      [from, -INTERIOR_U],
      [from, INTERIOR_U],
      [to, INTERIOR_U],
      [to, -INTERIOR_U],
    ];
  });
}

function variegationPolygons(kind: VariegationKind, seed: number): TU[][] {
  switch (kind) {
    case "None":
      return [];
    case "Edge":
      return [marginBand(1, 0.6), marginBand(-1, 0.6)];
    case "Center":
      return [centerBlaze()];
    case "Splash":
      return splashBlobs(seed);
    case "Stripe":
      return crossStripes();
    default:
      return unreachable(kind);
  }
}

/** The petiole as a branch off the stem, arriving along the sagged midrib. */
function petioleStalk(pose: LeafPose, frame: LeafFrame): StalkPlan | null {
  if (pose.petiole <= 0) return null;
  const root: Vec2 = [pose.x, pose.y];
  const end = frame.toWorld(pose.petiole, 0);
  const ahead = frame.toWorld(pose.petiole + frame.len * 0.05, 0);
  const dx = ahead[0] - end[0];
  const dy = ahead[1] - end[1];
  const d = Math.hypot(dx, dy) || 1;
  return stalkPlan(
    branch(
      root,
      [Math.cos(pose.angle), Math.sin(pose.angle)],
      end,
      [dx / d, dy / d],
      pose.stemHalfWidth,
    ),
  );
}

/** Leaf outline, veins, variegation and petiole in plan units, hung as `pose` says. */
export function generateLeaf(pose: LeafPose, leaf: LeafParams): LeafGeometry {
  const frame = createLeafFrame(pose, leaf);
  const ts = Array.from(
    { length: OUTLINE_SEGMENTS + 1 },
    (_, i) => i / OUTLINE_SEGMENTS,
  );
  const outlinePts = [
    ...ts.map(t => leafPoint(frame, [t, 1])),
    ...ts.toReversed().map(t => leafPoint(frame, [t, -1])),
  ];
  const outline: DrawCmd[] = [...smoothCmds(outlinePts), { op: "Z" }];

  const base = frame.toWorld(frame.petiole, 0);
  const tip = frame.toWorld(frame.petiole + frame.len, 0);
  const midrib: DrawCmd[] = [
    { op: "M", x: base[0], y: base[1] },
    { op: "L", x: tip[0], y: tip[1] },
  ];
  // Side veins branch alternately at ~40° from the midrib, shorter toward the tip
  const veinCount = Math.max(3, Math.min(6, Math.round(frame.len * 8)));
  const sideVeins = Array.from({ length: veinCount }, (_, i): DrawCmd[] => {
    const vt = 0.15 + (i / (veinCount - 1)) * 0.7;
    const side = i % 2 === 0 ? 1 : -1;
    const veinBase = frame.toWorld(frame.petiole + vt * frame.len, 0);
    const veinTip = frame.toWorld(
      frame.petiole + vt * frame.len + frame.len * 0.08,
      side * frame.edgeAt(vt, side) * 0.85,
    );
    return [
      { op: "M", x: veinBase[0], y: veinBase[1] },
      { op: "L", x: veinTip[0], y: veinTip[1] },
    ];
  }).flat();

  const variegation = variegationPolygons(
    leaf.variegation.kind,
    pose.angle * 3.7 + pose.blade * 11.3,
  ).flatMap(polygon =>
    polygonCmds(polygon.map(([t, u]) => leafPoint(frame, [t, u]))),
  );

  return {
    outline,
    veins: [...midrib, ...sideVeins],
    variegation,
    petiole: petioleStalk(pose, frame),
  };
}
