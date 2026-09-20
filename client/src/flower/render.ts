/**
 * Spec-driven botanical flower rendering — single source of truth for
 * FlowerCanvas (PixiJS) and FlowerGrid (SVG).
 *
 * Each flower's full taxonomy (petal shape, arrangement, curvature, edge style,
 * reproductive system, sepals) drives a unique visual. No more cartoon blobs.
 */

import { parse as parseYaml } from "yaml";
import { parseSpec, run } from "../lib/utils.ts";
import {
  colorFromSpec,
  darkenColor,
  desaturate,
  fallbackColor,
  lerpColor,
  lightenColor,
} from "./color.ts";
import {
  generateCorolla,
  isFused,
  type CorollaLayer,
  type Throat,
} from "./corolla.ts";
import {
  circleBounds,
  cmdsBounds,
  cmdsReach,
  smoothCmds,
  unionBounds,
  type Bounds,
  type DrawCmd,
  type Vec2,
} from "./geometry.ts";
import {
  headCountFor,
  layoutInflorescence,
  solitaryLayout,
  type Floret,
  type InflorescenceLayout,
} from "./inflorescence.ts";
import { generatePetalMarks, type PetalMark } from "./patterns.ts";
import {
  createPetalFrame,
  generatePetal,
  generatePetalPartial,
  overlappingWidth,
  petalLocalToFlower,
  placePetal,
  type PetalFrame,
  type PlacedPetal,
} from "./petal.ts";
import {
  affectsPetals,
  buildNectary,
  generateBio,
  generateBractRing,
  generateParticleSeeds,
  generatePollenSeeds,
  iridescentPetal,
  type BioPetal,
  type BioPlan,
  type BioSource,
  type BractPlan,
  type BractSource,
  type IridescenceSource,
  type NectaryPlan,
  type NectarySource,
  type ParticleSeed,
  type ParticleSource,
  type PetalIridescence,
  type PollenSource,
} from "./effects.ts";
import { generateLeaf, type LeafParams, type LeafPose } from "./leaf.ts";
import {
  DEFAULT_LIFE_STAGE,
  STAGE_PROFILES,
  buildSeedHead,
  generateBuds,
  stageLayers,
  type BudPlan,
  type StageLayerFields,
  type BudSource,
  type SeedHeadPlan,
} from "./lifeStage.ts";
import {
  drawnHalfWidthAt,
  generateStem,
  generateStemSurface,
  sideHeading,
  stemAxis,
  stemPointAt,
  stemTipHeading,
  type StalkPlan,
  type StemAxis,
  type StemPlan,
  type ThornPlan,
} from "./stem.ts";
import {
  GOLDEN_ANGLE,
  LIGHT_ANGLE,
  clamp,
  lerp,
  sidHash,
  sideSign,
  unreachable,
} from "./util.ts";
import {
  AURA_KINDS,
  BIO_PATTERNS,
  DEWDROP_PLACEMENTS,
  DISPERSAL_PATTERNS,
  EDGE_STYLES,
  FLOWER_FAMILIES,
  FUSION_KINDS,
  INFLORESCENCE_KINDS,
  LEAF_SHAPES,
  LIFE_STAGES,
  NECTARY_POSITIONS,
  PARTICLE_KINDS,
  PATTERN_KINDS,
  PETAL_ARRANGEMENTS,
  PETAL_SHAPES,
  SERRATIONS,
  SIDES,
  STEM_STYLES,
  SURFACE_TEXTURES,
  VARIEGATION_KINDS,
  VEIN_PATTERNS,
  isVariant,
  type AuraKind,
  type DewdropPlacement,
  type EdgeStyle,
  type FlowerFamily,
  type FusionKind,
  type InflorescenceKind,
  type LeafShape,
  type LifeStage,
  type PatternKind,
  type PetalArrangement,
  type PetalShape,
  type Serration,
  type Side,
  type StemStyle,
  type SurfaceTexture,
  type VariegationKind,
  type VeinPattern,
} from "../data/flower-enums.ts";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

/** The value when it is a variant of the list, else `fallback`: the Rust default, the first variant unless given. */
function variantOr<T extends readonly [string, ...string[]]>(
  list: T,
  value: unknown,
  fallback: T[number] = list[0],
): T[number] {
  return isVariant(list, value) ? value : fallback;
}

const finiteOr = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

export type StamenPlan = {
  angle: number;
  length: number;
  filamentColor: number;
  antherColor: number;
  antherRadius: number;
};

export type CenterPlan = {
  discRadius: number;
  discColor: number;
  highlightRadius: number;
  highlightColor: number;
  stamens: readonly StamenPlan[];
  nectary: NectaryPlan | null;
  /** the enlarged, stippled receptacle of a SeedHead stage; null otherwise */
  seedHead: SeedHeadPlan | null;
};

export type LeafPlan = {
  cmds: DrawCmd[];
  veins: DrawCmd[];
  color: number;
  veinColor: number;
  /** 1 opaque; translucent leaves let the stem show through */
  alpha: number;
  variegation: { cmds: DrawCmd[]; color: number } | null;
  /** the stalk from the stem to the blade, drawn in the stem color under the blade */
  petiole: StalkPlan | null;
  petioleColor: number;
};

export type DewdropPlan = {
  x: number;
  y: number;
  radius: number;
};

export type AuraPlan = {
  kind: AuraKind;
  color: number;
  opacity: number;
  radius: number;
};

/** One drawn petal, or one lobe of a fused corolla: the same passes apply. */
export type PetalPlan = {
  cmds: DrawCmd[];
  angle: number;
  veinCmds: DrawCmd[];
  marks: readonly PetalMark[];
  color: number;
  highlightColor: number;
  outlineColor: number;
  veinColor: number;
  lightColor: number;
  shadowColor: number;
  midribGlowColor: number;
  texture: SurfaceTexture;
  textureHighlight: number;
  textureEdge: number;
  /** two extra sheen fills when the spec is iridescent */
  iridescence: PetalIridescence | null;
  gradientStops: ReadonlyArray<{
    position: number;
    color: number;
    blendedColor: number;
    cmds: DrawCmd[];
  }>;
};

/** A layer whose petals are fused into one cup; drawn instead of `petals`. */
export type CorollaPlan = {
  body: DrawCmd[];
  bodyRadius: number;
  rimRadius: number;
  color: number;
  throat: Throat;
  lobes: readonly PetalPlan[];
};

export type LayerPlan = {
  /** empty when the layer is fused */
  petals: readonly PetalPlan[];
  corolla: CorollaPlan | null;
  opacity: number;
};

/**
 * One flower head in its own unit space, centred on the origin: everything a
 * floret draws at its offset, scale and angle. A plan holds one head per
 * (stage, depth) its florets need; the first is the spec's own stage in front.
 */
export type HeadPlan = {
  /** showy bracts, a petal-like ring drawn behind the sepals */
  bracts: readonly BractPlan[];
  sepals: ReadonlyArray<{ cmds: DrawCmd[]; color: number }>;
  layers: readonly LayerPlan[];
  center: CenterPlan;
  dewdrops: readonly DewdropPlan[];
  /** glow geometry drawn additively over the head every frame */
  bio: BioPlan | null;
  /** farthest drawn point from the head centre, unit space */
  reach: number;
  /** the innermost ring closes over the centre, so the stamens and disc are drawn under it */
  closedCentre: boolean;
  stage: LifeStage;
  back: boolean;
};

/** A floret with the index of the head plan it draws. */
export type PlacedFloret = Floret & { head: number };

/**
 * Pre-computed rendering plan for a flower — cached per spec, scale-independent.
 * The stem tip is the origin; the stem hangs below it and every floret draws
 * one of the heads at its offset, scale and angle.
 */
export type FlowerPlan = {
  heads: readonly [HeadPlan, ...HeadPlan[]];
  stem: StemPlan | null;
  leaves: readonly LeafPlan[];
  /** side buds on the stem, drawn after the leaves and before the heads */
  buds: readonly BudPlan[];
  aura: AuraPlan | null;
  particles: readonly ParticleSeed[];
  /** the terminal floret first */
  florets: readonly [PlacedFloret, ...PlacedFloret[]];
  /** branches carrying several florets, drawn in the stem color before the pedicels */
  branches: readonly StalkPlan[];
  /** box around everything drawn, plan units */
  bounds: Bounds;
};

// ═══════════════════════════════════════════════════════════════════════════
// Color utilities
// ═══════════════════════════════════════════════════════════════════════════

/** Per-petal color scatter — deterministic hue/brightness jitter for organic variation. */
function scatterColor(color: number, amount: number, seed: number): number {
  const jitter = sidHash(Math.floor(seed * 127), 311) * 2 - 1; // [-1, 1]
  const shift = Math.floor(255 * amount * jitter);
  const r = Math.min(255, Math.max(0, ((color >> 16) & 0xff) + shift));
  const g = Math.min(255, Math.max(0, ((color >> 8) & 0xff) + shift));
  const b = Math.min(255, Math.max(0, (color & 0xff) + shift));
  return (r << 16) | (g << 8) | b;
}

/** Directional light tint — petals facing the light source appear brighter. */
function lightTint(color: number, petalAngle: number): number {
  // Cosine falloff: petals facing the light get up to 10% brightness boost
  const dot = Math.cos(petalAngle - LIGHT_ANGLE);
  const boost = dot * 0.1; // [-0.1, 0.1]
  const r = Math.min(
    255,
    Math.max(0, Math.floor(((color >> 16) & 0xff) * (1 + boost))),
  );
  const g = Math.min(
    255,
    Math.max(0, Math.floor(((color >> 8) & 0xff) * (1 + boost))),
  );
  const b = Math.min(
    255,
    Math.max(0, Math.floor((color & 0xff) * (1 + boost))),
  );
  return (r << 16) | (g << 8) | b;
}

/** Shift color toward warm (increase red, decrease blue). */
function warmShift(color: number): number {
  const r = Math.min(255, ((color >> 16) & 0xff) + 15);
  const g = (color >> 8) & 0xff;
  const b = Math.max(0, (color & 0xff) - 10);
  return (r << 16) | (g << 8) | b;
}

/** Shift color toward cool (increase blue, decrease red). */
function coolShift(color: number): number {
  const r = Math.max(0, ((color >> 16) & 0xff) - 10);
  const g = (color >> 8) & 0xff;
  const b = Math.min(255, (color & 0xff) + 15);
  return (r << 16) | (g << 8) | b;
}

/** Convert an { r, g, b } object (0–1 range) to a packed hex color number. */
function rgbToNumber(c: { r: number; g: number; b: number }): number {
  return colorFromSpec(c.r, c.g, c.b);
}

type RawColor = { r?: number; g?: number; b?: number };
type RawColorGradient = {
  stops?: Array<{ position?: number; color?: RawColor }>;
};

function colorToHex(c: RawColor | undefined): number | null {
  if (!c) return null;
  const r = c.r ?? 0;
  const g = c.g ?? 0;
  const b = c.b ?? 0;
  if (r + g + b < 0.05) return null;
  return colorFromSpec(r, g, b);
}

/** First stop of a ColorGradient, or the color itself when written plain. */
function gradientOrPlainColorToHex(
  c: (RawColor & RawColorGradient) | undefined,
): number | null {
  if (!c) return null;
  return colorToHex(c.stops?.[0]?.color) ?? colorToHex(c);
}

/** Generate a midrib from 5% to 80% of petal length. */
function generateMidrib(frame: PetalFrame): DrawCmd[] {
  const pts: Vec2[] = Array.from({ length: 5 }, (_, i) =>
    petalLocalToFlower(0.05 + (i / 4) * 0.75, 0, frame),
  );
  return smoothCmds(pts);
}

/**
 * Generate a single lateral vein branching from the midrib.
 * branchT = position along midrib [0,1], lateralSign = ±1 for left/right,
 * branchAngle = angle from midrib in radians, branchLen = fraction of the half width to extend.
 */
function generateLateral(
  branchT: number,
  lateralSign: number,
  branchAngle: number,
  branchLen: number,
  frame: PetalFrame,
): DrawCmd[] {
  // 3 points: start on midrib, mid-branch, end near edge
  const pts: Vec2[] = [0, 0.5, 1].map(frac => {
    const t = branchT + frac * branchLen * 0.3 * Math.cos(branchAngle);
    const u = lateralSign * frac * branchLen;
    return petalLocalToFlower(Math.min(0.95, Math.max(0.05, t)), u, frame);
  });
  return smoothCmds(pts);
}

