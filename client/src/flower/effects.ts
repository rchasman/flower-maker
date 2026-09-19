/**
 * Effects already in the schema (spec section 3.5): bracts, pollen, the
 * nectary, iridescence and bioluminescence. Each builder turns parsed spec
 * fields plus the head's geometry into plan data; pixi-draw draws it. Nothing
 * here depends on render.ts, so render.ts can import it.
 */

import type {
  BioPattern,
  DispersalPattern,
  LeafShape,
  NectaryPosition,
  ParticleKind,
  PetalShape,
} from "../data/flower-enums.ts";
import { hueRotate } from "./color.ts";
import {
  circleCmds,
  polygonCmds,
  type DrawCmd,
  type Vec2,
} from "./geometry.ts";
import { generatePetalMarks, type PetalPatternSpec } from "./patterns.ts";
import { createPetalFrame, generatePetal, type PetalFrame } from "./petal.ts";
import { LIGHT_ANGLE, clamp, sidHash, unreachable } from "./util.ts";

const TAU = Math.PI * 2;

// ═══════════════════════════════════════════════════════════════════════════
// Particles: ornamentation particles and pollen share one seed shape
// ═══════════════════════════════════════════════════════════════════════════

export type ParticleSeed = {
  kind: ParticleKind;
  color: number;
  x: number;
  y: number;
  size: number;
  speed: number;
  /** -1 rises, 0 drifts, 1 falls. */
  gravity: number;
  /** steady travel over one cycle, plan units */
  driftX: number;
  driftY: number;
  /** 0-1 halo strength around the particle */
  luminosity: number;
};

/** Rust `ParticleEffect`, colors resolved. */
export type ParticleSource = {
  kind: ParticleKind;
  density: number;
  color: number;
  driftSpeed: number;
  gravity: number;
};

const MAX_PARTICLES_PER_EFFECT = 12;

/** Seed positions around the head for the ornamentation particles. */
export function generateParticleSeeds(
  particles: readonly ParticleSource[],
  sid: number,
): ParticleSeed[] {
  return particles.flatMap((p, pi) =>
    Array.from(
      { length: Math.min(p.density, MAX_PARTICLES_PER_EFFECT) },
      (_, i): ParticleSeed => {
        const seed = sidHash(sid, 200 + pi * 30 + i);
        const angle = seed * TAU;
        const dist = 0.15 + sidHash(sid, 300 + i) * 0.5;
        return {
          kind: p.kind,
          color: p.color,
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist,
          size: 0.008 + seed * 0.012,
          speed: p.driftSpeed,
          gravity: p.gravity,
          driftX: 0,
          driftY: 0,
          luminosity: 0,
        };
      },
    ),
  );
}

/** Rust `PollenSystem`; color null when unset so the anthers can lend theirs. */
export type PollenSource = {
  particleCount: number;
  driftSpeed: number;
  color: number | null;
  luminosity: number;
  dispersal: DispersalPattern;
};

/** Where pollen comes from: the tip of a stamen. StamenPlan satisfies it. */
type Anther = {
  angle: number;
  length: number;
  antherRadius: number;
  antherColor: number;
};

type Motion = Pick<ParticleSeed, "gravity" | "driftX" | "driftY" | "speed">;

/** How each dispersal pattern moves a grain released at `angle` from the head centre. */
const DISPERSAL_MOTION: Record<
  DispersalPattern,
  (angle: number, speed: number, rnd: number) => Motion
