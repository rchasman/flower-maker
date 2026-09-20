import { describe, expect, test } from "bun:test";
import { BlurFilter, Filter, Graphics, Sprite } from "pixi.js";
import { bioWaveAt } from "./pixi-draw.ts";
import { createFlowerPlan } from "./render.ts";
import { createArrangementScene, createFlowerScene } from "./scene.ts";
import { packHeadLights } from "./shaders/plantLight.ts";
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
  test("a solitary flower is one plant holding one picture, with no extra layers", () => {
    const scene = createFlowerScene(createFlowerPlan(spec(), 7));
    expect(scene.root.children).toEqual([scene.flower]);
    expect(scene.flower.children).toHaveLength(1);
    const [picture] = scene.flower.children;
    expect(picture).toBeInstanceOf(Sprite);
    expect(picture!.visible).toBe(false);
    scene.draw(70);
    scene.destroy();
  });

  test("a spike adds a back picture behind the plant's, inside the same pointer target", () => {
    const scene = createFlowerScene(
      createFlowerPlan(
        spec({ inflorescence: { kind: "Spike", head_count: 12 } }),
        7,
      ),
    );
    expect(scene.root.children).toEqual([scene.flower]);
    expect(scene.flower.children).toHaveLength(2);
    expect(scene.flower.children[0]).toBeInstanceOf(Sprite);
    expect(scene.flower.children[1]).toBeInstanceOf(Sprite);
    scene.draw(70);
    scene.destroy();
  });

  test("an aura is a blurred pair redrawn per frame; the glow is an additive picture that pulses through its alpha", () => {
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
    const plantIdx = children.indexOf(scene.flower);
    const aura = children[plantIdx - 1]!;
    const glow = children[plantIdx + 1]!;
    const [auraBloom, auraCore] = aura.children;
    expect(filtersOf(auraBloom!.filters)[0]).toBeInstanceOf(BlurFilter);
    expect(filtersOf(auraCore!.filters)).toHaveLength(0);
    expect(glow).toBeInstanceOf(Sprite);
    expect(glow.blendMode).toBe("add");
    expect(glow.eventMode).toBe("none");
    expect(aura.eventMode).toBe("none");
    scene.draw(70);
    scene.tick(70);
    expect(glow.alpha).toBeCloseTo(bioWaveAt("Edges", performance.now()), 2);
    if (!(auraCore instanceof Graphics))
      throw new Error("aura core is not a Graphics");
    expect(auraCore.context.instructions.length).toBeGreaterThan(0);
    scene.destroy();
  });

  test("an arrangement is one plant holding one picture", () => {
    const scene = createArrangementScene({
      members: [],
      adornment: null,
    });
    expect(scene.root.children).toEqual([scene.flower]);
    expect(scene.flower.children).toHaveLength(1);
    expect(scene.flower.children[0]).toBeInstanceOf(Sprite);
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
