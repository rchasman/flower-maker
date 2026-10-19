/**
 * Petal-local frame and outline. Everything drawn on a petal (outline, veins,
 * pattern marks) maps through `petalLocalToFlower(t, u, frame)`.
 */

import type { EdgeStyle, PetalShape } from "../data/flower-enums.ts";
import { assembleOutline, type DrawCmd, type Vec2 } from "./geometry.ts";
import { lerp, sidHash, steps } from "./util.ts";

// ═══════════════════════════════════════════════════════════════════════════
// Petal shape profiles — width at position t ∈ [0,1] (base→tip)
// Returns 0..1 representing relative width at that position.
// Each profile produces a visually distinct petal silhouette.
// ═══════════════════════════════════════════════════════════════════════════

const SHAPE_PROFILES: Record<PetalShape, (t: number) => number> = {
  // Classic egg-shaped — widest at ~35% from base, gentle taper to tip
  Ovate: t => Math.sin(Math.PI * Math.pow(t, 0.7)),

  // Narrow lance — widest near 25%, long gradual taper to pointed tip
  Lanceolate: t => Math.sin(Math.PI * t) * Math.pow(1 - t, 0.25) * 1.1,

  // Spoon/spatula — narrow stalk at base, wide rounded top
  Spatulate: t =>
    t < 0.3
      ? (t / 0.3) * 0.3
      : 0.3 + 0.7 * Math.sin((Math.PI * (t - 0.3)) / 0.7),

  // Rectangular — nearly parallel sides with rounded ends
  Oblong: t => {
    if (t < 0.1) return Math.sin((Math.PI * t) / 0.2) * 0.88;
    if (t > 0.9) return Math.sin((Math.PI * (1 - t)) / 0.2) * 0.88;
    return 0.88;
  },

  // Nearly circular — very wide, widest at center
  Orbicular: t => Math.sqrt(Math.max(0, Math.sin(Math.PI * t))),

  // Heart-shaped — wide, with a notch at the tip
  Cordate: t => {
    const base = Math.sin(Math.PI * Math.pow(t, 0.6));
    return t > 0.85
      ? base * (1 - 0.4 * Math.pow((t - 0.85) / 0.15, 0.5))
      : base;
  },

  // Triangular — widest at base, linear taper to point
  Deltoid: t => Math.max(0, 1 - t * 0.95) * Math.sqrt(Math.min(1, t * 5)),

  // Sickle-curved — handled via asymmetry in generation, profile is narrower
  Falcate: t => Math.sin(Math.PI * t) * 0.7,

  // Strap-shaped — uniform narrow width, blunt tip (daisy ray petals)
  Ligulate: t => {
    if (t < 0.08) return (t / 0.08) * 0.45;
    if (t > 0.85) return 0.45 * Math.cos((Math.PI * 0.5 * (t - 0.85)) / 0.15);
    return 0.45;
  },

  // Very narrow tube — disc florets
  Tubular: t => {
    if (t < 0.05) return (t / 0.05) * 0.22;
    if (t > 0.88)
      return 0.22 * (1 + 0.6 * Math.sin((Math.PI * (t - 0.88)) / 0.12));
    return 0.22;
  },

  // Fringed ovate — base shape is ovate, edges get intrinsic fringe
  Fimbriate: t => Math.sin(Math.PI * Math.pow(t, 0.7)),

  // Deeply cut/slashed ovate — base shape, intrinsic lacerate edge
  Laciniate: t => Math.sin(Math.PI * Math.pow(t, 0.7)),

  // Backward-toothed — base shape, intrinsic serrate edge
  Runcinate: t => Math.sin(Math.PI * Math.pow(t, 0.7)),

  // ── v2 shapes ──

  // Wedge — narrow base, widest at the very tip, abrupt end
  Cuneate: t =>
    t < 0.85
      ? Math.pow(t / 0.85, 1.5) * 0.95
      : 0.95 * Math.cos((Math.PI * 0.5 * (t - 0.85)) / 0.15),

  // Long-tapered pointed tip — like lanceolate but with exaggerated tip
  Acuminate: t => Math.sin(Math.PI * t) * Math.pow(1 - t, 0.6) * 1.3,

  // Fiddle/violin — pinched waist at ~50%
  Panduriform: t => {
    const base = Math.sin(Math.PI * Math.pow(t, 0.65));
    const pinch = 1 - 0.4 * Math.exp(-Math.pow((t - 0.5) / 0.12, 2));
    return base * pinch;
  },

  // Clawed base (narrow stalk) widening into broad blade
  Unguiculate: t =>
    t < 0.25
      ? (t / 0.25) * 0.2
      : 0.2 + 0.8 * Math.sin((Math.PI * (t - 0.25)) / 0.75),

  // Fan-shaped — very wide at the outer edge, narrow base
  Flabellate: t =>
    t < 0.15
      ? (t / 0.15) * 0.15
      : 0.15 + 0.85 * Math.pow(Math.sin((Math.PI * (t - 0.15)) / 0.85), 0.5),

  // Reverse egg — widest at ~65% from base
  Obovate: t => Math.sin(Math.PI * Math.pow(t, 1.4)),

  // Diamond — widest at exact center, angular taper both ways
  Rhomboid: t => (t < 0.5 ? t * 2 * 0.85 : (1 - t) * 2 * 0.85),

  // Thread-like — extremely narrow throughout
  Filiform: t => {
    if (t < 0.05) return (t / 0.05) * 0.12;
    if (t > 0.9) return 0.12 * (1 - (t - 0.9) / 0.1);
    return 0.12;
  },

  // Kidney-shaped — very wide and short, almost wider than long
  Reniform: t => Math.sqrt(Math.max(0, Math.sin(Math.PI * t))) * 1.4,

  // Arrow-shaped — barbed backward-pointing base lobes
  Sagittate: t => {
    if (t < 0.12) return 0.7 + (1 - t / 0.12) * 0.5;
    return Math.sin(Math.PI * Math.pow(t, 0.7)) * 0.85;
  },
};

