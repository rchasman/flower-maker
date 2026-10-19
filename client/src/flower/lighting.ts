/**
 * Uniform derivation for the plant light shader and the depth layers: which
 * florets sit behind the plant, how strongly each head is shaded as a cup,
 * and how much light passes through its petals. Pure functions of a plan, so
 * the canvases, the snapshot renderer and the harness agree without a GPU.
 */

import type { LifeStage, SurfaceTexture } from "../data/flower-enums.ts";
import type {
  ArrangementPlan,
  FlowerPlan,
  HeadPlan,
  PlacedFloret,
} from "./render.ts";
import { clamp } from "./util.ts";

/** One head as the shader sees it, in the flower's local pixels at radius r. */
export type HeadLight = {
  x: number;
  y: number;
  radius: number;
  /** 0 flat, 1 a deep cup */
  strength: number;
};

/** The shader holds this many heads; a plan with more keeps its largest. */
export const MAX_LIT_HEADS = 48;

export type FloretLayer = "all" | "front" | "back";

/** Florets on the far half of the plant, drawn behind it and slightly out of focus. */
export const isBackFloret = (floret: PlacedFloret): boolean =>
  floret.depth > 0.5;

export const inLayer = (floret: PlacedFloret, layer: FloretLayer): boolean => {
  switch (layer) {
    case "all":
      return true;
    case "front":
      return !isBackFloret(floret);
    case "back":
      return isBackFloret(floret);
  }
};

export const hasBackFlorets = (plan: FlowerPlan): boolean =>
  plan.florets.some(isBackFloret);

/** A bloom is a full cup; a bud is a closed shell that barely turns; a seed head is nearly flat. */
const STAGE_STRENGTH: Record<LifeStage, number> = {
  Bud: 0.15,
  Opening: 0.25,
  Bloom: 0.35,
  Fading: 0.3,
  SeedHead: 0.1,
};

/** back heads are already darkened by the plan, so their shading is gentler */
const BACK_STRENGTH = 0.7;

export function volumeStrength(head: HeadPlan): number {
  const base = STAGE_STRENGTH[head.stage];
  return head.back ? base * BACK_STRENGTH : base;
}

/**
 * How a petal's surface takes light. `translucency`: how much passes through
 * a thin blade, before its opacity. `specular` and `shininess`: the strength
 * and tightness of the highlight. `sheen`: how much a pile of fine hairs
 * brightens the grazing rims and dulls the face, as velvet does.
 */
export type Material = {
  translucency: number;
  specular: number;
  shininess: number;
  sheen: number;
};

export const MATERIALS: Record<SurfaceTexture, Material> = {
  Papery: { translucency: 1, specular: 0.04, shininess: 8, sheen: 0 },
  Silk: { translucency: 1, specular: 0.22, shininess: 24, sheen: 0.15 },
  Glassy: { translucency: 1, specular: 0.55, shininess: 64, sheen: 0 },
  Crystalline: { translucency: 0.9, specular: 0.5, shininess: 80, sheen: 0 },
  Frosted: { translucency: 0.85, specular: 0.08, shininess: 6, sheen: 0.12 },
  Pearlescent: { translucency: 0.8, specular: 0.3, shininess: 20, sheen: 0.2 },
  Smooth: { translucency: 0.6, specular: 0.14, shininess: 16, sheen: 0 },
  Powdery: { translucency: 0.5, specular: 0.02, shininess: 4, sheen: 0.1 },
  Velvet: { translucency: 0.4, specular: 0, shininess: 1, sheen: 0.6 },
  Hairy: { translucency: 0.4, specular: 0.02, shininess: 4, sheen: 0.35 },
  Fuzzy: { translucency: 0.4, specular: 0.02, shininess: 4, sheen: 0.4 },
  Rough: { translucency: 0.35, specular: 0.03, shininess: 4, sheen: 0 },
  Scaled: { translucency: 0.3, specular: 0.2, shininess: 30, sheen: 0 },
  Waxy: { translucency: 0.2, specular: 0.4, shininess: 30, sheen: 0 },
  Leathery: { translucency: 0.15, specular: 0.12, shininess: 10, sheen: 0 },
  Metallic: { translucency: 0.1, specular: 0.65, shininess: 40, sheen: 0 },
};

/** the spec's opacity classes: 1 solid, 0.75 translucent, 0.5 glassy */
const GLASSY_OPACITY = 0.5;

/** How much light passes through a petal of this texture in a layer of this opacity class. */
export function petalTranslucency(
  texture: SurfaceTexture,
  opacity: number,
): number {
  const openness = clamp(0, 1, (1 - opacity) / (1 - GLASSY_OPACITY));
  return MATERIALS[texture].translucency * (0.35 + 0.65 * openness);
}

const headOf = (plan: FlowerPlan, floret: PlacedFloret): HeadPlan =>
  plan.heads[floret.head] ?? plan.heads[0];

/** The shader's largest heads first, so a crowded spike keeps the ones that show. */
const largestFirst = (lights: readonly HeadLight[]): HeadLight[] =>
  lights.toSorted((a, b) => b.radius - a.radius).slice(0, MAX_LIT_HEADS);

/** The heads of a flower's florets in `layer`, in local pixels at radius r. */
export function headLights(
  plan: FlowerPlan,
  r: number,
  layer: FloretLayer,
): HeadLight[] {
  return largestFirst(
    plan.florets
      .filter(floret => inLayer(floret, layer))
      .map(floret => {
        const head = headOf(plan, floret);
        return {
          x: floret.offsetX * r,
          y: floret.offsetY * r,
          radius: head.reach * floret.scale * r,
          strength: volumeStrength(head),
        };
      }),
  );
}

/** Every member's front head, in the arrangement's local pixels at radius r. */
export function arrangementHeadLights(
  plan: ArrangementPlan,
  r: number,
): HeadLight[] {
  return largestFirst(
    plan.members.map(member => {
      const head = member.flowerPlan.heads[0];
      return {
        x: member.offsetX * r,
        y: member.offsetY * r,
        radius: head.reach * member.scale * r,
        strength: volumeStrength(head),
      };
    }),
  );
}

/** the base radius the blur strengths below were tuned at */
const REFERENCE_RADIUS = 70;

/** The soft copy under the bioluminescence and nectary glow. */
export const glowBloomStrength = (r: number): number =>
  (5 * r) / REFERENCE_RADIUS;

/** The soft copy under the aura, which is already several head radii wide. */
export const auraBloomStrength = (r: number): number =>
  (10 * r) / REFERENCE_RADIUS;
