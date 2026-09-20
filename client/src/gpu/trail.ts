import {
  effect,
  pingPong,
  sampler,
  type Frame,
  type Gpu,
  type Target,
} from "vgpu";
import trailShader from "./trail.wgsl";

const SIZE = 384;
const DECAY = 0.965;
const RADIUS_AT_REST = 0.06;
const RADIUS_PER_SPEED = 1.2;
const RADIUS_MAX = 0.32;
const STRENGTH_AT_REST = 0.35;
const STRENGTH_PER_SPEED = 12;

export interface PointerFrame {
  readonly uv: readonly [number, number];
  readonly prevUv: readonly [number, number];
  readonly speed: number;
  readonly inside: boolean;
}

// A low-resolution ping-pong buffer that accumulates the pointer's path and dissolves it.
// Call `advance` inside the frame loop before the pass that samples `texture`.
export const createTrail = (gpu: Gpu) => {
  const pair = pingPong(gpu, SIZE, SIZE, { format: "rgba8unorm" });
  const linear = sampler(gpu, { magFilter: "linear", minFilter: "linear" });
  const paint = effect(gpu, trailShader, {
    label: "trail",
    set: {
      params: {
        head: [0.5, 0.5],
        prevHead: [0.5, 0.5],
        texel: [1 / SIZE, 1 / SIZE],
        aspect: 1,
        radius: 0,
        strength: 0,
        decay: DECAY,
      },
      prev: pair.read,
      samp: linear,
    },
  });

  return {
    sampler: linear,
    // The target that holds this frame's trail once `advance` has recorded its pass.
    texture: (): Target => pair.write,
    advance: (frame: Frame, pointer: PointerFrame, aspect: number) => {
      const radius = Math.min(
        RADIUS_MAX,
        RADIUS_AT_REST + pointer.speed * RADIUS_PER_SPEED,
      );
      const strength = pointer.inside
        ? Math.min(1, STRENGTH_AT_REST + pointer.speed * STRENGTH_PER_SPEED)
        : 0;
      paint.set({
        params: {
          head: pointer.uv,
          prevHead: pointer.prevUv,
          aspect,
          radius,
          strength,
        },
        prev: pair.read,
      });
      frame.pass(pair.write, paint);
    },
    swap: () => pair.swap(),
  };
};