/** Generate vein DrawCmd[] appropriate to the given VeinPattern. */
function generatePetalVein(
  frame: PetalFrame,
  veinPattern: VeinPattern,
  seed: number,
): DrawCmd[] {
  switch (veinPattern) {
    case "None":
      return [];

    case "Parallel": {
      // 4-6 parallel veins evenly spaced across petal width
      const count = 4 + Math.round(sidHash(seed, 71) * 2); // 4-6
      return Array.from({ length: count }, (_, i) => {
        const frac = ((i + 1) / (count + 1)) * 2 - 1; // spread from -1 to 1
        const pts: Vec2[] = Array.from({ length: 5 }, (__, j) =>
          petalLocalToFlower(0.08 + (j / 4) * 0.72, frac * 0.6, frame),
        );
        return smoothCmds(pts);
      }).flat();
    }

    case "Branching": {
      // Midrib + 3-5 pairs of laterals at ~45°
      const midrib = generateMidrib(frame);
      const pairCount = 3 + Math.round(sidHash(seed, 72) * 2); // 3-5
      const laterals = Array.from({ length: pairCount }, (_, i) => {
        const branchT = 0.15 + (i / (pairCount - 1)) * 0.55; // 15%-70% along midrib
        const branchLen = 0.8 * (1 - branchT * 0.6); // shorter toward tip
        const branchAngle = 0.7 + sidHash(seed, 73 + i) * 0.17; // ~40-50°
        return [
          ...generateLateral(branchT, 1, branchAngle, branchLen, frame),
          ...generateLateral(branchT, -1, branchAngle, branchLen, frame),
        ];
      }).flat();
      return [...midrib, ...laterals];
    }

    case "Palmate": {
      // 3-5 veins radiating from base, spreading like fingers
      const count = 3 + Math.round(sidHash(seed, 74) * 2); // 3-5
      return Array.from({ length: count }, (_, i) => {
        const spread = ((i / (count - 1)) * 2 - 1) * 0.7; // -0.7 to 0.7
        const pts: Vec2[] = Array.from({ length: 5 }, (__, j) => {
          const t = 0.05 + (j / 4) * 0.75;
          return petalLocalToFlower(t, spread * t * 1.2, frame); // fan out progressively
        });
        return smoothCmds(pts);
      }).flat();
    }

    case "Reticulate": {
      // Midrib + laterals + cross-connections
      const midrib = generateMidrib(frame);
      const pairCount = 4;
      const lateralTs = Array.from(
        { length: pairCount },
        (_, i) => 0.15 + (i / (pairCount - 1)) * 0.55,
      );
      const laterals = lateralTs
        .map(branchT => {
          const branchLen = 0.7 * (1 - branchT * 0.5);
          return [
            ...generateLateral(branchT, 1, 0.75, branchLen, frame),
            ...generateLateral(branchT, -1, 0.75, branchLen, frame),
          ];
        })
        .flat();
      // Cross-connections between adjacent laterals on each side
      const crossLinks = lateralTs
        .slice(0, -1)
        .map((t1, i) => {
          const t2 = lateralTs[i + 1]!;
          const midT = (t1 + t2) / 2;
          return [-1, 1]
            .map(side => {
              const pts: Vec2[] = [t1, midT, t2].map(t =>
                petalLocalToFlower(Math.min(0.9, t + 0.05), side * 0.35, frame),
              );
              return smoothCmds(pts);
            })
            .flat();
        })
        .flat();
      return [...midrib, ...laterals, ...crossLinks];
    }

    case "Dichotomous": {
      // Y-forking: 1 vein splits into 2 at ~30%, each splits again at ~60%
      const fork = (
        startT: number,
        endT: number,
        u: number,
        depth: number,
      ): DrawCmd[] => {
        const pts: Vec2[] = Array.from({ length: 3 }, (_, i) =>
          petalLocalToFlower(startT + (i / 2) * (endT - startT), u, frame),
        );
        const cmds = smoothCmds(pts);
        if (depth >= 2) return cmds;
        const spread = 0.25 * (1 / (depth + 1));
        return [
          ...cmds,
          ...fork(endT, endT + (endT - startT) * 0.7, u + spread, depth + 1),
          ...fork(endT, endT + (endT - startT) * 0.7, u - spread, depth + 1),
        ];
      };
      return fork(0.05, 0.3, 0, 0);
    }

    case "Arcuate": {
      // 3-4 nested arcs curving from base toward tip along petal edge
      const count = 3 + Math.round(sidHash(seed, 76) * 1); // 3-4
      return Array.from({ length: count }, (_, i) => {
        const arcFrac = 0.3 + (i / count) * 0.5; // how far from center
        const pts: Vec2[] = Array.from({ length: 6 }, (__, j) => {
          const t = 0.08 + (j / 5) * 0.7;
          // Arc bows out toward the edge, stronger for outer arcs
          const bow = arcFrac * Math.sin(Math.PI * t) * 0.8;
          return petalLocalToFlower(t, bow, frame);
        });
        return smoothCmds(pts);
      }).flat();
    }

    case "Pinnate": {
      // Strong midrib + 6-8 closely spaced alternating laterals at ~60°
      const midrib = generateMidrib(frame);
      const pairCount = 6 + Math.round(sidHash(seed, 77) * 2); // 6-8
      const laterals = Array.from({ length: pairCount }, (_, i) => {
        const branchT = 0.1 + (i / (pairCount - 1)) * 0.65;
        const branchLen = 0.7 * (1 - branchT * 0.5);
        const side = i % 2 === 0 ? 1 : -1; // alternating
        return generateLateral(branchT, side, 1.05, branchLen, frame);
      }).flat();
      return [...midrib, ...laterals];
    }

    case "Anastomosing": {
      // Like Branching but laterals curve back to reconnect
      const midrib = generateMidrib(frame);
      const pairCount = 4;
      const laterals = Array.from({ length: pairCount }, (_, i) => {
        const branchT = 0.15 + (i / (pairCount - 1)) * 0.5;
        const nextT =
          i < pairCount - 1
            ? 0.15 + ((i + 1) / (pairCount - 1)) * 0.5
            : branchT + 0.15;
        const branchLen = 0.6 * (1 - branchT * 0.5);
        // Each lateral loops out and reconnects to the midrib at the next branch point
        return [-1, 1]
          .map(side => {
            const pts: Vec2[] = [0, 0.33, 0.66, 1].map(frac => {
              const t = branchT + frac * (nextT - branchT);
              const bow = side * branchLen * Math.sin(Math.PI * frac);
              return petalLocalToFlower(t, bow, frame);
            });
            return smoothCmds(pts);
          })
          .flat();
      }).flat();
      return [...midrib, ...laterals];
    }

    default:
      return unreachable(veinPattern);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Spec parsing
// ═══════════════════════════════════════════════════════════════════════════

type ParsedLayer = {
  count: number;
  shape: PetalShape;
  arrangement: PetalArrangement;
  edgeStyle: EdgeStyle;
  texture: SurfaceTexture;
  width: number;
  length: number;
  curvature: number;
  curl: number;
  droop: number;
  opacity: number;
  angularOffset: number;
  color: number | null;
  gradientStops: Array<{ position: number; color: number }>;
  veinPattern: VeinPattern;
  pattern: ParsedPattern;
  fusion: ParsedFusion;
};

/** Rust `Fusion`: how the layer's petals join into one corolla. */
type ParsedFusion = {
  kind: FusionKind;
  /** 0-1 fraction of the petal length that is fused */
  depth: number;
};

type RawFusion = { kind?: unknown; depth?: unknown };

function parseFusion(raw: RawFusion | undefined): ParsedFusion {
  return {
    kind: variantOr(FUSION_KINDS, raw?.kind),
    depth: unitOr(raw?.depth, 0.5),
  };
}

/** Rust `PetalPattern`; color is null when unset so the plan can derive one from the petal. */
type ParsedPattern = {
  kind: PatternKind;
  color: number | null;
  scale: number;
  density: number;
  extent: number;
};

type RawPattern = {
  kind?: unknown;
  color?: RawColor;
  scale?: unknown;
  density?: unknown;
  extent?: unknown;
};

const unitOr = (value: unknown, fallback: number): number =>
  clamp(0, 1, finiteOr(value, fallback));

function parsePattern(raw: RawPattern | undefined): ParsedPattern {
  return {
    kind: variantOr(PATTERN_KINDS, raw?.kind),
    color: colorToHex(raw?.color),
    scale: unitOr(raw?.scale, 0.5),
    density: unitOr(raw?.density, 0.5),
    extent: unitOr(raw?.extent, 0.5),
  };
}

type ParsedCenter = {
  receptacleSize: number;
  pistilColor: number | null;
  stamens: Array<{
    filamentColor: number | null;
    antherColor: number | null;
    height: number;
  }>;
  pollen: PollenSource | null;
  nectary: NectarySource | null;
};

type RawGlow = {
  intensity?: unknown;
  color?: RawColor;
  radius?: unknown;
  pulse?: { speed?: unknown; min_intensity?: unknown } | null;
};

type RawPollen = {
  particle_count?: unknown;
  drift_speed?: unknown;
  color?: RawColor;
  luminosity?: unknown;
  dispersal?: unknown;
};

type RawNectary = {
  position?: unknown;
  color?: RawColor;
  glow?: RawGlow | null;
};

function parsePollen(raw: RawPollen | null | undefined): PollenSource | null {
  if (!raw) return null;
  return {
    particleCount: Math.max(0, Math.round(finiteOr(raw.particle_count, 0))),
    driftSpeed: unitOr(raw.drift_speed, 0.5),
    color: colorToHex(raw.color),
    luminosity: unitOr(raw.luminosity, 0.5),
    dispersal: variantOr(DISPERSAL_PATTERNS, raw.dispersal),
  };
}

function parseNectary(
  raw: RawNectary | null | undefined,
): NectarySource | null {
  if (!raw) return null;
  const glow = raw.glow;
  return {
    position: variantOr(NECTARY_POSITIONS, raw.position),
    color: colorToHex(raw.color),
    glow: glow
      ? {
          intensity: unitOr(glow.intensity, 0.5),
          color: colorToHex(glow.color),
          radius: unitOr(glow.radius, 0.5),
          pulse: glow.pulse
            ? {
                speed: Math.max(0.05, finiteOr(glow.pulse.speed, 0.5)),
                minIntensity: unitOr(glow.pulse.min_intensity, 0),
              }
            : null,
        }
      : null,
  };
}

type ParsedSepal = {
  color: number | null;
  length: number;
};

/** Rust `Inflorescence`: how many heads and how they sit on the stem. */
type ParsedInflorescence = {
  kind: InflorescenceKind;
  headCount: number;
  headScale: number;
  spread: number;
};

type RawInflorescence = {
  kind?: unknown;
  head_count?: unknown;
  head_scale?: unknown;
  spread?: unknown;
};

function parseInflorescence(
  raw: RawInflorescence | undefined,
): ParsedInflorescence {
  return {
    kind: variantOr(INFLORESCENCE_KINDS, raw?.kind),
    headCount: Math.max(1, Math.round(finiteOr(raw?.head_count, 1))),
    headScale: unitOr(raw?.head_scale, 0.5),
    spread: unitOr(raw?.spread, 0.5),
  };
}

type ParsedSpec = {
  layers: ParsedLayer[];
  center: ParsedCenter;
  sepals: ParsedSepal[];
  inflorescence: ParsedInflorescence;
  stage: LifeStage;
  family: FlowerFamily;
};

type ParsedGradientStop = { position: number; color: number };

const isResolvedStop = (stop: {
  position: number;
  color: number | null;
}): stop is ParsedGradientStop => stop.color !== null;

function parseGradientStops(
  color: RawColorGradient | undefined,
): ParsedGradientStop[] {
  return (color?.stops ?? [])
    .map(s => ({ position: s.position ?? 0, color: colorToHex(s.color) }))
    .filter(isResolvedStop);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseFlowerSpec(spec: any): ParsedSpec | null {
  if (!spec) return null;
  try {
    const layers: ParsedLayer[] = (spec.petals?.layers ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (layer: any) => ({
        count: layer.count ?? 5,
        shape: variantOr(PETAL_SHAPES, layer.shape),
        arrangement: variantOr(PETAL_ARRANGEMENTS, layer.arrangement),
        edgeStyle: variantOr(EDGE_STYLES, layer.edge_style),
        texture: variantOr(SURFACE_TEXTURES, layer.texture),
        width: layer.width ?? 0.5,
        length: layer.length ?? 0.5,
        curvature: layer.curvature ?? 0,
        curl: layer.curl ?? 0,
        droop: layer.droop ?? 0,
        opacity: layer.opacity ?? 1,
        angularOffset: ((layer.angular_offset ?? 0) * Math.PI) / 180,
        color: colorToHex(layer.color?.stops?.[0]?.color),
        gradientStops: parseGradientStops(layer.color),
        veinPattern: variantOr(VEIN_PATTERNS, layer.vein_pattern),
        pattern: parsePattern(layer.pattern),
        fusion: parseFusion(layer.fusion),
      }),
    );

    const reproductive = spec.reproductive ?? {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stamens = (reproductive.stamens ?? []).map((s: any) => ({
      filamentColor: colorToHex(s.filament_color),
      antherColor: colorToHex(s.anther_color),
      height: s.height ?? 0.5,
    }));

    const center: ParsedCenter = {
      receptacleSize: spec.structure?.receptacle?.size ?? 0.5,
      pistilColor: colorToHex(reproductive.pistil?.color),
      stamens,
      pollen: parsePollen(reproductive.pollen),
      nectary: parseNectary(reproductive.nectary),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sepals: ParsedSepal[] = (spec.structure?.sepals ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: any) => ({
        color: colorToHex(s.color),
        length: s.length ?? 0.5,
      }),
    );

    return {
      layers,
      center,
      sepals,
      inflorescence: parseInflorescence(spec.inflorescence),
      stage: variantOr(LIFE_STAGES, spec.petals?.stage, DEFAULT_LIFE_STAGE),
      family: variantOr(FLOWER_FAMILIES, spec.taxonomy?.family),
    };
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Effect parsing — thorns, dewdrops, aura, particles
// ═══════════════════════════════════════════════════════════════════════════

type RawDewdrop = { size?: number; count?: number; placement?: unknown };
type RawParticle = {
  kind?: unknown;
  density?: number;
  color?: RawColor;
  drift_speed?: number;
  gravity?: number;
};

type ParsedThorns = {
  density: number;
  size: number;
  color: number;
};

type ParsedDewdrops = {
  size: number;
  count: number;
  placement: DewdropPlacement;
};

type ParsedAura = AuraPlan;

type RawIridescence = {
  intensity?: unknown;
  hue_shift_range?: unknown;
  affected_parts?: unknown;
};

type RawBio = { pattern?: unknown; color?: RawColor; intensity?: unknown };

const isStringList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(v => typeof v === "string");

function parseIridescence(
  raw: RawIridescence | null | undefined,
): IridescenceSource | null {
  if (!raw) return null;
  return {
    intensity: unitOr(raw.intensity, 0.5),
    hueShiftRange: clamp(0, 180, finiteOr(raw.hue_shift_range, 0.5)),
    affectedParts: isStringList(raw.affected_parts) ? raw.affected_parts : [],
  };
}

function parseBio(
  raw: RawBio | null | undefined,
  fallbackColor: number,
): BioSource | null {
  if (!raw) return null;
  return {
    pattern: variantOr(BIO_PATTERNS, raw.pattern),
    color: colorToHex(raw.color) ?? fallbackColor,
    intensity: unitOr(raw.intensity, 0.5),
  };
}

type ParsedEffects = {
  thorns: ParsedThorns | null;
  dewdrops: ParsedDewdrops[];
  aura: ParsedAura | null;
  particles: ParticleSource[];
  iridescence: IridescenceSource | null;
  bio: BioSource | null;
};

const EMPTY_EFFECTS: ParsedEffects = {
  thorns: null,
  dewdrops: [],
  aura: null,
  particles: [],
  iridescence: null,
  bio: null,
};

/** `baseColor` stands in for a bioluminescence without a color of its own. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseEffects(spec: any, baseColor: number): ParsedEffects {
  if (!spec) return EMPTY_EFFECTS;
  try {
    // Thorns
    const rawThorns = spec.structure?.stem?.thorns;
    const thorns: ParsedThorns | null = rawThorns
      ? {
          density: rawThorns.density ?? 0.3,
          size: rawThorns.size ?? 0.15,
          color: colorToHex(rawThorns.color) ?? 0x3a5a27,
        }
      : null;

    // Dewdrops
    const dewdrops: ParsedDewdrops[] = (spec.ornamentation?.dewdrops ?? []).map(
      (d: RawDewdrop) => ({
        size: d.size ?? 0.05,
        count: d.count ?? 3,
        placement: variantOr(DEWDROP_PLACEMENTS, d.placement),
      }),
    );

    // Aura
    const rawAura = spec.aura;
    const aura: ParsedAura | null = rawAura
      ? {
          kind: variantOr(AURA_KINDS, rawAura.kind),
          color: colorToHex(rawAura.color) ?? 0xc4b5fd,
          opacity: rawAura.opacity ?? 0.15,
          radius: rawAura.radius ?? 0.4,
        }
      : null;

    // Particles
    const particles: ParticleSource[] = (
      spec.ornamentation?.particles ?? []
    ).map((p: RawParticle) => ({
      kind: variantOr(PARTICLE_KINDS, p.kind),
      density: p.density ?? 5,
      color: colorToHex(p.color) ?? 0xfbbf24,
      driftSpeed: p.drift_speed ?? 0.3,
      gravity: p.gravity ?? 0,
    }));

    return {
      thorns,
      dewdrops,
      aura,
      particles,
      iridescence: parseIridescence(spec.ornamentation?.iridescence),
      bio: parseBio(spec.ornamentation?.bioluminescence, baseColor),
    };
  } catch {
    return EMPTY_EFFECTS;
  }
}

/** Generate thorn shapes along a stem path. */
function generateThorns(axis: StemAxis, thorns: ParsedThorns): ThornPlan[] {
  const count = Math.max(1, Math.min(8, Math.round(thorns.density * 8)));
  const thornSize = thorns.size * 0.06;

  return Array.from({ length: count }, (_, i): ThornPlan => {
    const t = 0.2 + (i / (count + 1)) * 0.55; // 20-75% along stem
    const pt = stemPointAt(axis, t);
    const side = i % 2 === 0 ? 1 : -1;
    const perpAngle = pt.angle + side * Math.PI * 0.5;
    const baseOffset = 0.015; // start slightly outside stem edge

    const bx = pt.x + Math.cos(perpAngle) * baseOffset;
    const by = pt.y + Math.sin(perpAngle) * baseOffset;
    const tx =
      pt.x + Math.cos(perpAngle - side * 0.4) * (baseOffset + thornSize);
    const ty =
      pt.y + Math.sin(perpAngle - side * 0.4) * (baseOffset + thornSize);
    const bx2 = pt.x + Math.cos(perpAngle + side * 0.3) * (baseOffset * 0.5);
    const by2 = pt.y + Math.sin(perpAngle + side * 0.3) * (baseOffset * 0.5);

    return {
      cmds: [
        { op: "M", x: bx, y: by },
        { op: "L", x: tx, y: ty },
        { op: "L", x: bx2, y: by2 },
        { op: "Z" },
      ],
      color: thorns.color,
    };
  });
}

/** Distance from the head center for a dewdrop, from a seed in [0, 1). */
const scatteredDist = (s: number): number => 0.1 + s * 0.35;
const DEWDROP_DISTANCE: Record<DewdropPlacement, (s: number) => number> = {
  Random: scatteredDist,
  PetalTip: s => 0.35 + s * 0.15,
  VeinJunction: scatteredDist,
  Edge: s => 0.3 + s * 0.2,
  Center: s => s * 0.15,
  Leaf: scatteredDist,
  Stem: scatteredDist,
};

/** Generate dewdrop positions on the flower head. */
function generateDewdrops(
  dewdrops: ParsedDewdrops[],
  sid: number,
): DewdropPlan[] {
  return dewdrops.flatMap((dd, di) =>
    Array.from({ length: Math.min(dd.count, 8) }, (_, i) => {
      const seed = sidHash(sid, 100 + di * 20 + i);
      const angle = seed * Math.PI * 2;
      const dist = DEWDROP_DISTANCE[dd.placement](seed);
      return {
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        radius: dd.size * 0.04 + seed * 0.015,
      };
    }),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Flower plan creation
// ═══════════════════════════════════════════════════════════════════════════

const EMPTY_CENTER: CenterPlan = {
  discRadius: 0,
  discColor: 0,
  highlightRadius: 0,
  highlightColor: 0,
  stamens: [],
  nectary: null,
  seedHead: null,
};

/**
 * `throatRadius` is the narrowest fused layer's opening, or null when every
 * layer is free; the disc is clamped to it so the center sits inside the tube.
 */
function buildCenter(
  parsed: NonNullable<ReturnType<typeof parseFlowerSpec>>,
  baseColor: number,
  sid: number,
  throatRadius: number | null,
): CenterPlan {
  if (parsed.layers.length === 0) return EMPTY_CENTER;

  const layerFactor = Math.max(0.4, 1 - parsed.layers.length * 0.15);
  const openRadius = Math.max(
    0.06,
    Math.min(0.35, parsed.center.receptacleSize * 0.25 * layerFactor),
  );
  const discRadius = Math.min(openRadius, throatRadius ?? openRadius);
  const pistilColor = parsed.center.pistilColor ?? darkenColor(baseColor, 0.4);

  const stamens: StamenPlan[] = parsed.center.stamens.map((s, i) => ({
    angle:
      (i / Math.max(1, parsed.center.stamens.length)) * Math.PI * 2 +
      sidHash(sid, 20 + i) * 0.4,
    length: discRadius + s.height * 0.25,
    filamentColor: s.filamentColor ?? darkenColor(baseColor, 0.6),
    antherColor: s.antherColor ?? 0xffd700,
    antherRadius: 0.025,
  }));

  return {
    discRadius,
    discColor: pistilColor,
    highlightRadius: discRadius * 0.45,
    highlightColor: lightenColor(pistilColor, 0.35),
    stamens,
    nectary: null,
    seedHead: null,
  };
}

/**
 * Compute petal angles for a layer based on arrangement type.
 * This is what makes roses look different from daisies from orchids.
 */
type PetalPlacement = { angle: number; radialOffset: number };

function computePetalAngles(
  count: number,
  baseOffset: number,
  arrangement: PetalArrangement,
  sid: number,
  layerIdx: number,
): PetalPlacement[] {
  const TAU = Math.PI * 2;

  /** Wrap a plain angle array into placements with uniform radialOffset. */
  const uniform = (angles: number[]): PetalPlacement[] =>
    angles.map(angle => ({ angle, radialOffset: 1.0 }));

  /** Standard even distribution. */
  const evenRing = (): PetalPlacement[] =>
    uniform(
      Array.from({ length: count }, (_, i) => baseOffset + (i / count) * TAU),
    );

  switch (arrangement) {
    // A spiralled bloom is rings of overlapping petals, each ring set deeper
    // in the cup than the one outside it; the overlap comes from the width
    // (see SPIRAL_OVERLAP), the depth from the layer inset.
    case "Spiral":
      return evenRing().map(p => ({
        ...p,
        radialOffset: Math.max(0.4, 1 - SPIRAL_INSET * layerIdx),
      }));

    case "Bilateral": {
      // Mirror symmetry — petals concentrated on two sides
      // Top half gets most petals, bottom has fewer/none (like orchids, sweet peas)
      return uniform(
        Array.from({ length: count }, (_, i) => {
          const t = i / Math.max(1, count - 1); // 0..1
          // Spread across ~180° (top half), mirrored
          const halfSpread = Math.PI * 0.7;
          const angle = baseOffset - halfSpread / 2 + t * halfSpread;
          // Add slight wobble for organic feel
          return angle + sidHash(sid, 30 + layerIdx * 50 + i) * 0.15;
        }),
      );
    }

    case "Papilionaceous": {
      // Butterfly/pea flower — 1 large banner, 2 wings, 2 keel petals
      // Only meaningful for count ~5, but degrade gracefully
      if (count <= 5) {
        const banner = baseOffset; // top center
        const wingL = baseOffset + Math.PI * 0.35;
        const wingR = baseOffset - Math.PI * 0.35;
        const keelL = baseOffset + Math.PI * 0.6;
        const keelR = baseOffset - Math.PI * 0.6;
        return uniform([banner, wingL, wingR, keelL, keelR].slice(0, count));
      }
      return evenRing();
    }

    case "Cruciform": {
      // Cross-shaped — petals at exact 90° intervals
      // Works best with count = 4, but handles others
      return uniform(
        Array.from(
          { length: count },
          (_, i) => baseOffset + (i / Math.max(count, 4)) * TAU,
        ),
      );
    }

    case "Zygomorphic": {
      // Irregular — one plane of symmetry, clustered toward one side
      return uniform(
        Array.from({ length: count }, (_, i) => {
          const t = i / Math.max(1, count - 1);
          // Cluster in upper 240° arc, leaving bottom open
          const arcSpan = Math.PI * 1.33;
          return baseOffset - arcSpan / 2 + t * arcSpan;
        }),
      );
    }

    case "Imbricate": {
      // Overlapping — like radial but with slight progressive offset per petal
      // Creates a pinwheel/twisted look
      const step = TAU / count;
      const twist = 0.08; // slight twist per petal
      return uniform(
        Array.from(
          { length: count },
          (_, i) => baseOffset + i * step + i * twist,
        ),
      );
    }

    case "Contorted": {
      // Each petal overlaps the next in one direction — like a pinwheel
      const step = TAU / count;
      const twist = step * 0.15;
      return uniform(
        Array.from(
          { length: count },
          (_, i) => baseOffset + i * (step + twist),
        ),
      );
    }

    case "Whorled": {
      // Multiple whorls — cluster petals in groups
      const whorlSize = Math.max(2, Math.ceil(count / 3));
      return uniform(
        Array.from({ length: count }, (_, i) => {
          const whorl = Math.floor(i / whorlSize);
          const posInWhorl = i % whorlSize;
          const whorlOffset = whorl * 0.3; // offset between whorls
          return baseOffset + (posInWhorl / whorlSize) * TAU + whorlOffset;
        }),
      );
    }

    // Valvate is edge-to-edge with no overlap, the same ring as Radial
    case "Valvate":
    case "Radial":
      return evenRing();

    default:
      return unreachable(arrangement);
  }
}

type TextureColors = { textureHighlight: number; textureEdge: number };

const plainTexture = (color: number): TextureColors => ({
  textureHighlight: color,
  textureEdge: color,
});

/** Texture-specific highlight and edge colors for a petal. */
const TEXTURE_COLORS: Record<SurfaceTexture, (color: number) => TextureColors> =
  {
    Smooth: plainTexture,
    Velvet: color => ({
      textureHighlight: color,
      textureEdge: darkenColor(color, 0.3),
    }),
    Silk: color => ({
      textureHighlight: lightenColor(color, 0.3),
      textureEdge: color,
    }),
    Papery: color => ({
      textureHighlight: desaturate(color, 0.3),
      textureEdge: lightenColor(color, 0.1),
    }),
    Waxy: color => ({
      textureHighlight: lightenColor(color, 0.4),
      textureEdge: darkenColor(color, 0.6),
    }),
    Rough: plainTexture,
    Hairy: plainTexture,
    Glassy: color => ({ textureHighlight: 0xffffff, textureEdge: color }),
    Crystalline: color => ({
      textureHighlight: 0xffffff,
      textureEdge: lightenColor(color, 0.2),
    }),
    Scaled: plainTexture,
    Metallic: color => ({
      textureHighlight: lightenColor(color, 0.45),
      textureEdge: darkenColor(coolShift(color), 0.8),
    }),
    Pearlescent: color => ({
      textureHighlight: warmShift(lightenColor(color, 0.2)),
      textureEdge: coolShift(color),
    }),
    Fuzzy: plainTexture,
    Frosted: color => ({
      textureHighlight: 0xffffff,
      textureEdge: lightenColor(color, 0.3),
    }),
    Leathery: plainTexture,
    Powdery: plainTexture,
  };

/** A head with nothing to draw still needs a reach so it can be laid out and hit. */
const MIN_HEAD_REACH = 0.15;

const DEFAULT_SEPAL_COLOR = 0x2d5a27;

/** how far a leaf turns from the stem's perpendicular toward the tip: 45 degrees from the stem */
const LEAF_RISE = Math.PI * 0.25;
/** the spec's angle offset can swing a leaf this far either way of LEAF_RISE, so 35 to 55 degrees from the stem */
const LEAF_RISE_SWING = Math.PI * (10 / 180);
/** a scale bract hugs the stem, almost along it */
const SCALE_BRACT_RISE = Math.PI * 0.42;
/** the stem length as a share of the spec's stem height, plus one */
const STEM_LENGTH = [1.2, 2] as const;
/** stem base half width as a share of its length, over the spec's thickness */
const STEM_HALF_WIDTH = [0.012, 0.02] as const;
/** the stem green is the leaf green this much darker, tinted toward the spec's stem color by STEM_TINT */
const STEM_SHADE = 0.75;
const STEM_TINT = 0.4;
/** how far leaf green moves toward gray */
const LEAF_DESATURATION = 0.12;
/** where leaves may attach, as shares of the stem length from the base */
const SOLITARY_LEAF_BAND = [0.15, 0.7] as const;
const CLUSTER_LEAF_BAND = [0.12, 0.42] as const;
/** blade length as a share of the stem length, low leaves first */
const LEAF_BLADE = [0.3, 0.18] as const;
const LEAF_PETIOLE = 0.2;
/** a solitary head is this many stem lengths across */
const SOLITARY_DIAMETER = [0.28, 0.4] as const;
/** petal count times petal area that bows the tip the least and the most */
const HEAD_WEIGHT = [4, 30] as const;
const HEAD_BOW = [Math.PI * (5 / 180), Math.PI * (12 / 180)] as const;
/** each raceme head past five arches the axis by this much curvature */
const RACEME_ARCH = 0.02;
/** petals pointing away from the viewer on a nodding head are this much shorter */
const PETAL_FORESHORTEN = 0.85;
/** back florets are drawn this much darker */
const BACK_SHADE = 0.85;
/** adjacent petals of a spiralled ring overlap by this share of their width */
const SPIRAL_OVERLAP = 0.38;
/** each inner ring of a spiralled bloom sits this much deeper in the cup */
const SPIRAL_INSET = 0.18;
/** a corymb carries a pair of opposite leaves this far below its dome, as a share of the stem */
const CORYMB_LEAF_DROP = 0.1;
const CORYMB_LEAF_RISE = Math.PI * 0.3;

const EMPTY_HEAD: HeadPlan = {
  bracts: [],
  sepals: [],
  layers: [],
  center: EMPTY_CENTER,
  dewdrops: [],
  bio: null,
  reach: MIN_HEAD_REACH,
  closedCentre: false,
  stage: DEFAULT_LIFE_STAGE,
  back: false,
};

const EMPTY_PLAN: FlowerPlan = {
  heads: [EMPTY_HEAD],
  stem: null,
  leaves: [],
  buds: [],
  aura: null,
  particles: [],
  florets: [
    { ...solitaryLayout(null, 1, DEFAULT_LIFE_STAGE).florets[0], head: 0 },
  ],
  branches: [],
  bounds: circleBounds(0, 0, MIN_HEAD_REACH),
};

/** Outlines of everything petal-like a layer draws. */
const layerPetalCmds = (layer: LayerPlan): DrawCmd[][] => [
  ...layer.petals.map(p => p.cmds),
  ...(layer.corolla?.lobes.map(lobe => lobe.cmds) ?? []),
];

/** Farthest point of the head's drawn parts from its centre, unit space. */
function headReach(
  bracts: readonly BractPlan[],
  sepals: HeadPlan["sepals"],
  layers: readonly LayerPlan[],
  center: CenterPlan,
): number {
  return Math.max(
    MIN_HEAD_REACH,
    center.discRadius,
    ...center.stamens.map(s => s.length + s.antherRadius),
    ...(center.seedHead
      ? [cmdsReach(center.seedHead.strokes), cmdsReach(center.seedHead.fills)]
      : []),
    ...bracts.map(b => cmdsReach(b.cmds)),
    ...sepals.map(s => cmdsReach(s.cmds)),
    ...layers.flatMap(layer => [
      ...layerPetalCmds(layer).map(cmdsReach),
      ...(layer.corolla ? [layer.corolla.bodyRadius] : []),
    ]),
  );
}

/** Farthest petal point from the head centre: the head's visual diameter is twice this. Falls back to the full reach for a petalless head. */
function petalReach(head: HeadPlan): number {
  const reach = Math.max(
    0,
    ...head.layers.flatMap(layer => layerPetalCmds(layer).map(cmdsReach)),
  );
  return reach > 0 ? reach : head.reach;
}

/** One built layer with what its petals lend the effects: frames for marks, outlines and veins. */
type LayerBuild = { layer: LayerPlan; bio: readonly BioPetal[] };

/** What buildLeafPlan reads from a leaf; a parsed leaf satisfies it and a scale bract builds one. */
type LeafBlade = LeafParams & {
  color: number;
  translucency: number;
  variegation: { kind: VariegationKind; color: number | null };
};

function buildLeafPlan(
  pose: LeafPose,
  blade: LeafBlade,
  stemColor: number,
): LeafPlan {
  const leaf = generateLeaf(pose, blade);
  const translucent = blade.translucency > 0.5;
  return {
    cmds: leaf.outline,
    veins: leaf.veins,
    color: blade.color,
    veinColor: translucent
      ? lightenColor(blade.color, 0.25)
      : darkenColor(blade.color, 0.5),
    alpha: 1 - clamp(0, 1, blade.translucency) * 0.45,
    variegation:
      leaf.variegation.length > 0
        ? {
            cmds: leaf.variegation,
            color: blade.variegation.color ?? lightenColor(blade.color, 0.35),
          }
        : null,
    petiole: leaf.petiole,
    petioleColor: stemColor,
  };
}

/** Stem base half width for a stem of `length` at the spec's 0-1 thickness. */
function stemHalfWidth(length: number, thickness: number): number {
  return (
    length *
    lerp(STEM_HALF_WIDTH[0], STEM_HALF_WIDTH[1], clamp(0, 1, thickness))
  );
}

/** The stem green: the leaf green darkened, with the spec's own stem color as a tint. */
function plantStemColor(leafGreen: number, specStemColor: number): number {
  return lerpColor(
    darkenColor(leafGreen, STEM_SHADE),
    specStemColor,
    STEM_TINT,
  );
}

const leafBladeColor = (leafGreen: number): number =>
  desaturate(leafGreen, LEAF_DESATURATION);

function buildStemPlan(
  axis: StemAxis,
  halfWidth: number,
  color: number,
  stemData: ParsedStem,
  thorns: ParsedThorns | null,
  seed: number,
): StemPlan {
  return {
    cmds: generateStem(axis, halfWidth),
    color,
    thorns: thorns ? generateThorns(axis, thorns) : [],
    axis,
    halfWidth,
    surface: generateStemSurface(
      axis,
      halfWidth,
      stemData.surface,
      color,
      seed,
    ),
  };
}

/** A non-showy bract: a small green scale on the stem, drawn as a leaf. */
function scaleBractBlade(bract: BractSource): LeafBlade {
  return {
    shape: bract.shape,
    serration: "None",
    droop: 0,
    color: bract.color ?? DEFAULT_LEAF_COLOR,
    translucency: 0,
    variegation: { kind: "None", color: null },
  };
}

/** Everything a head is built from that does not change with its stage or depth. */
type HeadSource = {
  parsed: ParsedSpec;
  baseColor: number;
  iridescence: IridescenceSource | null;
  bio: BioSource | null;
  dewdrops: ParsedDewdrops[];
  bractSources: readonly BractSource[];
  sid: number;
};

/**
 * One head at `stage`, in unit space. A back head is the same head with
 * every color darkened, for florets on the far side of the axis.
 */
function buildHead(src: HeadSource, stage: LifeStage, back: boolean): HeadPlan {
  const { parsed, baseColor, iridescence, sid } = src;
  const tint = (color: number): number =>
    back ? darkenColor(color, BACK_SHADE) : color;
  const stageProfile = STAGE_PROFILES[stage];
  const stagedLayers = stageLayers(stage, parsed.layers, baseColor);
  const initialOffset = sidHash(sid, 5) * Math.PI * 2;
  const layerOffsets = stagedLayers.reduce<number[]>(
    (offsets, layer) => [
      ...offsets,
      (offsets.at(-1) ?? initialOffset) +
        layer.angularOffset +
        (offsets.length > 0 ? GOLDEN_ANGLE : 0),
    ],
    [],
  );
  const cumulativeOffset = layerOffsets.at(-1) ?? initialOffset;

  const layerBuilds = stagedLayers.map((layer, layerIdx): LayerBuild => {
    const count = Math.max(1, Math.min(55, layer.count));
    const layerOffset = layerOffsets[layerIdx] ?? initialOffset;

    // Inner layers sit deeper in the cup, so each is a little darker
    const layerColor = tint(
      desaturate(
        darkenColor(layer.color ?? baseColor, 1 - layerIdx * 0.06),
        stageProfile.desaturation,
      ),
    );

    /** Colors, veins and marks for one placed petal or lobe, index i in its layer. */
    const planPetal = (
      { frame, angle, cmds }: PlacedPetal,
      i: number,
    ): PetalPlan => {
      const scattered = scatterColor(
        layerColor,
        0.06,
        i * 7.3 + layerIdx * 13.1,
      );
      const lit = lightTint(scattered, angle);

      // Build gradient stops with scatter+lightTint applied per-petal,
      // and generate partial sub-paths for each stop beyond the first
      const gradientStops =
        layer.gradientStops.length >= 2
          ? layer.gradientStops.map((stop, si) => {
              const stopScattered = scatterColor(
                tint(stop.color),
                0.04,
                i * 5.1 + si * 3.7,
              );
              const stopLit = lightTint(stopScattered, angle);
              const stopCmds: DrawCmd[] =
                si === 0 ? [] : generatePetalPartial(frame, stop.position);
              return {
                position: stop.position,
                color: stopLit,
                blendedColor:
                  si === 0
                    ? stopLit
                    : lerpColor(lit, stopLit, 0.5 + (si - 1) * 0.15),
                cmds: stopCmds,
              };
            })
          : [];

      return {
        cmds,
        angle,
        veinCmds: generatePetalVein(
          frame,
          layer.veinPattern,
          sidHash(sid, 50 + layerIdx * 100 + i),
        ),
        marks: generatePetalMarks(
          {
            ...layer.pattern,
            color: layer.pattern.color ?? darkenColor(lit, 0.45),
          },
          frame,
          sidHash(sid, 800 + layerIdx * 100 + i),
        ),
        color: lit,
        highlightColor: lightenColor(lit, 0.18),
        outlineColor: darkenColor(lit, 0.55),
        veinColor: darkenColor(lit, 0.6),
        lightColor: lightenColor(lit, 0.15),
        shadowColor: darkenColor(lit, 0.8),
        midribGlowColor: lightenColor(lit, 0.2),
        texture: layer.texture,
        ...TEXTURE_COLORS[layer.texture](lit),
        iridescence: iridescence
          ? iridescentPetal(iridescence, lit, angle)
          : null,
        gradientStops,
      };
    };

    /** Plans for placed petals, paired with what each lends the glow effects. */
    const planAll = (placed: readonly PlacedPetal[]) =>
      placed.map((p, i) => {
        const plan = planPetal(p, i);
        return {
          plan,
          bio: { frame: p.frame, cmds: plan.cmds, veinCmds: plan.veinCmds },
        };
      });

    const { kind: fusionKind, depth } = layer.fusion;
    if (isFused(fusionKind)) {
      const corollaLayer: CorollaLayer = {
        shape: layer.shape,
        edge: layer.edgeStyle,
        length: layer.length,
        width: layer.width,
        curvature: layer.curvature + layer.droop * 0.3,
        curl: layer.curl,
        color: layerColor,
      };
      const reference = createPetalFrame({
        angle: layerOffset,
        shape: corollaLayer.shape,
        edge: corollaLayer.edge,
        length: corollaLayer.length,
        width: corollaLayer.width,
        curvature: corollaLayer.curvature,
        curl: corollaLayer.curl,
        seed: sidHash(sid, 10 + layerIdx * 100),
      });
      const corolla = generateCorolla(
        corollaLayer,
        reference,
        fusionKind,
        depth,
        count,
        sidHash(sid, 900 + layerIdx),
      );
      const lobes = planAll(corolla.lobes);
      return {
        layer: {
          petals: [],
          corolla: {
            ...corolla,
            color: layerColor,
            lobes: lobes.map(l => l.plan),
          },
          opacity: layer.opacity,
        },
        bio: lobes.map(l => l.bio),
      };
    }

    const petalAngles = computePetalAngles(
      count,
      layerOffset,
      layer.arrangement,
      sid,
      layerIdx,
    );
    const width =
      layer.arrangement === "Spiral"
        ? Math.max(
            layer.width,
            overlappingWidth(layer.length, count, SPIRAL_OVERLAP),
          )
        : layer.width;

    const petals = planAll(
      petalAngles.map(({ angle, radialOffset }, i) => {
        const salt = layerIdx * 100 + i;
        const frame = createPetalFrame({
          angle: angle + petalAngleJitter(sid, salt),
          shape: layer.shape,
          edge: layer.edgeStyle,
          length:
            layer.length * petalLengthJitter(sid, salt) * foreshortening(angle),
          width: width * petalWidthJitter(sid, salt),
          curvature:
            layer.curvature +
            layer.droop * 0.3 +
            sidHash(sid, 600 + salt) * 0.1 -
            0.05,
          curl: layer.curl + sidHash(sid, 700 + salt) * 0.06 - 0.03,
          seed: sidHash(sid, 10 + salt),
          radialOffset: radialOffset * stageProfile.radialOffset,
        });
        return placePetal(frame, angle);
      }),
    );

    return {
      layer: {
        petals: petals.map(p => p.plan),
        corolla: null,
        opacity: layer.opacity,
      },
      bio: petals.map(p => p.bio),
    };
  });
  const layers = layerBuilds.map(b => b.layer);

  const throatRadii = layers.flatMap(layer =>
    layer.corolla ? [layer.corolla.throat.radius] : [],
  );
  const centerBase = buildCenter(
    parsed,
    baseColor,
    sid,
    throatRadii.length > 0 ? Math.min(...throatRadii) : null,
  );

  // ── Sepals (behind petals): cupped around a bud, reflexed under a fading head ──
  const sepalCount = parsed.sepals.length;
  const sepalBuilds = parsed.sepals.map((s, i) => ({
    frame: createPetalFrame({
      angle:
        (i / Math.max(1, sepalCount)) * Math.PI * 2 + cumulativeOffset * 0.5,
      shape: "Lanceolate",
      edge: "Smooth",
      length: (0.3 + s.length * 0.6) * stageProfile.sepals.lengthScale,
      width: stageProfile.sepals.width,
      curvature: stageProfile.sepals.curvature,
      curl: 0,
      seed: sidHash(sid, 50 + i),
    }),
    color: tint(s.color ?? DEFAULT_SEPAL_COLOR),
  }));
  const sepals = sepalBuilds.map(b => ({
    cmds: generatePetal(b.frame),
    color: b.color,
  }));

  // ── Bracts: showy ones ring the head behind the sepals ──
  const bracts = generateBractRing(src.bractSources, {
    petalLength: parsed.layers[0]?.length ?? 1,
    petalWidth: parsed.layers[0]?.width ?? 0.8,
    baseAngle: layerOffsets[0] ?? initialOffset,
    sid,
  }).map(b => ({ ...b, color: tint(b.color) }));

  // ── Centre per stage: hidden inside a bud, a seed head after the petals ──
  const stagedCenter = run((): CenterPlan => {
    if (stage === "SeedHead") {
      const seedHead = buildSeedHead(
        centerBase.discRadius,
        centerBase.discColor,
        parsed.family,
        sid,
      );
      return {
        ...centerBase,
        discRadius: seedHead.discRadius,
        highlightRadius: 0,
        stamens: [],
        seedHead,
      };
    }
    return stageProfile.throatOpen ? centerBase : EMPTY_CENTER;
  });
  const shadedCenter: CenterPlan = {
    ...stagedCenter,
    discColor: tint(stagedCenter.discColor),
    highlightColor: tint(stagedCenter.highlightColor),
    stamens: stagedCenter.stamens.map(s => ({
      ...s,
      filamentColor: tint(s.filamentColor),
      antherColor: tint(s.antherColor),
    })),
  };

  const reach = headReach(bracts, sepals, layers, shadedCenter);
  const center: CenterPlan =
    parsed.center.nectary && stageProfile.throatOpen
      ? {
          ...shadedCenter,
          nectary: buildNectary(parsed.center.nectary, {
            discRadius: shadedCenter.discRadius,
            discColor: shadedCenter.discColor,
            headReach: reach,
            petalFrames: layerBuilds[0]?.bio.map(b => b.frame) ?? [],
            sepalFrames: sepalBuilds.map(b => b.frame),
            sid,
          }),
        }
      : shadedCenter;

  return {
    bracts,
    sepals,
    layers,
    center,
    dewdrops: generateDewdrops(src.dewdrops, sid),
    bio: src.bio
      ? generateBio(
          src.bio,
          layerBuilds.flatMap(b => b.bio),
          sidHash(sid, 1700),
        )
      : null,
    reach,
    closedCentre: hasClosedCentre(stagedLayers),
    stage,
    back,
  };
}

/** a spiralled bloom whose innermost ring cups at least this much hides its centre, like a garden rose */
const CLOSED_CENTRE_CURVATURE = 0.6;

function hasClosedCentre(layers: readonly StageLayerFields[]): boolean {
  const inner = layers.at(-1);
  return (
    layers.length >= 2 &&
    inner?.arrangement === "Spiral" &&
    inner.curvature >= CLOSED_CENTRE_CURVATURE
  );
}

/** Per-petal volume: lengths 0.92 to 1.08, widths 0.94 to 1.06, headings within 3 degrees. */
const petalLengthJitter = (sid: number, salt: number): number =>
  lerp(0.92, 1.08, sidHash(sid, 400 + salt));
const petalWidthJitter = (sid: number, salt: number): number =>
  lerp(0.94, 1.06, sidHash(sid, 500 + salt));
/**
 * A head on a bowing stem nods toward the viewer, so the petals on its far
 * half (pointing up the screen in head space) are seen shorter, the way a
 * cup is seen slightly from the side rather than as a stamp.
 */
const foreshortening = (petalAngle: number): number =>
  1 - (1 - PETAL_FORESHORTEN) * Math.max(0, -Math.sin(petalAngle));
const petalAngleJitter = (sid: number, salt: number): number =>
  (sidHash(sid, 300 + salt) * 2 - 1) * Math.PI * (3 / 180);

/** Petal count times petal area, in spec units, summed over the layers: what bows the stem tip. */
function headWeight(layers: readonly ParsedLayer[]): number {
  return layers.reduce(
    (sum, layer) => sum + layer.count * layer.length * layer.width,
    0,
  );
}

/** How far the tip bows under a head of `weight`: 5 to 12 degrees. */
function weightBow(weight: number): number {
  const w = clamp(
    0,
    1,
    (weight - HEAD_WEIGHT[0]) / (HEAD_WEIGHT[1] - HEAD_WEIGHT[0]),
  );
  return lerp(HEAD_BOW[0], HEAD_BOW[1], w);
}

/** The stem axis from (0, length) up to the origin, bowed at the tip the way it already leans, or by the seed when it is upright. */
function plantAxis(
  stemData: ParsedStem,
  length: number,
  arch: number,
  bow: number,
  sid: number,
): StemAxis {
  const unbowed = stemAxis(
    [0, length],
    [0, 0],
    stemData.curvature + arch,
    stemData.style,
  );
  const lean = stemTipHeading(unbowed);
  const side = run(() => {
    if (Math.abs(lean) > 1e-6) return Math.sign(lean);
    return sidHash(sid, 3) < 0.5 ? -1 : 1;
  });
  return stemAxis(
    [0, length],
    [0, 0],
    stemData.curvature + arch,
    stemData.style,
    side * bow,
  );
}

type HeadKey = { stage: LifeStage; back: boolean };

const sameKey = (a: HeadKey, b: HeadKey): boolean =>
  a.stage === b.stage && a.back === b.back;

/** The distinct (stage, depth) heads the florets need, the spec's own front head first. */
function headKeys(
  florets: readonly Floret[],
  primary: HeadKey,
): [HeadKey, ...HeadKey[]] {
  return florets.reduce<[HeadKey, ...HeadKey[]]>(
    (keys, f) =>
      keys.some(k => sameKey(k, f))
        ? keys
        : [...keys, { stage: f.stage, back: f.back }],
    [primary],
  );
}

/** Create a complete, scale-independent rendering plan from a flower spec. */
export function createFlowerPlan(
  spec: string | undefined,
  sid: number,
): FlowerPlan {
  const raw = parseSpec(spec);
  const parsed = parseFlowerSpec(raw);

  if (!parsed) return EMPTY_PLAN;

  const baseColor = parsed.layers[0]?.color ?? fallbackColor(sid);
  const effects = parseEffects(raw, baseColor);
  const source: HeadSource = {
    parsed,
    baseColor,
    iridescence:
      effects.iridescence && affectsPetals(effects.iridescence)
        ? effects.iridescence
        : null,
    bio: effects.bio,
    dewdrops: effects.dewdrops,
    bractSources: parseBracts(raw),
    sid,
  };
  const stage = parsed.stage;
  const primaryHead = buildHead(source, stage, false);

  // ── Stem: the unit everything else derives from ──
  const stemData = parseSpecStem(raw);
  const leafSpecs = parseFoliage(raw);
  const kind = parsed.inflorescence.kind;
  const headCount = headCountFor(kind, parsed.inflorescence.headCount);
  const solitary = headCount <= 1;
  const stemLength = stemData
    ? clamp(STEM_LENGTH[0], STEM_LENGTH[1], 1 + stemData.height)
    : 0;
  const leafGreen = leafSpecs[0]?.color ?? DEFAULT_LEAF_COLOR;
  const stemColor = plantStemColor(
    leafGreen,
    stemData?.color ?? DEFAULT_STEM.color,
  );
  const axis = plantAxis(
    stemData ?? DEFAULT_STEM,
    stemLength,
    kind === "Raceme" ? RACEME_ARCH * Math.max(0, headCount - 5) : 0,
    weightBow(headWeight(parsed.layers)),
    sid,
  );
  const halfWidth = stemHalfWidth(stemLength, stemData?.thickness ?? 0);
  const stem: StemPlan | null = stemData
    ? buildStemPlan(axis, halfWidth, stemColor, stemData, effects.thorns, sid)
    : null;

  // ── Leaves: alternate up the lower stem, the low ones largest, on petioles ──
  const leafBand = solitary ? SOLITARY_LEAF_BAND : CLUSTER_LEAF_BAND;
  const firstLeafSide = sideSign(leafSpecs[0]?.side ?? "Left");
  const leaves: LeafPlan[] = stemData
    ? leafSpecs.map((l, i) => {
        const t = lerp(leafBand[0], leafBand[1], l.position);
        const pt = stemPointAt(axis, t);
        const side = i % 2 === 0 ? firstLeafSide : -firstLeafSide;
        const blade =
          stemLength *
          clamp(
            LEAF_BLADE[1],
            LEAF_BLADE[0],
            lerp(LEAF_BLADE[0], LEAF_BLADE[1], l.position) *
              (0.85 + 0.3 * l.size),
          );
        const rise =
          LEAF_RISE + clamp(-LEAF_RISE_SWING, LEAF_RISE_SWING, l.angleOffset);
        return buildLeafPlan(
          {
            x: pt.x,
            y: pt.y,
            angle: pt.angle + Math.PI / 2 - side * (Math.PI / 2 - rise),
            blade,
            petiole: blade * LEAF_PETIOLE,
            stemHalfWidth: drawnHalfWidthAt(halfWidth, axis.style, t),
          },
          { ...l, color: leafBladeColor(l.color) },
          stemColor,
        );
      })
    : [];

  // A corymb carries a pair of opposite leaves right under its dome, as a hydrangea does
  const domeLeaf = leafSpecs[0];
  const domeLeaves: LeafPlan[] =
    stemData && kind === "Corymb" && !solitary && domeLeaf
      ? [1, -1].map(side => {
          const t = 1 - CORYMB_LEAF_DROP;
          const pt = stemPointAt(axis, t);
          const blade = stemLength * LEAF_BLADE[1] * 1.2;
          return buildLeafPlan(
            {
              x: pt.x,
              y: pt.y,
              angle:
                pt.angle +
                Math.PI / 2 -
                side * (Math.PI / 2 - CORYMB_LEAF_RISE),
              blade,
              petiole: blade * LEAF_PETIOLE,
              stemHalfWidth: drawnHalfWidthAt(halfWidth, axis.style, t),
            },
            { ...domeLeaf, color: leafBladeColor(domeLeaf.color) },
            stemColor,
          );
        })
      : [];

  // Non-showy bracts are small scales on the stem, alternating sides
  const scaleBracts: LeafPlan[] = stemData
    ? source.bractSources
        .filter(b => !b.showy)
        .map((b, i) => {
          const pt = stemPointAt(axis, clamp(0.05, 0.98, b.position));
          const side: Side = i % 2 === 0 ? "Left" : "Right";
          return buildLeafPlan(
            {
              x: pt.x,
              y: pt.y,
              angle: sideHeading(pt.angle, side, SCALE_BRACT_RISE),
              blade: stemLength * (0.05 + b.size * 0.07),
              petiole: 0,
              stemHalfWidth: halfWidth,
            },
            scaleBractBlade(b),
            stemColor,
          );
        })
    : [];

  // ── Florets: one head on the tip, or the inflorescence's cluster of small ones ──
  const reach = petalReach(primaryHead);
  const layout: InflorescenceLayout = run(() => {
    if (!stem) return solitaryLayout(null, 1, stage);
    if (solitary) {
      const diameter = clamp(
        SOLITARY_DIAMETER[0] * stemLength,
        SOLITARY_DIAMETER[1] * stemLength,
        2 * reach,
      );
      return solitaryLayout(stem, diameter / (2 * reach), stage);
    }
    return layoutInflorescence({
      ...parsed.inflorescence,
      stem,
      headRadius: reach,
      stage,
      sid,
    });
  });
  const keys = headKeys(layout.florets, { stage, back: false });
  const [, ...secondaryKeys] = keys;
  const heads: [HeadPlan, ...HeadPlan[]] = [
    primaryHead,
    ...secondaryKeys.map(k => buildHead(source, k.stage, k.back)),
  ];
  const [firstFloret, ...otherFlorets] = layout.florets;
  const place = (f: Floret): PlacedFloret => ({
    ...f,
    head: keys.findIndex(k => sameKey(k, f)),
  });
  const florets: [PlacedFloret, ...PlacedFloret[]] = [
    place(firstFloret),
    ...otherFlorets.map(place),
  ];

  const anchorScale =
    florets.find(f => f.head === 0)?.scale ?? firstFloret.scale;
  const buds: BudPlan[] = stem
    ? generateBuds(parseBuds(raw), {
        axis,
        stemHalfWidth: stem.halfWidth,
        stemColor: stem.color,
        headReach: primaryHead.reach * anchorScale,
        shellColor: primaryHead.sepals[0]?.color ?? DEFAULT_SEPAL_COLOR,
        petalColor: baseColor,
      })
    : [];

  const particles = [
    ...generateParticleSeeds(effects.particles, sid),
    ...(parsed.center.pollen && STAGE_PROFILES[stage].throatOpen
      ? generatePollenSeeds(
          parsed.center.pollen,
          primaryHead.center.stamens,
          primaryHead.center.discRadius,
          sid,
        )
      : []),
  ];

  const allLeaves = [...leaves, ...domeLeaves, ...scaleBracts];
  const floretBounds = (f: PlacedFloret): Bounds =>
    circleBounds(
      f.offsetX,
      f.offsetY,
      (heads[f.head] ?? primaryHead).reach * f.scale,
    );
  const bounds = [
    ...florets.slice(1).map(floretBounds),
    cmdsBounds(stem?.cmds ?? []),
    ...(stem?.thorns.map(t => cmdsBounds(t.cmds)) ?? []),
    ...layout.branches.map(b => cmdsBounds(b.fill)),
    ...florets.map(f => cmdsBounds(f.stalk?.fill ?? [])),
    ...allLeaves.flatMap(l => [
      cmdsBounds(l.cmds),
      cmdsBounds(l.petiole?.fill ?? []),
    ]),
    ...buds.flatMap(b => [cmdsBounds(b.shell), cmdsBounds(b.pedicel)]),
  ].reduce(unionBounds, floretBounds(florets[0]));

  return {
    heads,
    stem,
    leaves: allLeaves,
    buds,
    aura: effects.aura,
    particles,
    florets,
    branches: layout.branches,
    bounds,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Arrangement rendering — multi-flower compositions with stems and leaves
// ═══════════════════════════════════════════════════════════════════════════

export type ArrangementMember = {
  flowerPlan: FlowerPlan;
  stem: StemPlan;
  leaves: readonly LeafPlan[];
  offsetX: number;
  offsetY: number;
  scale: number;
};

export type AdornmentPlan = {
  /** Main shape (wrap body, vase body, pedestal, etc.) */
  cmds: DrawCmd[];
  color: number;
  opacity: number;
  /** Optional accent detail (ribbon, bow, trim line) */
  accent?: { cmds: DrawCmd[]; color: number; opacity: number };
  /** Optional second accent (bow loops, vase rim, etc.) */
  detail?: { cmds: DrawCmd[]; color: number; opacity: number };
};

/** Pre-computed rendering plan for a multi-flower arrangement. */
export type ArrangementPlan = {
  members: readonly ArrangementMember[];
  adornment: AdornmentPlan | null;
};

// ── AI-driven adornment types ──

/** Metadata returned by the AI combine endpoint, stored as arrangement override. */
export type ArrangementMeta = {
  name?: string;
  adornments?: string[];
  sprite_hints?: {
    dominant_color?: string;
    secondary_color?: string;
    accent_style?: string;
  };
  harmony_note?: string;
  adornment_spec?: AdornmentSpec;
};

/** Structured adornment spec — AI picks the visual vocabulary. */
export type AdornmentSpec = {
  container: {
    type: "tie" | "wrap" | "basket" | "vase" | "urn";
    material:
      | "kraft"
      | "tissue"
      | "silk"
      | "ceramic"
      | "glass"
      | "wicker"
      | "metal";
    color: { r: number; g: number; b: number };
  };
  accent: {
    type: "ribbon" | "bow" | "twine" | "trim" | "band" | "none";
    color: { r: number; g: number; b: number };
  };
  base?: {
    type: "none" | "saucer" | "pedestal" | "plinth";
    color: { r: number; g: number; b: number };
  };
  mood: string;
  evolved_from?: string;
};

/** Parse raw JSON into ArrangementMeta, stripping adornment_spec if it
 *  fails structural validation (legacy records from before Output.object). */
export function parseArrangementMeta(
  raw_str: string,
): ArrangementMeta | undefined {
  try {
    const raw = parseYaml(raw_str) as ArrangementMeta;
    if (raw.adornment_spec) {
      const s = raw.adornment_spec;
      if (
        !s.container?.type ||
        !s.container.material ||
        !s.container.color ||
        !s.accent?.type ||
        !s.accent.color ||
        !s.mood
      ) {
        return { ...raw, adornment_spec: undefined };
      }
    }
    return raw;
  } catch {
    return undefined;
  }
}

// ── Stem/leaf spec parsing ──

type ParsedStem = {
  height: number;
  thickness: number;
  curvature: number;
  color: number;
  style: StemStyle;
  surface: SurfaceTexture;
};

/** The Rust `Stem` defaults; arrangements fall back to them when a member spec has no stem. */
const DEFAULT_STEM: ParsedStem = {
  height: 0.5,
  thickness: 0.3,
  curvature: 0,
  color: 0x2d5a27,
  style: STEM_STYLES[0],
  surface: SURFACE_TEXTURES[0],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseSpecStem(spec: any): ParsedStem | null {
  if (!spec) return null;
  try {
    const stem = spec.structure?.stem;
    if (!stem) return null;
    return {
      height: stem.height ?? DEFAULT_STEM.height,
      thickness: stem.thickness ?? DEFAULT_STEM.thickness,
      curvature: stem.curvature ?? DEFAULT_STEM.curvature,
      color: colorToHex(stem.color) ?? DEFAULT_STEM.color,
      style: variantOr(STEM_STYLES, stem.style),
      surface: variantOr(SURFACE_TEXTURES, stem.surface),
    };
  } catch {
    return null;
  }
}

/** One leaf, read from the Rust `Leaf` struct with its field names. */
type ParsedLeaf = {
  shape: LeafShape;
  size: number;
  color: number;
  serration: Serration;
  droop: number;
  curl: number;
  translucency: number;
  /** 0-1 along the stem */
  position: number;
  side: Side;
  /** radians */
  angleOffset: number;
  variegation: { kind: VariegationKind; color: number | null };
  veinPattern: VeinPattern;
};

type RawLeaf = {
  shape?: unknown;
  size?: number;
  color?: RawColor & RawColorGradient;
  serration?: unknown;
  droop?: number;
  curl?: number;
  translucency?: number;
  position?: number;
  side?: unknown;
  angle_offset?: number;
  variegation?: { kind?: unknown; color?: RawColor };
  vein_pattern?: unknown;
};

const DEFAULT_LEAF_COLOR = 0x3a7d32;
const MAX_LEAVES = 6;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseFoliage(spec: any): ParsedLeaf[] {
  if (!spec) return [];
  try {
    const rawLeaves: unknown = spec.foliage?.leaves;
    if (!Array.isArray(rawLeaves)) return [];
    return rawLeaves.slice(0, MAX_LEAVES).map((l: RawLeaf): ParsedLeaf => ({
      shape: variantOr(LEAF_SHAPES, l.shape),
      size: clamp(0.2, 1.0, l.size ?? 0.5),
      color: gradientOrPlainColorToHex(l.color) ?? DEFAULT_LEAF_COLOR,
      serration: variantOr(SERRATIONS, l.serration),
      droop: l.droop ?? 0,
      curl: l.curl ?? 0,
      translucency: l.translucency ?? 0.5,
      position: unitOr(l.position, 0.5),
      side: variantOr(SIDES, l.side),
      angleOffset: clamp(-0.3, 0.3, l.angle_offset ?? 0),
      variegation: {
        kind: variantOr(VARIEGATION_KINDS, l.variegation?.kind),
        color: colorToHex(l.variegation?.color),
      },
      veinPattern: variantOr(VEIN_PATTERNS, l.vein_pattern),
    }));
  } catch {
    return [];
  }
}

type RawBract = {
  color?: RawColor & RawColorGradient;
  size?: unknown;
  shape?: unknown;
  showy?: unknown;
  position?: unknown;
};

const MAX_BRACTS = 12;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseBracts(spec: any): BractSource[] {
  if (!spec) return [];
  try {
    const rawBracts: unknown = spec.foliage?.bracts;
    if (!Array.isArray(rawBracts)) return [];
    return rawBracts.slice(0, MAX_BRACTS).map((b: RawBract): BractSource => ({
      color: gradientOrPlainColorToHex(b.color),
      size: clamp(0, 1, finiteOr(b.size, 0.5)),
      shape: variantOr(LEAF_SHAPES, b.shape),
      showy: b.showy === true,
      position: clamp(0, 1, finiteOr(b.position, 0)),
    }));
  } catch {
    return [];
  }
}

type RawBud = {
  position?: unknown;
  side?: unknown;
  size?: unknown;
  openness?: unknown;
};

const MAX_BUDS = 6;

/** Rust `structure.buds[]`, with the Rust `Bud` defaults for missing fields. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseBuds(spec: any): BudSource[] {
  if (!spec) return [];
  try {
    const rawBuds: unknown = spec.structure?.buds;
    if (!Array.isArray(rawBuds)) return [];
    return rawBuds.slice(0, MAX_BUDS).map((b: RawBud): BudSource => ({
      position: unitOr(b.position, 0.5),
      side: variantOr(SIDES, b.side),
      size: unitOr(b.size, 0.3),
      openness: unitOr(b.openness, 0),
    }));
  } catch {
    return [];
  }
}

// ── Arrangement layout ──

type LayoutSlot = {
  offsetX: number;
  offsetY: number;
  stemAngle: number;
  scale: number;
  stemLength: number;
};

/** Compute flower positions for an arrangement level. Deterministic in `seed`. */
function layoutForLevel(
  count: number,
  level: number,
  seed: number,
): LayoutSlot[] {
  if (count <= 1) {
    // Single stem — straight down
    return [
      { offsetX: 0, offsetY: -0.7, stemAngle: 0, scale: 1.0, stemLength: 0.7 },
    ];
  }

  return Array.from({ length: count }, (_, i) => {
    const isHero = i === 0;

    if (level <= 2) {
      // Group (2-3): fan stems from shared base
      const spread = Math.PI * 0.35;
      const angleStep = count > 1 ? spread / (count - 1) : 0;
      const angle = -spread / 2 + i * angleStep;
      const stemLen = isHero ? 0.8 : 0.65;
      return {
        offsetX: Math.sin(angle) * stemLen * 0.7,
        offsetY: -stemLen * 0.85 + Math.abs(Math.sin(angle)) * 0.15,
        stemAngle: angle,
        scale: isHero ? 0.85 : 0.7,
        stemLength: stemLen,
      };
    }

    if (level <= 3) {
      // Bunch (4-6): wider fan
      const spread = Math.PI * 0.55;
      const angleStep = count > 1 ? spread / (count - 1) : 0;
      const angle = -spread / 2 + i * angleStep;
      const stemLen = isHero ? 0.8 : 0.55 + sidHash(seed, 900 + i) * 0.15;
      return {
        offsetX: Math.sin(angle) * stemLen * 0.6,
        offsetY: -stemLen * 0.8 + Math.abs(Math.sin(angle)) * 0.2,
        stemAngle: angle,
        scale: isHero ? 0.8 : 0.6 + (1 - Math.abs(angle) / (spread / 2)) * 0.1,
        stemLength: stemLen,
      };
    }

    // Arrangement / Bouquet / Centerpiece: golden-angle spiral
    const radius = isHero ? 0 : 0.2 + Math.sqrt(i / count) * 0.5;
    const theta = i * GOLDEN_ANGLE;
    const stemLen = isHero ? 0.85 : 0.55 + (1 - radius) * 0.2;
    return {
      offsetX: Math.cos(theta) * radius,
      offsetY: -stemLen * 0.75 + Math.sin(theta) * radius * 0.3,
      stemAngle: Math.cos(theta) * radius * 0.6,
      scale: isHero ? 0.8 : Math.max(0.45, 0.7 - radius * 0.35),
      stemLength: stemLen,
    };
  });
}

// ── Adornment generators ──
// Each returns DrawCmd[] in unit space, centered on x=0, anchored at baseY.

const WRAP_KRAFT = 0x8b7355; // warm kraft brown
const RIBBON_COLOR = 0xc4a882; // natural twine
const VASE_COLOR = 0x6b7b8d; // slate ceramic
const VASE_RIM = 0x8899a6; // lighter ceramic rim
const STAND_COLOR = 0x5a5a5a; // stone gray
const STAND_TOP = 0x707070; // lighter stone

/** Simple tie/band around stems — Group level (2-3 flowers). */
function generateTieAdornment(
  baseY: number,
  colors?: { main: number; accent: number },
): AdornmentPlan {
  const bandY = baseY - 0.18; // just above convergence point
  const bandH = 0.025;
  const bandW = 0.08;

  const cmds: DrawCmd[] = [
    { op: "M", x: -bandW, y: bandY - bandH },
    {
      op: "C",
      c1x: -bandW,
      c1y: bandY - bandH * 2,
      c2x: bandW,
      c2y: bandY - bandH * 2,
      x: bandW,
      y: bandY - bandH,
    },
    { op: "L", x: bandW, y: bandY + bandH },
    {
      op: "C",
      c1x: bandW,
      c1y: bandY + bandH * 2,
      c2x: -bandW,
      c2y: bandY + bandH * 2,
      x: -bandW,
      y: bandY + bandH,
    },
    { op: "Z" },
  ];

  // Small knot/bow center
  const knotR = 0.015;
  const accent: DrawCmd[] = [
    { op: "M", x: -knotR, y: bandY },
    {
      op: "C",
      c1x: -knotR,
      c1y: bandY - knotR * 2,
      c2x: knotR,
      c2y: bandY - knotR * 2,
      x: knotR,
      y: bandY,
    },
    {
      op: "C",
      c1x: knotR,
      c1y: bandY + knotR * 2,
      c2x: -knotR,
      c2y: bandY + knotR * 2,
      x: -knotR,
      y: bandY,
    },
    { op: "Z" },
  ];

  const mainColor = colors?.main ?? RIBBON_COLOR;
  const accentColor = colors?.accent ?? darkenColor(RIBBON_COLOR, 0.7);

  return {
    cmds,
    color: mainColor,
    opacity: 0.85,
    accent: { cmds: accent, color: accentColor, opacity: 0.9 },
  };
}

/** Paper wrap cone — Bunch level (4-6 flowers). */
function generateWrapAdornment(
  baseY: number,
  colors?: { main: number; accent: number },
): AdornmentPlan {
  const topY = baseY - 0.35; // wrap opens wide near the flower heads
  const botY = baseY + 0.05; // wraps slightly past the base
  const topW = 0.35; // wide opening
  const botW = 0.06; // narrow bottom point

  // Wrap body — tapered cone with curved edges
  const cmds: DrawCmd[] = [
    { op: "M", x: -topW, y: topY },
    {
      op: "C",
      c1x: -topW * 0.9,
      c1y: topY + (botY - topY) * 0.4,
      c2x: -botW * 1.5,
      c2y: botY - (botY - topY) * 0.2,
      x: -botW,
      y: botY,
    },
    {
      op: "C",
      c1x: -botW * 0.3,
      c1y: botY + 0.02,
      c2x: botW * 0.3,
      c2y: botY + 0.02,
      x: botW,
      y: botY,
    },
    {
      op: "C",
      c1x: botW * 1.5,
      c1y: botY - (botY - topY) * 0.2,
      c2x: topW * 0.9,
      c2y: topY + (botY - topY) * 0.4,
      x: topW,
      y: topY,
    },
    // Curved top edge (paper fold)
    {
      op: "C",
      c1x: topW * 0.7,
      c1y: topY - 0.03,
      c2x: -topW * 0.7,
      c2y: topY - 0.03,
      x: -topW,
      y: topY,
    },
    { op: "Z" },
  ];

  // Ribbon tie around the middle of the wrap
  const tieY = baseY - 0.1;
  const tieW = 0.12;
  const tieH = 0.018;
  const accent: DrawCmd[] = [
    { op: "M", x: -tieW, y: tieY - tieH },
    { op: "L", x: tieW, y: tieY - tieH },
    { op: "L", x: tieW, y: tieY + tieH },
    { op: "L", x: -tieW, y: tieY + tieH },
    { op: "Z" },
  ];

  const mainColor = colors?.main ?? WRAP_KRAFT;
  const accentColor = colors?.accent ?? RIBBON_COLOR;

  return {
    cmds,
    color: mainColor,
    opacity: 0.75,
    accent: { cmds: accent, color: accentColor, opacity: 0.85 },
  };
}

/** Vase — Arrangement/Bouquet level (7-19 flowers). */
function generateVaseAdornment(
  baseY: number,
  colors?: { main: number; accent: number },
): AdornmentPlan {
  const lipY = baseY - 0.3; // vase lip
  const neckY = baseY - 0.22; // narrow neck
  const bulgeY = baseY - 0.05; // widest body point
  const footY = baseY + 0.08; // vase foot
  const lipW = 0.16;
  const neckW = 0.1;
  const bulgeW = 0.22;
  const footW = 0.14;

  // Vase silhouette — left side down, bottom, right side up, lip
  const cmds: DrawCmd[] = [
    { op: "M", x: -lipW, y: lipY },
    // Neck narrows
    {
      op: "C",
      c1x: -lipW,
      c1y: lipY + 0.03,
      c2x: -neckW,
      c2y: neckY - 0.02,
      x: -neckW,
      y: neckY,
    },
    // Body bulges out
    {
      op: "C",
      c1x: -neckW * 1.1,
      c1y: neckY + (bulgeY - neckY) * 0.3,
      c2x: -bulgeW,
      c2y: bulgeY - (bulgeY - neckY) * 0.3,
      x: -bulgeW,
      y: bulgeY,
    },
    // Taper to foot
    {
      op: "C",
      c1x: -bulgeW,
      c1y: bulgeY + (footY - bulgeY) * 0.5,
      c2x: -footW,
      c2y: footY - 0.02,
      x: -footW,
      y: footY,
    },
    // Flat bottom
    { op: "L", x: footW, y: footY },
    // Right side up — foot to bulge
    {
      op: "C",
      c1x: footW,
      c1y: footY - 0.02,
      c2x: bulgeW,
      c2y: bulgeY + (footY - bulgeY) * 0.5,
      x: bulgeW,
      y: bulgeY,
    },
    // Bulge to neck
    {
      op: "C",
      c1x: bulgeW,
      c1y: bulgeY - (bulgeY - neckY) * 0.3,
      c2x: neckW * 1.1,
      c2y: neckY + (bulgeY - neckY) * 0.3,
      x: neckW,
      y: neckY,
    },
    // Neck to lip
    {
      op: "C",
      c1x: neckW,
      c1y: neckY - 0.02,
      c2x: lipW,
      c2y: lipY + 0.03,
      x: lipW,
      y: lipY,
    },
    // Lip top edge
    {
      op: "C",
      c1x: lipW * 0.5,
      c1y: lipY - 0.015,
      c2x: -lipW * 0.5,
      c2y: lipY - 0.015,
      x: -lipW,
      y: lipY,
    },
    { op: "Z" },
  ];

  // Rim highlight
  const rimH = 0.012;
  const accent: DrawCmd[] = [
    { op: "M", x: -lipW * 0.95, y: lipY },
    {
      op: "C",
      c1x: -lipW * 0.5,
      c1y: lipY - rimH,
      c2x: lipW * 0.5,
      c2y: lipY - rimH,
      x: lipW * 0.95,
      y: lipY,
    },
    {
      op: "C",
      c1x: lipW * 0.5,
      c1y: lipY + rimH,
      c2x: -lipW * 0.5,
      c2y: lipY + rimH,
      x: -lipW * 0.95,
      y: lipY,
    },
    { op: "Z" },
  ];

  // Foot base highlight
  const detail: DrawCmd[] = [
    { op: "M", x: -footW * 0.9, y: footY },
    { op: "L", x: footW * 0.9, y: footY },
    { op: "L", x: footW * 0.85, y: footY + 0.015 },
    { op: "L", x: -footW * 0.85, y: footY + 0.015 },
    { op: "Z" },
  ];

  const mainColor = colors?.main ?? VASE_COLOR;
  const rimColor = colors?.accent ?? VASE_RIM;

  return {
    cmds,
    color: mainColor,
    opacity: 0.8,
    accent: { cmds: accent, color: rimColor, opacity: 0.9 },
    detail: { cmds: detail, color: darkenColor(mainColor, 0.7), opacity: 0.7 },
  };
}

/** Pedestal/stand — Centerpiece+ level (20+ flowers). */
function generatePedestalAdornment(
  baseY: number,
  colors?: { main: number; accent: number },
): AdornmentPlan {
  // Pedestal sits below a vase shape
  const topY = baseY + 0.06; // top of pedestal (just under the vase foot)
  const midY = baseY + 0.18; // column midsection
  const baseTopY = baseY + 0.22; // base platform top
  const botY = baseY + 0.26; // very bottom
  const topW = 0.13;
  const colW = 0.08;
  const baseW = 0.2;

  // Pedestal — column on a wide base
  const cmds: DrawCmd[] = [
    // Top platform
    { op: "M", x: -topW, y: topY },
    { op: "L", x: topW, y: topY },
    { op: "L", x: topW, y: topY + 0.02 },
    // Column right side
    {
      op: "C",
      c1x: topW * 0.8,
      c1y: topY + 0.04,
      c2x: colW,
      c2y: midY - 0.02,
      x: colW,
      y: midY,
    },
    // Flare to base
    {
      op: "C",
      c1x: colW,
      c1y: midY + 0.02,
      c2x: baseW * 0.7,
      c2y: baseTopY - 0.01,
      x: baseW,
      y: baseTopY,
    },
    // Base bottom
    { op: "L", x: baseW, y: botY },
    { op: "L", x: -baseW, y: botY },
    { op: "L", x: -baseW, y: baseTopY },
    // Left flare up
    {
      op: "C",
      c1x: -baseW * 0.7,
      c1y: baseTopY - 0.01,
      c2x: -colW,
      c2y: midY + 0.02,
      x: -colW,
      y: midY,
    },
    // Left column up
    {
      op: "C",
      c1x: -colW,
      c1y: midY - 0.02,
      c2x: -topW * 0.8,
      c2y: topY + 0.04,
      x: -topW,
      y: topY + 0.02,
    },
    { op: "L", x: -topW, y: topY },
    { op: "Z" },
  ];

  // Top platform edge highlight
  const accent: DrawCmd[] = [
    { op: "M", x: -topW * 0.95, y: topY },
    { op: "L", x: topW * 0.95, y: topY },
    { op: "L", x: topW * 0.95, y: topY + 0.012 },
    { op: "L", x: -topW * 0.95, y: topY + 0.012 },
    { op: "Z" },
  ];

  const mainColor = colors?.main ?? STAND_COLOR;
  const topColor = colors?.accent ?? STAND_TOP;

  return {
    cmds,
    color: mainColor,
    opacity: 0.85,
    accent: { cmds: accent, color: topColor, opacity: 0.9 },
  };
}

// ── Material modifiers ──
// Each material adjusts opacity and color feel for the container.

const MATERIAL_MODIFIERS: Record<
  string,
  { opacityMul: number; colorAdjust: (c: number) => number }
> = {
  kraft: { opacityMul: 0.75, colorAdjust: c => desaturate(warmShift(c), 0.3) },
  tissue: { opacityMul: 0.45, colorAdjust: c => lightenColor(c, 0.25) },
  silk: { opacityMul: 0.85, colorAdjust: c => c },
  ceramic: { opacityMul: 0.8, colorAdjust: c => coolShift(desaturate(c, 0.4)) },
  glass: { opacityMul: 0.35, colorAdjust: c => lightenColor(c, 0.3) },
  wicker: { opacityMul: 0.8, colorAdjust: c => warmShift(desaturate(c, 0.5)) },
  metal: {
    opacityMul: 0.9,
    colorAdjust: c => darkenColor(desaturate(c, 0.6), 0.5),
  },
};

/** Basket — wider than wrap, woven look. */
function generateBasketAdornment(
  baseY: number,
  colors?: { main: number; accent: number },
): AdornmentPlan {
  const topY = baseY - 0.32;
  const botY = baseY + 0.06;
  const topW = 0.38;
  const botW = 0.18;
  const handleH = 0.12;

  // Basket body — wider, rounded bottom
  const cmds: DrawCmd[] = [
    { op: "M", x: -topW, y: topY },
    {
      op: "C",
      c1x: -topW * 0.95,
      c1y: topY + (botY - topY) * 0.3,
      c2x: -botW * 1.8,
      c2y: botY - (botY - topY) * 0.15,
      x: -botW,
      y: botY,
    },
    {
      op: "C",
      c1x: -botW * 0.5,
      c1y: botY + 0.03,
      c2x: botW * 0.5,
      c2y: botY + 0.03,
      x: botW,
      y: botY,
    },
    {
      op: "C",
      c1x: botW * 1.8,
      c1y: botY - (botY - topY) * 0.15,
      c2x: topW * 0.95,
      c2y: topY + (botY - topY) * 0.3,
      x: topW,
      y: topY,
    },
    { op: "L", x: -topW, y: topY },
    { op: "Z" },
  ];

  // Handle arch
  const accent: DrawCmd[] = [
    { op: "M", x: -topW * 0.7, y: topY },
    {
      op: "C",
      c1x: -topW * 0.6,
      c1y: topY - handleH,
      c2x: topW * 0.6,
      c2y: topY - handleH,
      x: topW * 0.7,
      y: topY,
    },
    {
      op: "C",
      c1x: topW * 0.55,
      c1y: topY - handleH + 0.025,
      c2x: -topW * 0.55,
      c2y: topY - handleH + 0.025,
      x: -topW * 0.7,
      y: topY,
    },
    { op: "Z" },
  ];

  const mainColor = colors?.main ?? warmShift(WRAP_KRAFT);
  const accentColor = colors?.accent ?? darkenColor(mainColor, 0.6);

  return {
    cmds,
    color: mainColor,
    opacity: 0.8,
    accent: { cmds: accent, color: accentColor, opacity: 0.75 },
  };
}

/** Urn — wide mouth, heavy body, grand presence. */
function generateUrnAdornment(
  baseY: number,
  colors?: { main: number; accent: number },
): AdornmentPlan {
  const lipY = baseY - 0.32;
  const neckY = baseY - 0.26;
  const bulgeY = baseY - 0.06;
  const footY = baseY + 0.1;
  const lipW = 0.22;
  const neckW = 0.14;
  const bulgeW = 0.28;
  const footW = 0.16;

  const cmds: DrawCmd[] = [
    { op: "M", x: -lipW, y: lipY },
    // Lip flare outward
    {
      op: "C",
      c1x: -lipW * 1.1,
      c1y: lipY + 0.02,
      c2x: -neckW * 0.9,
      c2y: neckY - 0.01,
      x: -neckW,
      y: neckY,
    },
    // Body bulges wide
    {
      op: "C",
      c1x: -neckW * 1.2,
      c1y: neckY + (bulgeY - neckY) * 0.25,
      c2x: -bulgeW * 1.05,
      c2y: bulgeY - (bulgeY - neckY) * 0.25,
      x: -bulgeW,
      y: bulgeY,
    },
    // Taper to foot
    {
      op: "C",
      c1x: -bulgeW,
      c1y: bulgeY + (footY - bulgeY) * 0.6,
      c2x: -footW * 1.1,
      c2y: footY - 0.02,
      x: -footW,
      y: footY,
    },
    // Flat bottom
    { op: "L", x: footW, y: footY },
    // Right side — mirror
    {
      op: "C",
      c1x: footW * 1.1,
      c1y: footY - 0.02,
      c2x: bulgeW,
      c2y: bulgeY + (footY - bulgeY) * 0.6,
      x: bulgeW,
      y: bulgeY,
    },
    {
      op: "C",
      c1x: bulgeW * 1.05,
      c1y: bulgeY - (bulgeY - neckY) * 0.25,
      c2x: neckW * 1.2,
      c2y: neckY + (bulgeY - neckY) * 0.25,
      x: neckW,
      y: neckY,
    },
    {
      op: "C",
      c1x: neckW * 0.9,
      c1y: neckY - 0.01,
      c2x: lipW * 1.1,
      c2y: lipY + 0.02,
      x: lipW,
      y: lipY,
    },
    // Lip top
    {
      op: "C",
      c1x: lipW * 0.6,
      c1y: lipY - 0.018,
      c2x: -lipW * 0.6,
      c2y: lipY - 0.018,
      x: -lipW,
      y: lipY,
    },
    { op: "Z" },
  ];

  // Wide rim
  const rimH = 0.015;
  const accent: DrawCmd[] = [
    { op: "M", x: -lipW * 0.95, y: lipY },
    {
      op: "C",
      c1x: -lipW * 0.5,
      c1y: lipY - rimH,
      c2x: lipW * 0.5,
      c2y: lipY - rimH,
      x: lipW * 0.95,
      y: lipY,
    },
    {
      op: "C",
      c1x: lipW * 0.5,
      c1y: lipY + rimH,
      c2x: -lipW * 0.5,
      c2y: lipY + rimH,
      x: -lipW * 0.95,
      y: lipY,
    },
    { op: "Z" },
  ];

  // Foot ring
  const detail: DrawCmd[] = [
    { op: "M", x: -footW * 0.9, y: footY },
    { op: "L", x: footW * 0.9, y: footY },
    { op: "L", x: footW * 0.85, y: footY + 0.018 },
    { op: "L", x: -footW * 0.85, y: footY + 0.018 },
    { op: "Z" },
  ];

  const mainColor = colors?.main ?? coolShift(VASE_COLOR);
  const rimColor = colors?.accent ?? lightenColor(mainColor, 0.15);

  return {
    cmds,
    color: mainColor,
    opacity: 0.85,
    accent: { cmds: accent, color: rimColor, opacity: 0.9 },
    detail: { cmds: detail, color: darkenColor(mainColor, 0.65), opacity: 0.7 },
  };
}

/** Parse a CSS hex color string to a number. */
function parseHexColor(hex: string): number | null {
  const clean = hex.replace(/^#/, "");
  const parsed = parseInt(clean, 16);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Extract adornment colors from arrangement metadata. */
function extractAdornmentColors(
  meta: ArrangementMeta | undefined,
): { main: number; accent: number } | undefined {
  if (!meta) return undefined;

  // Phase 2: structured spec colors take priority
  if (meta.adornment_spec) {
    const spec = meta.adornment_spec;
    if (spec.container?.color && spec.accent?.color) {
      const rawMain = rgbToNumber(spec.container.color);
      const materialMod = MATERIAL_MODIFIERS[spec.container.material];
      const main = materialMod ? materialMod.colorAdjust(rawMain) : rawMain;
      const accent = rgbToNumber(spec.accent.color);
      return { main, accent };
    }
  }

  // Phase 1 fallback: sprite_hints colors
  if (meta.sprite_hints?.dominant_color) {
    const main = parseHexColor(meta.sprite_hints.dominant_color);
    if (main === null) return undefined;
    const accent = meta.sprite_hints.secondary_color
      ? (parseHexColor(meta.sprite_hints.secondary_color) ??
        lightenColor(main, 0.15))
      : lightenColor(main, 0.15);
    return { main, accent };
  }

  return undefined;
}

/** Resolve material opacity multiplier from an AdornmentSpec. */
function resolveOpacityMul(spec: AdornmentSpec | undefined): number {
  if (!spec) return 1;
  return MATERIAL_MODIFIERS[spec.container.material]?.opacityMul ?? 1;
}

/** Apply material opacity to an adornment plan. */
function applyMaterialOpacity(
  plan: AdornmentPlan,
  opacityMul: number,
): AdornmentPlan {
  if (opacityMul === 1) return plan;
  return {
    ...plan,
    opacity: plan.opacity * opacityMul,
    accent: plan.accent
      ? { ...plan.accent, opacity: plan.accent.opacity * opacityMul }
      : undefined,
    detail: plan.detail
      ? { ...plan.detail, opacity: plan.detail.opacity * opacityMul }
      : undefined,
  };
}

type AdornmentGenerator = (
  baseY: number,
  colors?: { main: number; accent: number },
) => AdornmentPlan;

const CONTAINER_GENERATORS: Record<
  AdornmentSpec["container"]["type"],
  AdornmentGenerator
> = {
  tie: generateTieAdornment,
  wrap: generateWrapAdornment,
  basket: generateBasketAdornment,
  vase: generateVaseAdornment,
  urn: generateUrnAdornment,
};

/** Route to the correct shape generator based on AdornmentSpec container type. */
function generateAdornmentFromSpec(
  baseY: number,
  spec: AdornmentSpec,
): AdornmentPlan {
  const colors = extractAdornmentColors({ adornment_spec: spec });
  const opacityMul = resolveOpacityMul(spec);

  const gen =
    CONTAINER_GENERATORS[spec.container.type] ?? generateVaseAdornment;
  const plan = gen(baseY, colors);

  // Layer on a base if specified
  if (spec.base && spec.base.type !== "none" && spec.base.color) {
    const baseColor = rgbToNumber(spec.base.color);
    const baseColors = {
      main: baseColor,
      accent: lightenColor(baseColor, 0.1),
    };
    const basePlan = generatePedestalAdornment(baseY, baseColors);
    return applyMaterialOpacity(
      {
        cmds: basePlan.cmds,
        color: basePlan.color,
        opacity: basePlan.opacity,
        accent: { cmds: plan.cmds, color: plan.color, opacity: plan.opacity },
        detail: plan.accent,
      },
      opacityMul,
    );
  }

  return applyMaterialOpacity(plan, opacityMul);
}

/** Pick the right adornment for an arrangement level. */
function adornmentForLevel(
  level: number,
  baseY: number,
  colors?: { main: number; accent: number },
): AdornmentPlan | null {
  if (level <= 1) return null; // single stem — no adornment
  if (level <= 2) return generateTieAdornment(baseY, colors); // group (2-3)
  if (level <= 3) return generateWrapAdornment(baseY, colors); // bunch (4-6)
  if (level <= 5) return generateVaseAdornment(baseY, colors); // arrangement/bouquet (7-19)
  // centerpiece/installation (20+) — vase on a pedestal
  const vase = generateVaseAdornment(baseY, colors);
  const pedestal = generatePedestalAdornment(baseY, colors);
  return {
    cmds: pedestal.cmds,
    color: pedestal.color,
    opacity: pedestal.opacity,
    accent: { cmds: vase.cmds, color: vase.color, opacity: vase.opacity },
    detail: vase.accent,
  };
}

/** Create a complete arrangement plan from constituent flower specs. */
export function createArrangementPlan(
  constituents: ReadonlyArray<{ spec: string; sid: number }>,
  level: number,
  meta?: ArrangementMeta,
): ArrangementPlan {
  const count = constituents.length;
  const layoutSeed = constituents.reduce((sum, c) => sum + c.sid, 0);
  const slots = layoutForLevel(count, level, layoutSeed);
  const baseY = 0.9; // stems converge at this Y (below flower heads)

  const members: ArrangementMember[] = slots.map((slot, i) => {
    const { spec, sid } = constituents[Math.min(i, count - 1)]!;
    const raw = parseSpec(spec);
    const flowerPlan = createFlowerPlan(spec, sid);
    // The arrangement layout provides the structure, so a member without a
    // stem in its spec still gets the default one
    const stemData = parseSpecStem(raw) ?? DEFAULT_STEM;
    const firstLeaf = parseFoliage(raw)[0];
    const stemColor = plantStemColor(
      firstLeaf?.color ?? DEFAULT_LEAF_COLOR,
      stemData.color,
    );
    const stemCurvature = stemData.curvature + slot.stemAngle * 0.3;
    // Extend stem slightly past the head center so the tip overlaps into the
    // flower head, covering the BASE_OFFSET gap between center and petal ring.
    const dx = slot.offsetX - 0;
    const dy = slot.offsetY - baseY;
    const stemDist = Math.sqrt(dx * dx + dy * dy);
    const overshoot = 0.06; // push tip 6% of unit radius into the flower head
    const tipX =
      stemDist > 0.01
        ? slot.offsetX + (dx / stemDist) * overshoot
        : slot.offsetX;
    const tipY =
      stemDist > 0.01
        ? slot.offsetY + (dy / stemDist) * overshoot
        : slot.offsetY;
    const axis = stemAxis(
      [0, baseY],
      [tipX, tipY],
      stemCurvature,
      stemData.style,
    );
    const halfWidth = stemHalfWidth(stemDist, stemData.thickness);
    const stem = buildStemPlan(axis, halfWidth, stemColor, stemData, null, sid);

    // One leaf per arrangement stem, placed mid-stem, smaller to avoid overlap
    const leaves: LeafPlan[] = firstLeaf
      ? [firstLeaf].map(l => {
          // Place at 40-60% up the stem (avoid crowded base area)
          const pos = clamp(0.4, 0.6, l.position);
          const pt = stemPointAt(axis, pos);
          const blade = stemDist * LEAF_BLADE[1] * slot.scale;
          return buildLeafPlan(
            {
              x: pt.x,
              y: pt.y,
              angle: sideHeading(pt.angle, l.side, LEAF_RISE + l.angleOffset),
              blade,
              petiole: blade * LEAF_PETIOLE,
              stemHalfWidth: drawnHalfWidthAt(halfWidth, stemData.style, pos),
            },
            { ...l, color: leafBladeColor(l.color) },
            stemColor,
          );
        })
      : [];

    return {
      flowerPlan,
      stem,
      leaves,
      offsetX: slot.offsetX,
      offsetY: slot.offsetY,
      scale: slot.scale,
    };
  });

  // Phase 2: if AI provided a structured spec, use it directly
  // Phase 1: extract colors from meta and pass to level-gated generator
  const adornment = meta?.adornment_spec
    ? generateAdornmentFromSpec(baseY, meta.adornment_spec)
    : adornmentForLevel(level, baseY, extractAdornmentColors(meta));

  return { members, adornment };
}
