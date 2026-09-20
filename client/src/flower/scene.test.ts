import { describe, expect, test } from "bun:test";
import { BlurFilter, Filter } from "pixi.js";
import { createFlowerPlan } from "./render.ts";
import { createArrangementScene, createFlowerScene } from "./scene.ts";
import { PlantLightFilter, packHeadLights } from "./shaders/plantLight.ts";
import { MAX_LIT_HEADS } from "./lighting.ts";

const rgb = (r: number, g: number, b: number) => ({ r, g, b, a: 1 });

/**
 * pixi probes a WebGL context for the fragment precision when it builds a
 * GlProgram; bun has no DOM, and a canvas with no context falls back to
 * mediump, which is all these tests need.
 */
Object.assign(globalThis, {
  document: { createElement: () => ({ getContext: () => null }) },
});

function spec(extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    petals: {
      layers: [
        {
          count: 6,
          length: 1.2,
          width: 0.9,
          color: { stops: [{ position: 0, color: rgb(0.9, 0.3, 0.4) }] },
        },
      ],
    },
    reproductive: { stamens: [] },
    structure: { stem: { height: 0.8, thickness: 0.3 }, sepals: [] },
    ...extra,
  });
}

/** pixi stores a container's filters as one filter or a list; read them as a list. */
const filtersOf = (filters: unknown): readonly Filter[] => {
  if (filters instanceof Filter) return [filters];
  return Array.isArray(filters) ? filters : [];
};

describe("flower scene", () => {
  test("a solitary flower is one lit Graphics with no extra layers", () => {
    const scene = createFlowerScene(createFlowerPlan(spec(), 7));
    expect(scene.root.children).toHaveLength(2);
    expect(scene.root.children[1]).toBe(scene.flower);
    const [light] = filtersOf(scene.flower.filters);
    expect(light).toBeInstanceOf(PlantLightFilter);
    scene.draw(70, 1);
    expect(scene.flower.context.instructions.length).toBeGreaterThan(0);
    scene.destroy();
  });

  test("a spike adds a blurred back layer behind the plant, lit by its own filter", () => {
    const scene = createFlowerScene(
      createFlowerPlan(
        spec({ inflorescence: { kind: "Spike", head_count: 12 } }),
        7,
      ),
    );
    const flowerIdx = scene.root.getChildIndex(scene.flower);
    const back = scene.root.children[flowerIdx - 1]!;
    expect(back).not.toBe(scene.root.children[0]);
    const backFilters = filtersOf(back.filters);
    expect(backFilters[0]).toBeInstanceOf(PlantLightFilter);
    expect(backFilters[1]).toBeInstanceOf(BlurFilter);
    scene.draw(70, 1);
    const blur = backFilters[1];
    if (!(blur instanceof BlurFilter)) throw new Error("no back blur");
    expect(blur.strength).toBeCloseTo(0.5, 6);
    scene.draw(140, 1);
    expect(blur.strength).toBeCloseTo(1, 6);
    scene.destroy();
  });

  test("an aura and a glow each get a soft copy under a crisp core, the glow additive", () => {
    const scene = createFlowerScene(
      createFlowerPlan(
        spec({
          aura: { kind: "Mist", color: rgb(0.5, 0.6, 1), opacity: 0.3 },
          ornamentation: {
            bioluminescence: {
              pattern: "Edges",
              color: rgb(0.3, 1, 0.8),
              intensity: 0.8,
            },
          },
        }),
        7,
      ),
    );
    const children = scene.root.children;
    const flowerIdx = children.indexOf(scene.flower);
    const [auraBloom, auraCore] = children.slice(flowerIdx - 2, flowerIdx);
    const [glowBloom, glowCore] = children.slice(flowerIdx + 1, flowerIdx + 3);
    expect(filtersOf(auraBloom!.filters)[0]).toBeInstanceOf(BlurFilter);
    expect(filtersOf(auraCore!.filters)).toHaveLength(0);
    expect(filtersOf(glowBloom!.filters)[0]).toBeInstanceOf(BlurFilter);
    expect(glowBloom!.blendMode).toBe("add");
    expect(glowCore!.blendMode).toBe("add");
    expect(glowBloom!.alpha).toBeLessThan(1);
    scene.draw(70, 1);
    scene.tick(70, 1);
    scene.destroy();
  });

  test("an arrangement is one lit Graphics", () => {
    const scene = createArrangementScene({
      members: [],
      adornment: null,
    });
    expect(filtersOf(scene.flower.filters)[0]).toBeInstanceOf(PlantLightFilter);
    scene.destroy();
  });
});

describe("packHeadLights", () => {
  test("packs centre, radius and strength, then translucency, and caps at the shader size", () => {
    const light = { x: 1, y: 2, radius: 3, strength: 0.4, translucency: 0.5 };
    const packed = packHeadLights([light]);
    Array.from(packed.heads.slice(0, 4)).map((v, i) =>
      expect(v).toBeCloseTo([1, 2, 3, 0.4][i]!, 6),
    );
    expect(packed.fx[0]).toBe(0.5);
    expect(packed.count).toBe(1);
    expect(packed.heads).toHaveLength(MAX_LIT_HEADS * 4);
    const many = packHeadLights(Array.from({ length: 100 }, () => light));
    expect(many.count).toBe(MAX_LIT_HEADS);
  });
});
