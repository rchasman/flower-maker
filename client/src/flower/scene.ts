/**
 * One flower on a pixi stage: the layers a plan draws into, the filters that
 * shade them, and the draw entry points the designer canvas, the zone
 * snapshot and the render harness share, so every surface shows the same
 * flower.
 *
 * The static layers are pictures: each is drawn into a detached Graphics,
 * filtered, rendered once into its own RenderTexture by `refresh`, and shown
 * as a Sprite. Per frame the stage composites sprites; no filter pass and no
 * tessellation runs for anything static. Pixi's own cacheAsTexture is not
 * used: in 8.21 a filter inside a cached container renders nothing when an
 * ancestor (the canvas dither) is filtered too.
 *
 * Layers, back to front: the aura's soft copy and its crisp core (per
 * frame), the back florets' picture, the plant's picture, the nectary pulse
 * and the bioluminescence pictures (additive, their level animated as
 * alpha), the particles (per frame).
 */

import {
  BlurFilter,
  Container,
  Graphics,
  GraphicsContext,
  RenderTexture,
  Sprite,
  type BLEND_MODES,
  type Renderer,
} from "pixi.js";
import {
  arrangementHeadLights,
  auraBloomStrength,
  glowBloomStrength,
  hasBackFlorets,
  headLights,
} from "./lighting.ts";
import {
  bioOf,
  bioWaveAt,
  drawArrangementFromPlan,
  drawAura,
  drawBioGlow,
  drawFlowerFromPlan,
  drawNectaryPulse,
  drawParticles,
  nectaryPulseLevel,
  nectaryPulseOf,
} from "./pixi-draw.ts";
import type { ArrangementPlan, FlowerPlan } from "./render.ts";
import { PlantLightFilter, createLightAnchor } from "./shaders/plantLight.ts";

export type FlowerScene = {
  /** position, rotation, scale and alpha go here; add it to the stage */
  root: Container;
  /** the plant's pictures, in the root's coordinates: the pointer target */
  flower: Container;
  /** clear and redraw everything static at radius r; nothing shows until `refresh` */
  draw(r: number): void;
  /** render every picture `draw` changed into its texture; call before the frame that shows it */
  refresh(renderer: Renderer): void;
  /** move the layers that change every frame: aura, particles, and the glow levels */
  tick(r: number): void;
  destroy(): void;
};

/** Bloom quality: passes of the gaussian on the soft copies. */
const BLOOM_QUALITY = 3;
const GLOW_BLOOM_ALPHA = 0.35;
const AURA_BLOOM_ALPHA = 0.6;
/** a pixel on every side of a picture, so antialiased edges are not cut */
const PICTURE_PAD = 1;

/**
 * A crisp Graphics and a blurred copy under it in one Container: both read
 * the same GraphicsContext, so whatever `core` draws the soft copy shows too.
 */
type BloomLayer = {
  layer: Container;
  core: Graphics;
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
  const layer = new Container();
  layer.addChild(bloom, core);
  return {
    layer,
    core,
    setRadius: r => {
      blur.strength = strengthAt(r);
    },
    destroy: () => {
      blur.destroy();
      context.destroy();
    },
  };
}

/**
 * A detached `source` rendered once into a texture that `view` shows on the
 * stage. `invalidate` after drawing into the source; the next `refresh`
 * renders it, sized to the source's bounds at the renderer's resolution.
 */
type Picture = {
  view: Sprite;
  invalidate(): void;
  refresh(renderer: Renderer): void;
  destroy(): void;
};

function createPicture(source: Container, blendMode: BLEND_MODES): Picture {
  const texture = RenderTexture.create({ width: 1, height: 1 });
  const view = new Sprite(texture);
  view.blendMode = blendMode;
  view.visible = false;
  let dirty = false;
  return {
    view,
    invalidate: () => {
      dirty = true;
    },
    refresh: renderer => {
      if (!dirty) return;
      dirty = false;
      const bounds = source.getLocalBounds().pad(PICTURE_PAD);
      bounds.ceil();
      view.visible = bounds.isPositive;
      if (!bounds.isPositive) return;
      texture.resize(bounds.width, bounds.height, renderer.resolution);
      source.position.set(-bounds.minX, -bounds.minY);
      renderer.render({
        container: source,
        target: texture,
        clear: true,
        clearColor: [0, 0, 0, 0],
      });
      view.position.set(bounds.minX, bounds.minY);
    },
    destroy: () => {
      source.destroy({ children: true });
      texture.destroy(true);
    },
  };
}

/** A Graphics shaded by a PlantLightFilter through its light anchor, as a picture. */
function createLitPlant(): {
  picture: Picture;
  graphics: Graphics;
  light: PlantLightFilter;
} {
  const anchor = createLightAnchor();
  const graphics = new Graphics();
  const light = new PlantLightFilter(anchor);
  graphics.filters = [light];
  const source = new Container();
  source.addChild(anchor, graphics);
  const picture = createPicture(source, "normal");
  return {
    picture,
    graphics,
    light,
  };
}

