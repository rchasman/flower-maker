import { describe, expect, test } from "bun:test";
import { FUSION_KINDS } from "../data/flower-enums.ts";
import {
  corollaProfile,
  generateCorolla,
  isFused,
  type CorollaLayer,
  type FusedKind,
} from "./corolla.ts";
import { createPetalFrame, petalLocalToFlower } from "./petal.ts";
import { createFlowerPlan } from "./render.ts";
import { flattenCmds } from "./test-helpers.ts";

const FUSED_KINDS = FUSION_KINDS.filter(isFused);

const LAYER: CorollaLayer = {
  shape: "Ovate",
  edge: "Smooth",
  length: 1.2,
  width: 1,
  curvature: 0.1,
  curl: 0,
  color: 0xcc4488,
};

const referenceFrame = (angle = 0.4) =>
  createPetalFrame({
    angle,
    shape: LAYER.shape,
    edge: LAYER.edge,
    length: LAYER.length,
    width: LAYER.width,
    curvature: LAYER.curvature,
    curl: LAYER.curl,
    seed: 0.5,
  });

const corolla = (kind: FusedKind, count = 5, depth = 0.5, seed = 0.42) =>
  generateCorolla(LAYER, referenceFrame(), kind, depth, count, seed);

const SAMPLES = Array.from({ length: 33 }, (_, i) => i / 32);

const profileSamples = (kind: FusedKind) =>
  SAMPLES.map(s => corollaProfile(kind, s));

const argmax = (values: number[]) =>
  values.reduce((best, v, i) => (v > values[best]! ? i : best), 0);

const norm = ([x, y]: readonly [number, number]) => Math.hypot(x, y);

describe("corollaProfile", () => {
  test("Bell is widest before the rim and curves in", () => {
    const values = profileSamples("Bell");
    const peak = argmax(values);
    expect(peak).toBeGreaterThan(0);
    expect(peak).toBeLessThan(values.length - 1);
    expect(values.at(-1)!).toBeLessThan(values[peak]!);
  });

  test("Trumpet widens all the way to the rim", () => {
    const values = profileSamples("Trumpet");
    expect(argmax(values)).toBe(values.length - 1);
    const increasing = values.slice(1).every((v, i) => v > values[i]!);
    expect(increasing).toBe(true);
  });

  test("Urn bulges in the middle and the rim is narrower than the bulge", () => {
    const values = profileSamples("Urn");
    const peakS = SAMPLES[argmax(values)]!;
    expect(peakS).toBeGreaterThan(0.3);
    expect(peakS).toBeLessThan(0.7);
    expect(values.at(-1)!).toBeLessThan(Math.max(...values) * 0.8);
  });

  test("Funnel widens monotonically", () => {
    const values = profileSamples("Funnel");
    const monotonic = values.slice(1).every((v, i) => v >= values[i]!);
    expect(monotonic).toBe(true);
    expect(values.at(-1)!).toBe(Math.max(...values));
  });

  test("Tube stays narrow", () => {
    expect(Math.max(...profileSamples("Tube"))).toBeLessThanOrEqual(0.35);
  });

  test("every kind reaches inside (0, 1]", () => {
    for (const kind of FUSED_KINDS) {
      const values = profileSamples(kind);
      expect(Math.min(...values)).toBeGreaterThan(0);
      expect(Math.max(...values)).toBeLessThanOrEqual(1);
    }
  });
});