function shapeProfile(shape: PetalShape, t: number): number {
  return SHAPE_PROFILES[shape](Math.max(0, Math.min(1, t)));
}

// ═══════════════════════════════════════════════════════════════════════════
// Edge modifiers — perturbation multiplied onto petal width
// ═══════════════════════════════════════════════════════════════════════════

/** Edges whose waves come from the margin buckling, not from cuts in the outline. */
type BuckledEdge = "Undulate" | "Ruffled" | "Crisped";
type CutEdge = Exclude<EdgeStyle, BuckledEdge>;

const EDGE_MODIFIERS: Record<CutEdge, (t: number, seed: number) => number> = {
  Smooth: () => 1,
  Fringed: (t, seed) => 1 + (Math.sin(t * 24 + seed * 3) > 0.2 ? 0.14 : -0.07),
  Serrated: (t, seed) => 1 + ((t * 10 + seed * 0.1) % 1 < 0.5 ? 0.12 : -0.06),
  Rolled: t => 1 - t * 0.12,
  Lacerate: (t, seed) =>
    1 + Math.sin(t * 9 + seed * 3) * Math.cos(t * 13 + seed * 7) * 0.18,
  Lobed: (t, seed) =>
    1 + Math.sin(t * 4 + seed * 2) * 0.25 * Math.sin(Math.PI * t),
  Plicate: (t, seed) => 1 + Math.abs(Math.sin(t * 12 + seed * 3)) * 0.1 - 0.05,
  Revolute: t => (t > 0.3 ? 1 - (t - 0.3) * 0.18 : 1),
  Dentate: (t, seed) => 1 + ((t * 16 + seed * 0.1) % 1 < 0.4 ? 0.14 : -0.04),
  Erose: (t, seed) =>
    1 + Math.sin(t * 31 + seed * 11) * Math.cos(t * 13 + seed * 5) * 0.13,
};

/**
 * A buckled margin grows longer than the blade inside it. A sheet whose edge
 * carries excess length cannot lie flat, so the edge rises and falls in waves
 * that hold the excess: a wave of amplitude A and wavelength λ adds a strain
 * of (πA/λ)² to the edge, so A = λ√ε/π. `strain` is ε at the tip; it grows
 * from zero at the base as t^1.5. `wavelength` is λ in local half widths, since
 * the buckled band is about as deep as the blade is wide. Each further
 * generation halves the strain, cuts λ by three and sits closer to the tip:
 * the cascade that turns an undulate edge into a crisped one.
 */
type Buckling = { strain: number; wavelength: number; generations: number };

const BUCKLING: Record<BuckledEdge, Buckling> = {
  Undulate: { strain: 0.1, wavelength: 2.6, generations: 1 },
  Ruffled: { strain: 0.25, wavelength: 1.5, generations: 2 },
  Crisped: { strain: 0.4, wavelength: 1.1, generations: 3 },
};

