import { describe, expect, test } from "bun:test";
import { FUSION_KINDS } from "../data/flower-enums.ts";
import {
  generateCorolla,
  isFused,
  type Corolla,
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

const referenceFrame = (layer: CorollaLayer = LAYER, angle = 0.4) =>
  createPetalFrame({
    angle,
    shape: layer.shape,
    edge: layer.edge,
    length: layer.length,
    width: layer.width,
    curvature: layer.curvature,
    curl: layer.curl,
    seed: 0.5,
  });

const corolla = (kind: FusedKind, count = 5, depth = 0.5, seed = 0.42) =>
  generateCorolla(LAYER, referenceFrame(), kind, depth, count, seed);

const norm = ([x, y]: readonly [number, number]) => Math.hypot(x, y);

/** How far the rim opens across the cup's full flare: 1 when the rim is the widest point. */
const rimFlare = ({ throat, rimRadius, bodyRadius }: Corolla): number =>
  (rimRadius - throat.radius) / (bodyRadius - throat.radius);

/** The cup's widening from throat to silhouette. */
const flare = ({ throat, bodyRadius }: Corolla): number =>
  bodyRadius - throat.radius;

describe("cup shapes", () => {
  test("Bell is widest before the rim and curves in only a little", () => {
    const bell = corolla("Bell");
    expect(bell.rimRadius).toBeLessThan(bell.bodyRadius);
    expect(rimFlare(bell)).toBeGreaterThan(0.75);
  });

  test("Trumpet and Funnel are widest at the rim", () => {
    for (const kind of ["Trumpet", "Funnel"] as const) {
      expect(rimFlare(corolla(kind))).toBeCloseTo(1, 9);
    }
  });

  test("Urn's rim closes to less than half the bulge", () => {
    expect(rimFlare(corolla("Urn"))).toBeLessThan(0.5);
  });

  test("Tube stays narrow next to a Funnel from the same petal", () => {
    expect(flare(corolla("Tube"))).toBeLessThan(
      flare(corolla("Funnel")) * 0.15,
    );
  });
});

describe("generateCorolla", () => {
  test("a short petal with a strong curl still opens outward from its throat", () => {
    const curled: CorollaLayer = { ...LAYER, length: 0.5, curl: 0.7 };
    const { throat, rimRadius, bodyRadius } = generateCorolla(
      curled,
      referenceFrame(curled),
      "Bell",
      0.5,
      5,
      0.42,
    );
    expect(throat.radius).toBeLessThan(rimRadius);
    expect(rimRadius).toBeLessThanOrEqual(bodyRadius);
    expect(bodyRadius - throat.radius).toBeGreaterThan(0.01);
  });

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
    const layer = plan.heads[0].layers[0]!;
    expect(layer.petals).toEqual([]);
    expect(layer.corolla).not.toBeNull();
    expect(layer.corolla!.lobes.length).toBe(5);
    expect(layer.corolla!.body.at(-1)!.op).toBe("Z");
  });

  test("a free layer and a layer without fusion keep their petals", () => {
    for (const layer of [{}, { fusion: { kind: "Free", depth: 0.9 } }]) {
      const plan = createFlowerPlan(spec(layer), 9);
      expect(plan.heads[0].layers[0]!.corolla).toBeNull();
      expect(plan.heads[0].layers[0]!.petals.length).toBe(5);
    }
  });

  test("the center disc is clamped to the throat", () => {
    const free = createFlowerPlan(spec({}), 9);
    const fused = createFlowerPlan(
      spec({ fusion: { kind: "Tube", depth: 0.5 } }),
      9,
    );
    const throat = fused.heads[0].layers[0]!.corolla!.throat.radius;
    expect(free.heads[0].center.discRadius).toBeGreaterThan(throat);
    expect(fused.heads[0].center.discRadius).toBe(throat);
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
    const corollaPlan = plan.heads[0].layers[0]!.corolla!;
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
    expect(over.heads[0].layers[0]!.corolla!.bodyRadius).toBe(
      full.heads[0].layers[0]!.corolla!.bodyRadius,
    );
  });
});