> = {
  Gravity: (_angle, speed) => ({
    gravity: 0.9,
    driftX: 0,
    driftY: 0,
    speed,
  }),
  Wind: (_angle, speed) => ({
    gravity: 0.15,
    driftX: 0.6,
    driftY: -0.1,
    speed: speed * 1.3,
  }),
  Burst: (angle, speed) => ({
    gravity: 0,
    driftX: Math.cos(angle) * 0.7,
    driftY: Math.sin(angle) * 0.7,
    speed: speed * 1.6,
  }),
  Spiral: (angle, speed) => ({
    gravity: 0,
    driftX: Math.cos(angle) * 0.3 - Math.sin(angle) * 0.5,
    driftY: Math.sin(angle) * 0.3 + Math.cos(angle) * 0.5,
    speed,
  }),
  Chaotic: (_angle, speed, rnd) => ({
    gravity: (rnd - 0.5) * 0.6,
    driftX: Math.cos(rnd * TAU) * 0.5,
    driftY: Math.sin(rnd * TAU) * 0.5,
    speed: speed * (0.7 + rnd),
  }),
  Fountain: (_angle, speed) => ({
    gravity: 0.7,
    driftX: 0,
    driftY: -0.6,
    speed,
  }),
  Vortex: (angle, speed) => ({
    gravity: 0,
    driftX: -Math.sin(angle) * 0.7,
    driftY: Math.cos(angle) * 0.7,
    speed: speed * 1.2,
  }),
  Radiate: (angle, speed) => ({
    gravity: 0.1,
    driftX: Math.cos(angle) * 0.5,
    driftY: Math.sin(angle) * 0.5,
    speed: speed * 0.8,
  }),
};

const MAX_POLLEN = 24;
const DEFAULT_ANTHER_COLOR = 0xffd700;

/**
 * Pollen grains released at the anther tips, one anther per grain in turn.
 * With no stamens the grains start on the disc edge.
 */
