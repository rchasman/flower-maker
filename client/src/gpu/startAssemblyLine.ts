import { clock, effect, frameLoop, sampler, surface } from "vgpu";
import lineShader from "./line.wgsl";
import { getGpu } from "./gpu.ts";
import { loadImageTexture, type ImageTexture } from "./imageTexture.ts";
import { trackPointer } from "./pointerTrail.ts";
import { createTrail } from "./trail.ts";
import { artUrl, type Plate } from "../landing/plates.ts";
import {
  beltTravel,
  SPRITE_COUNT,
  type SpriteTransform,
} from "../landing/timeline.ts";

const REVEAL_SECONDS = 2;
const PIXEL = 2;
const CONTRAST = 1.15;

type Vec4 = readonly [number, number, number, number];

/**
 * Mirrors `Sprite` in line.wgsl: place = centre + pivot, shape = angle, scale, aspect, visible,
 * tone = exposure + texture index, cutA and cutB = half-planes in plate uv.
 */
export interface SpriteUniform {
  readonly place: Vec4;
  readonly shape: Vec4;
  readonly tone: Vec4;
  readonly cutA: Vec4;
  readonly cutB: Vec4;
}

const HIDDEN: SpriteUniform = {
  place: [0, 0, 0, 0],
  shape: [0, 1, 1, 0],
  tone: [0, 0, 0, 0],
  cutA: [0, 0, 0, 0],
  cutB: [0, 0, 0, 0],
};

/** Pairs each timeline sprite with its plate's exposure and image aspect, padded to the shader's array. */
export const spriteUniforms = (
  plates: readonly Plate[],
  aspects: readonly number[],
  transforms: readonly SpriteTransform[],
): readonly SpriteUniform[] => {
  const filled = transforms.map((t): SpriteUniform => ({
    place: [t.x, t.y, t.pivot[0], t.pivot[1]],
    shape: [t.angle, t.scale, aspects[t.tex] ?? 1, t.visible],
    tone: [plates[t.tex]?.exposure ?? 1, t.tex, 0, 0],
    cutA: [
      t.cutA.point[0],
      t.cutA.point[1],
      t.cutA.normal[0],
      t.cutA.normal[1],
    ],
    cutB: [
      t.cutB.point[0],
      t.cutB.point[1],
      t.cutB.normal[0],
      t.cutB.normal[1],
    ],
  }));
  return [
    ...filled,
    ...Array.from(
      { length: Math.max(0, SPRITE_COUNT - filled.length) },
      () => HIDDEN,
    ),
  ];
};

const textureBindings = (
  images: readonly ImageTexture[],
): Record<string, unknown> =>
  Object.fromEntries(images.map((image, i) => [`tex${i}`, image.texture]));

export interface AssemblyLineHandle {
  /** Resolves once the first frame can draw; rejects when WebGPU or a plate is unavailable. */
  readonly ready: Promise<void>;
  /** Stops the loop and frees the canvas. Safe to call before `ready` settles. */
  stop(): void;
}

/**
 * Draws the animated assembly line onto `canvas`. The canvas ignores pointer events, so the
 * pointer is tracked on the window and mapped in. Returns synchronously so a caller that
 * unmounts before the plates finish loading can still stop it and free the canvas.
 */
export const startAssemblyLine = (
  canvas: HTMLCanvasElement,
  plates: readonly Plate[],
  timeline: (t: number, frameAspect: number) => readonly SpriteTransform[],
): AssemblyLineHandle => {
  let stopped = false;
  let release = () => {};

  const ready = (async () => {
    const gpu = await getGpu();
    if (stopped) return;
    const images = await Promise.all(
      plates.map(plate => loadImageTexture(gpu, artUrl(plate.id))),
    );
    if (stopped) {
      images.map(image => image.texture.destroy());
      return;
    }

    const aspects = images.map(image => image.aspect);
    const canvasSurface = surface(gpu, canvas, { dpr: [1, 2] });
    const pointer = trackPointer(canvas, window);
    const trail = createTrail(gpu);
    const linear = sampler(gpu, { magFilter: "linear", minFilter: "linear" });

    const params = (reveal: number, time: number) => ({
      pixel: PIXEL,
      reveal,
      contrast: CONTRAST,
      travel: beltTravel(time),
      resolution: canvasSurface.size,
    });

    const line = effect(gpu, lineShader, {
      label: "assembly-line",
      set: {
        params: params(0, 0),
        sprites: spriteUniforms(plates, aspects, timeline(0, 1)),
        ...textureBindings(images),
        samp: linear,
        trail: trail.texture(),
      },
    });

    const time = clock(gpu);
    const startedAt = time.time;
    const loop = frameLoop(gpu, frame => {
      const sample = pointer.sample();
      const [width, height] = canvasSurface.size;
      trail.advance(frame, sample, width / height);
      const elapsed = time.time - startedAt;
      line.set({
        params: params(Math.min(1, elapsed / REVEAL_SECONDS), elapsed),
        sprites: spriteUniforms(
          plates,
          aspects,
          timeline(elapsed, width / height),
        ),
        trail: trail.texture(),
      });
      frame.pass(canvasSurface, line);
      trail.swap();
    });

    release = () => {
      pointer.dispose();
      loop.stop();
      canvasSurface.dispose();
      images.map(image => image.texture.destroy());
    };
  })();

  return {
    ready,
    stop: () => {
      stopped = true;
      release();
    },
  };
};