const isBuckled = (edge: EdgeStyle): edge is BuckledEdge => edge in BUCKLING;

/** Waves shorter than this many spine steps cannot be drawn and fade out. */
const MIN_WAVE_STEPS = 4;
/** How much of the margin's rise shows as sideways offset in the drawn outline. */
const VIEW_TILT = 0.8;
/** The base of a blade is narrow, but its waves are not finer than this share of the widest point. */
const WAVELENGTH_FLOOR = 0.35;
/** A strap that bends as one sheet carries at most this many waves from base to tip. */
const MAX_STRAP_WAVES = 1.75;

/** Height and slope of one buckled margin at every spine station. */
type MarginWave = { height: number; slope: number }[];

/**
 * 0 for a blade wide enough that each margin buckles on its own, rising to 1
 * for a strap so narrow that it rises and falls as one sheet: a strap's
 * waves are set by its length, a blade's by its width.
 */
const strapCoupling = (halfWidths: readonly number[], length: number) =>
  1 - smoothstep(0.08, 0.25, Math.max(...halfWidths) / length);

function buckledMargin(
  buckling: Buckling,
  halfWidths: readonly number[],
  length: number,
  seed: number,
): MarginWave {
  const strapWave =
    (strapCoupling(halfWidths, length) * length) / MAX_STRAP_WAVES;
  const widest = Math.max(...halfWidths);
  const last = halfWidths.length - 1;
  const step = length / last;
  const generations = Array.from({ length: buckling.generations }, (_, k) => {
    const wavelengths = halfWidths.map(
      w =>
        Math.max(
          buckling.wavelength * Math.max(w, widest * WAVELENGTH_FLOOR),
          strapWave,
        ) / Math.pow(3, k),
    );
    const startPhase = sidHash(Math.floor(seed * 9973), 17 + k) * Math.PI * 2;
    const phases = wavelengths.reduce<number[]>(
      (acc, _, i) =>
        i === 0
          ? [startPhase]
          : [...acc, acc[i - 1]! + (Math.PI * 2 * step) / wavelengths[i - 1]!],
      [],
    );
    return wavelengths.map((wavelength, i) => {
      const t = i / last;
      const strain = buckling.strain * Math.pow(t, 1.5 + k) * Math.pow(0.5, k);
      const drawable = smoothstep(
        MIN_WAVE_STEPS * step,
        1.5 * MIN_WAVE_STEPS * step,
        wavelength,
      );
      const root = Math.sqrt(strain) * drawable;
      return {
        height: ((wavelength * root) / Math.PI) * Math.sin(phases[i]!),
        slope: 2 * root * Math.cos(phases[i]!),
      };
    });
  });
  return halfWidths.map((_, i) =>
    generations.reduce(
      (sum, g) => ({
        height: sum.height + g[i]!.height,
        slope: sum.slope + g[i]!.slope,
      }),
      { height: 0, slope: 0 },
    ),
  );
}

const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const s = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return s * s * (3 - 2 * s);
};

/** Shapes with intrinsic edge effects baked into their identity. */
const INTRINSIC_EDGES: Partial<Record<PetalShape, CutEdge>> = {
  Fimbriate: "Fringed",
  Laciniate: "Lacerate",
  Runcinate: "Serrated",
};

// ═══════════════════════════════════════════════════════════════════════════
// Petal frame
// ═══════════════════════════════════════════════════════════════════════════

const PETAL_SEGMENTS = 14;
/** A buckled margin needs finer stations to carry its waves. */
const BUCKLED_SEGMENTS = 48;
const BASE_OFFSET = 0.08;
const CURL_DISPLACEMENT = -0.3;

/** Normalize spec-space petal dimensions to unit flower space. */
function normalizePetalDims(length: number, width: number, radialOffset = 1.0) {
  return {
    petalLen: Math.max(0.18, Math.min(0.7, length * 0.25)) * radialOffset,
    petalW:
      Math.max(0.05, Math.min(0.3, width * 0.1)) * (0.7 + 0.3 * radialOffset),
  };
}

/**
 * The spec width at which `count` petals of `length` in one even ring overlap
 * their neighbours by `overlap` of their width, measured at mid length. The
 * result is capped at the spec's own width range.
 */
export function overlappingWidth(
  length: number,
  count: number,
  overlap: number,
): number {
  const { petalLen } = normalizePetalDims(length, 1);
  const midRadius = BASE_OFFSET + petalLen * 0.5;
  const chord = (2 * Math.PI * midRadius) / Math.max(1, count);
  const halfWidth = chord / (1 - overlap) / 2;
  return Math.max(0.1, Math.min(3, halfWidth / 0.1));
}

