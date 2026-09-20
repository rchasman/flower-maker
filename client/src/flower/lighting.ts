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
  /** 0 opaque petals, 1 light pours through them */
  translucency: number;
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

/** How much light a material of this texture lets through, before its opacity. */
const TEXTURE_TRANSLUCENCY: Record<SurfaceTexture, number> = {
  Papery: 1,
  Silk: 1,
  Glassy: 1,
  Crystalline: 0.9,
  Frosted: 0.85,
  Pearlescent: 0.8,
  Smooth: 0.6,
  Powdery: 0.5,
  Velvet: 0.4,
  Hairy: 0.4,
  Fuzzy: 0.4,
  Rough: 0.35,
  Scaled: 0.3,
  Waxy: 0.2,
  Leathery: 0.15,
  Metallic: 0.1,
};

/** the spec's opacity classes: 1 solid, 0.75 translucent, 0.5 glassy */
const GLASSY_OPACITY = 0.5;

/** Translucency of the head's petals: the outer layer's texture, opened up by the thinnest layer's opacity class. */
export function translucencyOf(head: HeadPlan): number {
  const outer = head.layers[0];
  if (!outer) return 0;
  const petal = outer.petals[0] ?? outer.corolla?.lobes[0];
  const material = petal ? TEXTURE_TRANSLUCENCY[petal.texture] : 0;
  const thinnest = Math.min(...head.layers.map(layer => layer.opacity));
  const openness = clamp(0, 1, (1 - thinnest) / (1 - GLASSY_OPACITY));
  return material * (0.35 + 0.65 * openness);
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
          translucency: translucencyOf(head),
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
        translucency: translucencyOf(head),
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
