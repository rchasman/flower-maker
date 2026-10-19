import { describe, expect, test } from "bun:test";
import { gradientAt } from "../color.ts";
import { MATERIALS } from "../lighting.ts";
import { createPetalFrame } from "../petal.ts";
import { petalSurface } from "../surface.ts";
import {
  MAX_STOPS,
  createPetalMesh,
  freePetalMesh,
  shaderStops,
} from "./petalShade.ts";

/** pixi probes a WebGL context when it builds a GlProgram; with none it falls back to mediump. */
Object.assign(globalThis, {
  document: { createElement: () => ({ getContext: () => null }) },
});

const mesh = () =>
  createPetalMesh(
    petalSurface(
      createPetalFrame({
        angle: 0,
        shape: "Ovate",
        edge: "Ruffled",
        length: 1,
        width: 1,
        curvature: 0.3,
        curl: 0,
        seed: 0.4,
      }),
    ),
    {
      stops: [{ position: 0, color: 0xff0000 }],
      material: MATERIALS.Silk,
      translucency: 0.5,
      opacity: 1,
    },
  );

describe("petal mesh", () => {
  test("freeing a mesh destroys every GPU buffer it made, so redraws do not pile them up", () => {
    const petal = mesh();
    const buffers = [...petal.geometry.buffers];
    expect(buffers.length).toBeGreaterThanOrEqual(4);
    freePetalMesh(petal);
    expect(buffers.filter(buffer => !buffer.destroyed)).toEqual([]);
  });
});

describe("shaderStops", () => {
  test("a gradient that fits is passed through as it is", () => {
    const stops = [
      { position: 0, color: 0x112233 },
      { position: 0.9, color: 0x445566 },
    ];
    expect(shaderStops(stops)).toBe(stops);
  });

  test("a longer gradient is sampled evenly along the same colors", () => {
    const stops = Array.from({ length: 11 }, (_, i) => ({
      position: i / 10,
      color: i % 2 === 0 ? 0x000000 : 0xffffff,
    }));
    const sampled = shaderStops(stops);
    expect(sampled).toHaveLength(MAX_STOPS);
    expect(
      sampled.every(stop => stop.color === gradientAt(stops, stop.position)),
    ).toBe(true);
  });
});