/** One sampled station of the petal spine, in petal-local coordinates. */
export type SpineSample = {
  /** distance from the flower center along the petal axis, curl included */
  along: number;
  /** lateral offset of the midrib from curvature */
  bend: number;
  /** half width toward u = +1 */
  left: number;
  /** half width toward u = -1; differs from left for Falcate and buckled edges */
  right: number;
  /** slope of the left margin out of the blade's plane, 0 for an unbuckled edge */
  leftSlope: number;
  /** slope of the right margin out of the blade's plane */
  rightSlope: number;
};

/**
 * Petal-local frame: everything drawn on a petal (outline, veins, pattern
 * marks) maps through it. `t` runs base to tip in [0, 1]; `u` runs across the
 * width in [-1, 1] where u = 1 is the left edge and u = -1 the right edge.
 * Between the spine samples every field is interpolated
 * with the same uniform Catmull-Rom that smoothCmds draws the outline with,
 * so u = ±1 traces the drawn edges exactly and any |u| < 1 sits on the chord
 * between them, inside the outline wherever the outline does not fold.
 */
export type PetalFrame = {
  cosA: number;
  sinA: number;
  spine: readonly SpineSample[];
};

export type PetalFrameParams = {
  angle: number;
  shape: PetalShape;
  edge: EdgeStyle;
  /** spec layer.length (0.1-5.0) */
  length: number;
  /** spec layer.width (0.1-3.0) */
  width: number;
  /** +cupped, -recurved, in [-1, 1] */
  curvature: number;
  /** 0 to 1 */
  curl: number;
  seed: number;
  /** phyllotaxis: 0..1, scales length and base distance */
  radialOffset?: number;
};

export function createPetalFrame(params: PetalFrameParams): PetalFrame {
  const radialOffset = params.radialOffset ?? 1.0;
  const { petalLen, petalW } = normalizePetalDims(
    params.length,
    params.width,
    radialOffset,
  );
  const baseOff = BASE_OFFSET * radialOffset;
  const effectiveEdge =
    params.edge !== "Smooth"
      ? params.edge
      : (INTRINSIC_EDGES[params.shape] ?? "Smooth");
  const buckled = isBuckled(effectiveEdge);
  const edgeModifier = buckled
    ? EDGE_MODIFIERS.Smooth
    : EDGE_MODIFIERS[effectiveEdge];
  const segments = buckled ? BUCKLED_SEGMENTS : PETAL_SEGMENTS;

  const stations = steps(segments).map(t => {
    const curlDisp =
      params.curl > 0 && t > 0.65
        ? params.curl * Math.pow((t - 0.65) / 0.35, 2) * CURL_DISPLACEMENT
        : 0;
    // Cupped petals foreshorten — narrower toward the tip when viewed from above
    const cupNarrow =
      params.curvature > 0
        ? Math.max(0.1, 1 - params.curvature * 0.35 * Math.pow(t, 1.5))
        : 1;
    const halfWidth =
      petalW *
      shapeProfile(params.shape, t) *
      edgeModifier(t, params.seed) *
      cupNarrow;
    return { t, curlDisp, halfWidth };
  });

  const halfWidths = stations.map(s => s.halfWidth);
  const margin = (seed: number): MarginWave =>
    buckled
      ? buckledMargin(BUCKLING[effectiveEdge], halfWidths, petalLen, seed)
      : stations.map(() => ({ height: 0, slope: 0 }));
  // A wide blade's two margins buckle out of step; a strap rises and falls
  // as one sheet, so it bends instead of changing width.
  const coupling = strapCoupling(halfWidths, petalLen);
  const leftWave = margin(params.seed);
  const rightWave = margin(params.seed + 0.37).map((free, i) => ({
    height: lerp(free.height, leftWave[i]!.height, coupling),
    slope: lerp(free.slope, leftWave[i]!.slope, coupling),
  }));

  const spine = stations.map(({ t, curlDisp, halfWidth }, i): SpineSample => {
    const asym = params.shape === "Falcate" ? 0.3 * Math.sin(Math.PI * t) : 0;
    const left = leftWave[i]!;
    const right = rightWave[i]!;
    return {
      along: baseOff + t * petalLen + curlDisp,
      // +curvature = cupped, -curvature = recurved
      bend:
        params.curvature * 0.15 * Math.sin(Math.PI * t) +
        VIEW_TILT * coupling * left.height,
      left: Math.max(
        halfWidth * 0.2,
        halfWidth * (1 + asym) + VIEW_TILT * (1 - coupling) * left.height,
      ),
      right: Math.max(
        halfWidth * 0.2,
        halfWidth * (1 - asym) + VIEW_TILT * (1 - coupling) * right.height,
      ),
      leftSlope: left.slope,
      rightSlope: right.slope,
    };
  });

  return { cosA: Math.cos(params.angle), sinA: Math.sin(params.angle), spine };
}