/**
 * An additive bloom layer as a picture; `setLevel` fades it, so a pulse
 * costs one sprite per frame instead of a tessellation and a blur pass.
 */
function createGlowPicture(): Picture &
  Pick<BloomLayer, "setRadius"> & {
    redraw(draw: (core: Graphics) => void): void;
    setLevel(level: number): void;
  } {
  const bloom = createBloomLayer("add", GLOW_BLOOM_ALPHA, glowBloomStrength);
  const picture = createPicture(bloom.layer, "add");
  return {
    ...picture,
    setRadius: r => bloom.setRadius(r),
    redraw: draw => {
      bloom.core.clear();
      draw(bloom.core);
      picture.invalidate();
    },
    setLevel: level => {
      picture.view.alpha = level;
    },
    destroy: () => {
      picture.destroy();
      bloom.destroy();
    },
  };
}

export function createFlowerScene(plan: FlowerPlan): FlowerScene {
  const root = new Container();
  const front = createLitPlant();

  const back = hasBackFlorets(plan) ? createLitPlant() : null;

  const aura = plan.aura
    ? createBloomLayer("normal", AURA_BLOOM_ALPHA, auraBloomStrength)
    : null;
  const bio = bioOf(plan);
  const bioGlow = bio ? createGlowPicture() : null;
  const pulse = nectaryPulseOf(plan);
  const pulseGlow = pulse ? createGlowPicture() : null;
  const particles = plan.particles.length > 0 ? new Graphics() : null;

  const plant = new Container();
  plant.addChild(...(back ? [back.picture.view] : []), front.picture.view);
  const effects = [
    ...(aura ? [aura.layer] : []),
    ...(pulseGlow ? [pulseGlow.view] : []),
    ...(bioGlow ? [bioGlow.view] : []),
    ...(particles ? [particles] : []),
  ];
  // Only the plant takes the pointer; a glow or a particle over it must not swallow the hit.
  effects.map(layer => {
    layer.eventMode = "none";
  });
  root.addChild(
    ...(aura ? [aura.layer] : []),
    plant,
    ...(pulseGlow ? [pulseGlow.view] : []),
    ...(bioGlow ? [bioGlow.view] : []),
    ...(particles ? [particles] : []),
  );

  const frontLayer = back ? "front" : "all";
  const pictures = [
    front.picture,
    ...(back ? [back.picture] : []),
    ...(bioGlow ? [bioGlow] : []),
    ...(pulseGlow ? [pulseGlow] : []),
  ];

  return {
    root,
    flower: plant,
    draw: r => {
      front.graphics.clear();
      drawFlowerFromPlan(front.graphics, plan, r, {
        particles: false,
        layer: frontLayer,
      });
      front.light.setHeads(headLights(plan, r, frontLayer));
      front.picture.invalidate();
      if (back) {
        back.graphics.clear();
        drawFlowerFromPlan(back.graphics, plan, r, {
          particles: false,
          layer: "back",
        });
        back.light.setHeads(headLights(plan, r, "back"));
        back.picture.invalidate();
      }
      aura?.setRadius(r);
      bioGlow?.setRadius(r);
      bioGlow?.redraw(core => drawBioGlow(core, plan, r));
      pulseGlow?.setRadius(r);
      pulseGlow?.redraw(core => drawNectaryPulse(core, plan, r));
    },
    refresh: renderer => pictures.map(picture => picture.refresh(renderer)),
    tick: r => {
      const now = performance.now();
      if (aura) {
        aura.core.clear();
        drawAura(aura.core, plan, r);
      }
      if (bio && bioGlow) bioGlow.setLevel(bioWaveAt(bio.pattern, now));
      if (pulse && pulseGlow) pulseGlow.setLevel(nectaryPulseLevel(pulse, now));
      if (particles) {
        particles.clear();
        drawParticles(particles, plan, r);
      }
    },
    destroy: () => {
      root.destroy({ children: true });
      pictures.map(picture => picture.destroy());
      front.light.destroy();
      back?.light.destroy();
      aura?.destroy();
    },
  };
}

/** An arrangement is one static picture: its members' front heads are what the light shades. */
export function createArrangementScene(plan: ArrangementPlan): FlowerScene {
  const root = new Container();
  const { picture, graphics, light } = createLitPlant();
  const plant = new Container();
  plant.addChild(picture.view);
  root.addChild(plant);
  return {
    root,
    flower: plant,
    draw: r => {
      graphics.clear();
      drawArrangementFromPlan(graphics, plan, r);
      light.setHeads(arrangementHeadLights(plan, r));
      picture.invalidate();
    },
    refresh: renderer => picture.refresh(renderer),
    tick: () => {},
    destroy: () => {
      root.destroy({ children: true });
      picture.destroy();
      light.destroy();
    },
  };
}