describe("generateCorolla", () => {
  for (const kind of FUSED_KINDS) {
    test(`${kind}: the body is one closed loop around the head`, () => {
      const { body, bodyRadius } = corolla(kind);
      expect(body[0]!.op).toBe("M");
      expect(body.at(-1)!.op).toBe("Z");
      const radii = flattenCmds(body).map(norm);
      expect(Math.max(...radii)).toBeCloseTo(bodyRadius, 6);
      expect(Math.min(...radii)).toBeGreaterThan(bodyRadius * 0.85);
    });

    test(`${kind}: lobe count equals count`, () => {
      for (const count of [1, 3, 5, 8]) {
        expect(corolla(kind, count).lobes.length).toBe(count);
      }
    });

    test(`${kind}: lobes start on the rim, evenly spaced from the reference angle`, () => {
      const { lobes, rimRadius } = corolla(kind, 6);
      for (const [i, lobe] of lobes.entries()) {
        expect(norm(petalLocalToFlower(0, 0, lobe.frame))).toBeCloseTo(
          rimRadius,
          9,
        );
        expect(lobe.angle).toBeCloseTo(0.4 + (i / 6) * Math.PI * 2, 9);
        expect(lobe.cmds.length).toBeGreaterThan(3);
      }
    });

    test(`${kind}: throat sits inside the rim, rim inside the body`, () => {
      const { throat, rimRadius, bodyRadius } = corolla(kind);
      expect(throat.radius).toBeGreaterThan(0);
      expect(throat.radius).toBeLessThan(rimRadius);
      expect(rimRadius).toBeLessThanOrEqual(bodyRadius);
      expect(throat.innerColor).not.toBe(throat.rimColor);
    });

    test(`${kind}: is deterministic and moves with the seed`, () => {
      expect(corolla(kind)).toEqual(corolla(kind));
      expect(corolla(kind, 5, 0.5, 0.42).lobes).not.toEqual(
        corolla(kind, 5, 0.5, 0.77).lobes,
      );
    });
  }

  test("kinds widest at the rim open to the body silhouette, the others keep the rim inside it", () => {
    const rimIsBody = (kind: FusedKind) => {
      const { rimRadius, bodyRadius } = corolla(kind);
      return Math.abs(rimRadius - bodyRadius) < 1e-9;
    };
    expect(FUSED_KINDS.filter(rimIsBody)).toEqual([
      "Trumpet",
      "Funnel",
      "Tube",
    ]);
  });

  test("a deeper fusion grows the body and shrinks the lobes", () => {
    const shallow = corolla("Trumpet", 5, 0.2);
    const deep = corolla("Trumpet", 5, 0.8);
    expect(deep.bodyRadius).toBeGreaterThan(shallow.bodyRadius);
    const lobeReach = ({ lobes }: typeof shallow) =>
      norm(petalLocalToFlower(1, 0, lobes[0]!.frame)) -
      norm(petalLocalToFlower(0, 0, lobes[0]!.frame));
    expect(lobeReach(deep)).toBeLessThan(lobeReach(shallow));
  });
});

describe("createFlowerPlan fusion", () => {
  const spec = (
    layer: Record<string, unknown>,
    extra: Record<string, unknown> = {},
  ) =>
    JSON.stringify({
      petals: { layers: [{ count: 5, length: 1, width: 1, ...layer }] },
      reproductive: { stamens: [] },
      structure: { sepals: [], receptacle: { size: 1 }, ...extra },
    });

  test("a fused layer carries a corolla and no petals", () => {
    const plan = createFlowerPlan(
      spec({ fusion: { kind: "Bell", depth: 0.6 } }),
      9,
    );
    const layer = plan.layers[0]!;
    expect(layer.petals).toEqual([]);
    expect(layer.corolla).not.toBeNull();
    expect(layer.corolla!.lobes.length).toBe(5);
    expect(layer.corolla!.body.at(-1)!.op).toBe("Z");
  });

  test("a free layer and a layer without fusion keep their petals", () => {
    for (const layer of [{}, { fusion: { kind: "Free", depth: 0.9 } }]) {
      const plan = createFlowerPlan(spec(layer), 9);
      expect(plan.layers[0]!.corolla).toBeNull();
      expect(plan.layers[0]!.petals.length).toBe(5);
    }
  });

  test("the center disc is clamped to the throat", () => {
    const free = createFlowerPlan(spec({}), 9);
    const fused = createFlowerPlan(
      spec({ fusion: { kind: "Tube", depth: 0.5 } }),
      9,
    );
    const throat = fused.layers[0]!.corolla!.throat.radius;
    expect(free.center.discRadius).toBeGreaterThan(throat);
    expect(fused.center.discRadius).toBe(throat);
  });

  test("lobes get the layer's pattern marks and color passes", () => {
    const plan = createFlowerPlan(
      spec({
        fusion: { kind: "Trumpet", depth: 0.5 },
        pattern: { kind: "Picotee", scale: 0.5 },
        color: { stops: [{ position: 0, color: { r: 0.9, g: 0.3, b: 0.5 } }] },
      }),
      9,
    );
    const corollaPlan = plan.layers[0]!.corolla!;
    expect(corollaPlan.lobes.every(lobe => lobe.marks.length === 1)).toBe(true);
    expect(corollaPlan.color).toBe(0xe64d80);
    expect(corollaPlan.throat.innerColor).toBeLessThan(corollaPlan.color);
  });

  test("depth outside 0..1 is clamped", () => {
    const over = createFlowerPlan(
      spec({ fusion: { kind: "Funnel", depth: 5 } }),
      9,
    );
    const full = createFlowerPlan(
      spec({ fusion: { kind: "Funnel", depth: 1 } }),
      9,
    );
    expect(over.layers[0]!.corolla!.bodyRadius).toBe(
      full.layers[0]!.corolla!.bodyRadius,
    );
  });
});