/**
 * Uniform Catmull-Rom through the spine at t, the curve smoothCmds draws
 * through the same samples (tangents (p2 - p0) / 2 and (p3 - p1) / 2,
 * end points clamped).
 */
export function petalSpineAt(frame: PetalFrame, t: number): SpineSample {
  const spine = frame.spine;
  const last = spine.length - 1;
  const scaled = Math.max(0, Math.min(1, t)) * last;
  const i1 = Math.min(last - 1, Math.floor(scaled));
  const s = scaled - i1;
  const p0 = spine[Math.max(0, i1 - 1)]!;
  const p1 = spine[i1]!;
  const p2 = spine[i1 + 1]!;
  const p3 = spine[Math.min(last, i1 + 2)]!;
  const s2 = s * s;
  const s3 = s2 * s;
  const h00 = 2 * s3 - 3 * s2 + 1;
  const h10 = s3 - 2 * s2 + s;
  const h01 = -2 * s3 + 3 * s2;
  const h11 = s3 - s2;
  const hermite = (f: (p: SpineSample) => number): number =>
    h00 * f(p1) +
    (h10 * (f(p2) - f(p0))) / 2 +
    h01 * f(p2) +
    (h11 * (f(p3) - f(p1))) / 2;
  return {
    along: hermite(p => p.along),
    bend: hermite(p => p.bend),
    left: hermite(p => p.left),
    right: hermite(p => p.right),
    leftSlope: hermite(p => p.leftSlope),
    rightSlope: hermite(p => p.rightSlope),
  };
}

/** Petal length along its axis in unit flower space, curl included. */
export function petalLength(frame: PetalFrame): number {
  return frame.spine.at(-1)!.along - frame.spine[0]!.along;
}

/** Map petal-local (t, u) to unit flower space. */
export function petalLocalToFlower(
  t: number,
  u: number,
  frame: PetalFrame,
): Vec2 {
  const station = petalSpineAt(frame, t);
  const halfWidth = u >= 0 ? station.left : station.right;
  const localX = station.along;
  const localY = station.bend + u * halfWidth;
  return [
    frame.cosA * localX - frame.sinA * localY,
    frame.sinA * localX + frame.cosA * localY,
  ];
}

/** Closed outline of the petal from grid index startIdx to the tip. */
function generateOutlineFrom(frame: PetalFrame, startIdx: number): DrawCmd[] {
  const segments = frame.spine.length - 1;
  const indices = Array.from(
    { length: segments + 1 - startIdx },
    (_, i) => startIdx + i,
  );
  const leftPts = indices.map(i => petalLocalToFlower(i / segments, 1, frame));
  const rightPts = indices.map(i =>
    petalLocalToFlower(i / segments, -1, frame),
  );
  return assembleOutline(leftPts, rightPts);
}

/**
 * Generate a petal outline in unit flower space (radius = 1). The outline is
 * a closed path of smooth cubic Bézier curves through the frame's edges.
 */
export function generatePetal(frame: PetalFrame): DrawCmd[] {
  return generateOutlineFrom(frame, 0);
}

/** A petal frame at its angle with its outline, ready for the plan builder. */
export type PlacedPetal = {
  frame: PetalFrame;
  angle: number;
  cmds: DrawCmd[];
};

export function placePetal(frame: PetalFrame, angle: number): PlacedPetal {
  return { frame, angle, cmds: generatePetal(frame) };
}

/**
 * Generate a partial petal path covering [startT, 1.0] along the petal length.
 * Used for gradient overlays — each stop beyond the first gets rendered as a
 * sub-path from that stop's position to the tip, layered on top of the base fill.
 */
export function generatePetalPartial(
  frame: PetalFrame,
  startT: number,
): DrawCmd[] {
  return generateOutlineFrom(
    frame,
    Math.max(0, Math.floor(startT * (frame.spine.length - 1))),
  );
}