export function generatePollenSeeds(
  pollen: PollenSource,
  anthers: readonly Anther[],
  discRadius: number,
  sid: number,
): ParticleSeed[] {
  const count = clamp(0, MAX_POLLEN, Math.round(pollen.particleCount));
  const color = pollen.color ?? anthers[0]?.antherColor ?? DEFAULT_ANTHER_COLOR;
  return Array.from({ length: count }, (_, i): ParticleSeed => {
    const rnd = sidHash(sid, 1200 + i);
    const anther = anthers[i % Math.max(1, anthers.length)];
    const angle = anther?.angle ?? rnd * TAU;
    const reach = anther?.length ?? discRadius;
    const jitter = (anther?.antherRadius ?? 0.02) * 0.8;
    const scatter = sidHash(sid, 1300 + i) * TAU;
    return {
      kind: "Pollen",
      color,
      x: Math.cos(angle) * reach + Math.cos(scatter) * jitter * rnd,
      y: Math.sin(angle) * reach + Math.sin(scatter) * jitter * rnd,
      size: 0.006 + rnd * 0.008,
      luminosity: clamp(0, 1, pollen.luminosity),
      ...DISPERSAL_MOTION[pollen.dispersal](angle, pollen.driftSpeed, rnd),
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Bracts
// ═══════════════════════════════════════════════════════════════════════════

/** Rust `Bract`, color resolved to null when unset. */
export type BractSource = {
  color: number | null;
  size: number;
  shape: LeafShape;
  showy: boolean;
  /** 0 base, 1 flower head */
  position: number;
};

export type BractPlan = { cmds: DrawCmd[]; color: number };

/** The petal silhouette that stands in for each leaf shape on a showy bract. */
const BRACT_PETAL_SHAPE: Record<LeafShape, PetalShape> = {
  Ovate: "Ovate",
  Lanceolate: "Lanceolate",
  Cordate: "Cordate",
  Palmate: "Flabellate",
  Pinnate: "Lanceolate",
  Linear: "Ligulate",
  Reniform: "Reniform",
  Hastate: "Sagittate",
  Sagittate: "Sagittate",
  Peltate: "Orbicular",
  Acicular: "Filiform",
  Obovate: "Obovate",
  Elliptic: "Oblong",
  Oblanceolate: "Obovate",
  Deltoid: "Deltoid",
  Spatulate: "Spatulate",
  Orbicular: "Orbicular",
  Lyrate: "Panduriform",
  Cuneate: "Cuneate",
  Falcate: "Falcate",
  Bipinnate: "Laciniate",
};

const DEFAULT_BRACT_COLOR = 0x3a7d32;
const MIN_BRACT_RING = 3;
/** showy bracts sit a little beyond the petals they back */
const BRACT_RADIAL_OFFSET = 1.15;

export type BractRingParams = {
  /** spec length and width of the outer petal layer the ring backs */
  petalLength: number;
  petalWidth: number;
  /** angle of the outer layer's first petal */
  baseAngle: number;
  sid: number;
};

/**
 * Showy bracts as a petal-like ring behind the sepals: twice as many blades
 * as bracts listed, at least three, cycling through the listed bracts.
 */
export function generateBractRing(
  bracts: readonly BractSource[],
  params: BractRingParams,
): BractPlan[] {
  const showy = bracts.filter(b => b.showy);
  if (showy.length === 0) return [];
  const count = Math.max(MIN_BRACT_RING, showy.length * 2);
  return Array.from({ length: count }, (_, i): BractPlan => {
    const bract = showy[i % showy.length]!;
    const size = clamp(0, 1, bract.size);
    const frame = createPetalFrame({
      angle: params.baseAngle + ((i + 0.5) / count) * TAU,
      shape: BRACT_PETAL_SHAPE[bract.shape],
      edge: "Smooth",
      length: params.petalLength * (0.7 + size * 0.7),
      width: params.petalWidth * (0.55 + size * 0.6),
      curvature: 0.05,
      curl: 0,
      seed: sidHash(params.sid, 1400 + i),
      radialOffset: BRACT_RADIAL_OFFSET,
    });
    return {
      cmds: generatePetal(frame),
      color: bract.color ?? DEFAULT_BRACT_COLOR,
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Nectary
// ═══════════════════════════════════════════════════════════════════════════

export type NectaryGlowSource = {
  intensity: number;
  color: number | null;
  /** 0-1 spec radius */
  radius: number;
  pulse: { speed: number; minIntensity: number } | null;
};

/** Rust `Nectary`, colors resolved to null when unset. */
export type NectarySource = {
  position: NectaryPosition;
  color: number | null;
  glow: NectaryGlowSource | null;
};

export type NectaryGlowPlan = {
  intensity: number;
  color: number;
  /** halo radius, plan units */
  radius: number;
  pulse: { speed: number; minIntensity: number } | null;
};

export type NectaryPlan = {
  position: NectaryPosition;
  color: number;
  /** static shapes under the pistil, filled in `color` */
  fills: DrawCmd[];
  /** static rings, stroked in `color` at `strokeWidth` plan units */
  strokes: DrawCmd[];
  strokeWidth: number;
  glow: NectaryGlowPlan | null;
};

export type NectaryContext = {
  discRadius: number;
  discColor: number;
  /** farthest drawn point of the head, plan units */
  headReach: number;
  /** outer layer petal frames, for Petaline marks */
  petalFrames: readonly PetalFrame[];
  sepalFrames: readonly PetalFrame[];
  sid: number;
};

const MIN_NECTARY_RADIUS = 0.05;

/** A small filled region at the base of each frame's blade. */
function baseMarks(
  frames: readonly PetalFrame[],
  color: number,
  sid: number,
): DrawCmd[] {
  const pattern: PetalPatternSpec = {
    kind: "ThroatBlotch",
    color,
    scale: 0.4,
    density: 1,
    extent: 0.12,
  };
  return frames.flatMap((frame, i) =>
    generatePetalMarks(pattern, frame, sidHash(sid, 1500 + i)).flatMap(
      m => m.cmds,
    ),
  );
}

/** An ellipse behind the centre, away from the light, where a spur would hang. */
function spurGlow(r: number): DrawCmd[] {
  const away = LIGHT_ANGLE + Math.PI;
  const cx = Math.cos(away) * r * 1.1;
  const cy = Math.sin(away) * r * 1.1;
  const cosA = Math.cos(away);
  const sinA = Math.sin(away);
  return polygonCmds(
    Array.from({ length: 24 }, (_, k): Vec2 => {
      const theta = (k / 24) * TAU;
      const lx = Math.cos(theta) * r * 1.3;
      const ly = Math.sin(theta) * r * 0.6;
      return [cx + cosA * lx - sinA * ly, cy + sinA * lx + cosA * ly];
    }),
  );
}

type NectaryShapes = Pick<NectaryPlan, "fills" | "strokes" | "strokeWidth">;

function nectaryShapes(
  position: NectaryPosition,
  r: number,
  color: number,
  ctx: NectaryContext,
): NectaryShapes {
  const none: NectaryShapes = { fills: [], strokes: [], strokeWidth: 0 };
  const glowDisc = (): NectaryShapes => ({
    ...none,
    fills: [1.6, 1.25, 0.95].flatMap(f => circleCmds(0, 0, r * f)),
  });
  switch (position) {
    case "Basal":
      return glowDisc();
    case "Petaline":
      return ctx.petalFrames.length === 0
        ? glowDisc()
        : { ...none, fills: baseMarks(ctx.petalFrames, color, ctx.sid) };
    case "Sepaline":
      return ctx.sepalFrames.length === 0
        ? glowDisc()
        : { ...none, fills: baseMarks(ctx.sepalFrames, color, ctx.sid) };
    case "Receptacular":
      return {
        ...none,
        fills: [
          ...circleCmds(0, 0, r * 1.5),
          ...Array.from({ length: 8 }, (_, k) => {
            const theta = (k / 8) * TAU;
            return circleCmds(
              Math.cos(theta) * r * 1.25,
              Math.sin(theta) * r * 1.25,
              r * 0.18,
              8,
            );
          }).flat(),
        ],
      };
    case "Spurred":
      return { ...none, fills: spurGlow(r) };
    case "Annular":
      return {
        ...none,
        strokes: circleCmds(0, 0, r * 1.35),
        strokeWidth: r * 0.3,
      };
    case "Discoid":
      return { ...none, fills: circleCmds(0, 0, r * 1.2) };
    default:
      return unreachable(position);
  }
}

/** The nectary's static shapes and, when the spec glows, its halo. */
export function buildNectary(
  source: NectarySource,
  ctx: NectaryContext,
): NectaryPlan {
  const r = Math.max(MIN_NECTARY_RADIUS, ctx.discRadius);
  const color = source.color ?? source.glow?.color ?? ctx.discColor;
  const glow: NectaryGlowPlan | null = source.glow
    ? {
        intensity: clamp(0, 1, source.glow.intensity),
        color: source.glow.color ?? color,
        radius: r * 1.5 + clamp(0, 1, source.glow.radius) * ctx.headReach * 0.6,
        pulse: source.glow.pulse,
      }
    : null;
  return {
    position: source.position,
    color,
    ...nectaryShapes(source.position, r, color, ctx),
    glow,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Iridescence
// ═══════════════════════════════════════════════════════════════════════════

/** Rust `Iridescence`. */
export type IridescenceSource = {
  intensity: number;
  /** degrees of hue shift across the light angle */
  hueShiftRange: number;
  affectedParts: readonly string[];
};

/** Two sheen colors for one petal; drawn as offset fills like Pearlescent. */
export type PetalIridescence = {
  color: number;
  complement: number;
  intensity: number;
};

/** An empty list means every part; otherwise the part must be named. */
export const affectsPetals = (source: IridescenceSource): boolean =>
  source.affectedParts.length === 0 ||
  source.affectedParts.some(part => part.toLowerCase() === "petals");

/** The petal's lit color hue-shifted by how squarely it faces the light. */
export function iridescentPetal(
  source: IridescenceSource,
  lit: number,
  angle: number,
): PetalIridescence {
  const color = hueRotate(
    lit,
    source.hueShiftRange * Math.cos(angle - LIGHT_ANGLE),
  );
  return {
    color,
    complement: hueRotate(color, 180),
    intensity: clamp(0, 1, source.intensity),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Bioluminescence
// ═══════════════════════════════════════════════════════════════════════════

/** Rust `Bioluminescence` minus the trigger, which the renderer does not model. */
export type BioSource = {
  pattern: BioPattern;
  color: number;
  intensity: number;
};

export type BioPlan = BioSource & {
  /** stroked in the glow color */
  strokes: DrawCmd[];
  /** filled in the glow color */
  fills: DrawCmd[];
};

/** What a petal lends the glow: its frame for marks, outline and veins. */
export type BioPetal = {
  frame: PetalFrame;
  cmds: DrawCmd[];
  veinCmds: DrawCmd[];
};

type BioShapes = Pick<BioPlan, "strokes" | "fills">;

const marksOn = (
  petals: readonly BioPetal[],
  pattern: Omit<PetalPatternSpec, "color">,
  color: number,
  seed: number,
): DrawCmd[] =>
  petals.flatMap((petal, i) =>
    generatePetalMarks(
      { ...pattern, color },
      petal.frame,
      sidHash(seed, 1600 + i),
    ).flatMap(m => m.cmds),
  );

const outlines = (petals: readonly BioPetal[]): DrawCmd[] =>
  petals.flatMap(p => p.cmds);

/** Veins where the layer has them, else the outlines so the glow is never empty. */
const veinsOrOutlines = (petals: readonly BioPetal[]): DrawCmd[] => {
  const veins = petals.flatMap(p => p.veinCmds);
  return veins.length > 0 ? veins : outlines(petals);
};

const BIO_SHAPES: Record<
  BioPattern,
  (petals: readonly BioPetal[], color: number, seed: number) => BioShapes
> = {
  Veins: petals => ({ strokes: veinsOrOutlines(petals), fills: [] }),
  Spots: (petals, color, seed) => ({
    strokes: [],
    fills: marksOn(
      petals,
      { kind: "Spots", scale: 0.5, density: 0.6, extent: 0.5 },
      color,
      seed,
    ),
  }),
  Edges: petals => ({ strokes: outlines(petals), fills: [] }),
  Whole: petals => ({ strokes: [], fills: outlines(petals) }),
  Pulse: petals => ({ strokes: [], fills: outlines(petals) }),
  Fractal: (petals, color, seed) => ({
    strokes: veinsOrOutlines(petals),
    fills: marksOn(
      petals,
      { kind: "Speckle", scale: 0.5, density: 0.5, extent: 0.5 },
      color,
      seed,
    ),
  }),
  Rings: (petals, color, seed) => ({
    strokes: [],
    fills: [0.3, 0.6, 0.9].flatMap(extent =>
      marksOn(
        petals,
        { kind: "Band", scale: 0.15, density: 1, extent },
        color,
        seed,
      ),
    ),
  }),
  Stripes: (petals, color, seed) => ({
    strokes: [],
    fills: marksOn(
      petals,
      { kind: "Stripes", scale: 0.3, density: 0.7, extent: 0.9 },
      color,
      seed,
    ),
  }),
  Constellation: (petals, color, seed) => ({
    strokes: [],
    fills: marksOn(
      petals,
      { kind: "Speckle", scale: 0.5, density: 0.3, extent: 0.5 },
      color,
      seed,
    ),
  }),
};

/** Glow geometry for every petal of the head, drawn additively per frame. */
export function generateBio(
  source: BioSource,
  petals: readonly BioPetal[],
  seed: number,
): BioPlan {
  return {
    ...source,
    intensity: clamp(0, 1, source.intensity),
    ...BIO_SHAPES[source.pattern](petals, source.color, seed),
  };
}
