/**
 * One flower on a pixi stage: the layers a plan draws into, the filters that
 * shade them, and the two draw entry points the designer canvas, the zone
 * snapshot and the render harness share, so every surface shows the same
 * flower.
 *
 * Layers, back to front: the aura's soft copy and its crisp core (per
 * frame), the back florets, the plant, the glow's soft copy and
 * its crisp core (additive, per frame), the particles (per frame).
 */

import {
  BlurFilter,
  Container,
  Graphics,
  GraphicsContext,
  type BLEND_MODES,
  type Filter,
} from "pixi.js";
import {
  arrangementHeadLights,
  auraBloomStrength,
  glowBloomStrength,
  hasBackFlorets,
  headLights,
} from "./lighting.ts";
import {
  drawArrangementFromPlan,
  drawAura,
  drawFlowerFromPlan,
  drawGlow,
  drawParticles,
  hasGlow,
} from "./pixi-draw.ts";
import type { ArrangementPlan, FlowerPlan } from "./render.ts";
import { PlantLightFilter, createLightAnchor } from "./shaders/plantLight.ts";

export type FlowerScene = {
  /** position, rotation and scale go here; add it to the stage */
  root: Container;
  /** the plant itself: the pointer target, and where extra filters go */
  flower: Graphics;
  /** clear and redraw everything static at radius r */
  draw(r: number, alpha: number): void;
  /** redraw the layers that move every frame: aura, glow, particles */
  tick(r: number, alpha: number): void;
  destroy(): void;
};

/** Bloom quality: passes of the gaussian on the soft copies. */
const BLOOM_QUALITY = 3;
const GLOW_BLOOM_ALPHA = 0.35;
const AURA_BLOOM_ALPHA = 0.6;

/**
 * A crisp Graphics and a blurred copy under it, drawn once: both read the
 * same GraphicsContext, so whatever `core` draws the soft copy shows too.
 */
type BloomLayer = {
  core: Graphics;
  children: readonly Graphics[];
  setRadius(r: number): void;
  destroy(): void;
};

function createBloomLayer(
  blendMode: BLEND_MODES,
  bloomAlpha: number,
  strengthAt: (r: number) => number,
): BloomLayer {
  const context = new GraphicsContext();
  const core = new Graphics({ context });
  core.blendMode = blendMode;
  const bloom = new Graphics({ context });
  bloom.blendMode = blendMode;
  bloom.alpha = bloomAlpha;
  const blur = new BlurFilter({
    strength: strengthAt(70),
    quality: BLOOM_QUALITY,
  });
  bloom.filters = [blur];
  return {
    core,
    children: [bloom, core],
    setRadius: r => {
      blur.strength = strengthAt(r);
    },
    destroy: () => {
      blur.destroy();
      context.destroy();
    },
  };
}

function destroyAll(root: Container, filters: readonly Filter[]): void {
  root.destroy({ children: true });
  filters.map(filter => filter.destroy());
}

export function createFlowerScene(plan: FlowerPlan): FlowerScene {
  const root = new Container();
  const anchor = createLightAnchor();
  const flower = new Graphics();
  const light = new PlantLightFilter(anchor);
  flower.filters = [light];

  const back = hasBackFlorets(plan)
    ? {
        graphics: new Graphics(),
        light: new PlantLightFilter(anchor),
      }
    : null;
  if (back) back.graphics.filters = [back.light];

  const aura = plan.aura
    ? createBloomLayer("normal", AURA_BLOOM_ALPHA, auraBloomStrength)
    : null;
  const glow = hasGlow(plan)
    ? createBloomLayer("add", GLOW_BLOOM_ALPHA, glowBloomStrength)
    : null;
  const particles = plan.particles.length > 0 ? new Graphics() : null;

  root.addChild(
    anchor,
    ...(aura?.children ?? []),
    ...(back ? [back.graphics] : []),
    flower,
    ...(glow?.children ?? []),
    ...(particles ? [particles] : []),
  );

  const frontLayer = back ? "front" : "all";

  return {
    root,
    flower,
    draw: (r, alpha) => {
      flower.clear();
      drawFlowerFromPlan(flower, plan, r, alpha, {
        particles: false,
        layer: frontLayer,
      });
      light.setHeads(headLights(plan, r, frontLayer));
      if (back) {
        back.graphics.clear();
        drawFlowerFromPlan(back.graphics, plan, r, alpha, {
          particles: false,
          layer: "back",
        });
        back.light.setHeads(headLights(plan, r, "back"));
      }
      aura?.setRadius(r);
      glow?.setRadius(r);
    },
    tick: (r, alpha) => {
      if (aura) {
        aura.core.clear();
        drawAura(aura.core, plan, r, alpha);
      }
      if (glow) {
        glow.core.clear();
        drawGlow(glow.core, plan, r, alpha);
      }
      if (particles) {
        particles.clear();
        drawParticles(particles, plan, r, alpha);
      }
    },
    destroy: () => {
      destroyAll(root, [light, ...(back ? [back.light] : [])]);
      aura?.destroy();
      glow?.destroy();
    },
  };
}

/** An arrangement is one static Graphics: its members' front heads are what the light shades. */
export function createArrangementScene(plan: ArrangementPlan): FlowerScene {
  const root = new Container();
  const anchor = createLightAnchor();
  const flower = new Graphics();
  const light = new PlantLightFilter(anchor);
  flower.filters = [light];
  root.addChild(anchor, flower);
  return {
    root,
    flower,
    draw: (r, alpha) => {
      flower.clear();
      drawArrangementFromPlan(flower, plan, r, alpha);
      light.setHeads(arrangementHeadLights(plan, r));
    },
    tick: () => {},
    destroy: () => destroyAll(root, [light]),
  };
}
