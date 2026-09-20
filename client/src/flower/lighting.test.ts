import { describe, expect, test } from "bun:test";
import { LIFE_STAGES, type LifeStage } from "../data/flower-enums.ts";
import {
  MAX_LIT_HEADS,
  arrangementHeadLights,
  backBlurStrength,
  hasBackFlorets,
  headLights,
  inLayer,
  isBackFloret,
  translucencyOf,
  volumeStrength,
} from "./lighting.ts";
import {
  createArrangementPlan,
  createFlowerPlan,
  type HeadPlan,
  type PlacedFloret,
} from "./render.ts";
import { LIGHT_ANGLE, LIGHT_DIRECTION } from "./util.ts";

const rgb = (r: number, g: number, b: number) => ({ r, g, b, a: 1 });

type Overrides = {
  stage?: LifeStage;
  texture?: string;
  opacity?: number;
  inflorescence?: { kind: string; head_count: number };
};

function spec(o: Overrides = {}): string {
  return JSON.stringify({
    petals: {
      stage: o.stage ?? "Bloom",
      layers: [
        {
          count: 6,
          length: 1.2,
          width: 0.9,
          texture: o.texture ?? "Smooth",
          opacity: o.opacity ?? 1,
          color: { stops: [{ position: 0, color: rgb(0.9, 0.3, 0.4) }] },
        },
      ],
    },
    reproductive: { stamens: [] },
    structure: { stem: { height: 0.8, thickness: 0.3 }, sepals: [] },
    ...(o.inflorescence ? { inflorescence: o.inflorescence } : {}),
  });
}

const head = (o: Overrides = {}): HeadPlan =>
  createFlowerPlan(spec(o), 7).heads[0];

const floret = (depth: number): PlacedFloret => ({
  offsetX: 0,
  offsetY: 0,
  scale: 1,
  angle: 0,
  stage: "Bloom",
  back: depth > 0.5,
  depth,
  stalk: null,
  head: 0,
});

describe("light direction", () => {
  test("is the unit vector of the scene light angle", () => {
    expect(LIGHT_DIRECTION[0]).toBeCloseTo(Math.cos(LIGHT_ANGLE), 12);
    expect(LIGHT_DIRECTION[1]).toBeCloseTo(Math.sin(LIGHT_ANGLE), 12);
    expect(Math.hypot(...LIGHT_DIRECTION)).toBeCloseTo(1, 12);
  });
});

describe("volume strength", () => {
  test("a bloom is the strongest cup, a bud and a seed head barely turn", () => {
    const strength = Object.fromEntries(
      LIFE_STAGES.map(stage => [stage, volumeStrength(head({ stage }))]),
    );
    expect(strength.Bloom).toBeCloseTo(0.35, 6);
    expect(strength.Bud).toBeLessThan(strength.Opening!);
    expect(strength.Opening).toBeLessThan(strength.Bloom!);
    expect(strength.Fading).toBeLessThan(strength.Bloom!);
    expect(strength.SeedHead).toBeLessThan(strength.Bud!);
  });

  test("a back head is shaded more gently than the same head in front", () => {
    const plan = createFlowerPlan(
      spec({ inflorescence: { kind: "Spike", head_count: 12 } }),
      7,
    );
    const front = plan.heads.find(h => h.stage === "Bloom" && !h.back)!;
    const back = plan.heads.find(h => h.stage === "Bloom" && h.back)!;
    expect(volumeStrength(back)).toBeLessThan(volumeStrength(front));
  });
});

describe("translucency", () => {
  test("papery and silk petals pass more light than waxy and leathery ones", () => {
    const by = (texture: string) => translucencyOf(head({ texture }));
    expect(by("Papery")).toBeGreaterThan(by("Smooth"));
    expect(by("Silk")).toBeGreaterThan(by("Smooth"));
    expect(by("Smooth")).toBeGreaterThan(by("Waxy"));
    expect(by("Waxy")).toBeGreaterThan(by("Leathery"));
  });

  test("the glassy opacity class opens a material up, solid keeps it at its floor", () => {
    const solid = translucencyOf(head({ opacity: 1 }));
    const translucent = translucencyOf(head({ opacity: 0.75 }));
    const glassy = translucencyOf(head({ opacity: 0.5 }));
    expect(solid).toBeCloseTo(0.6 * 0.35, 6);
    expect(translucent).toBeGreaterThan(solid);
    expect(glassy).toBeGreaterThan(translucent);
    expect(glassy).toBeCloseTo(0.6, 6);
  });

  test("a head without petals passes no light", () => {
    expect(translucencyOf(head({ stage: "SeedHead" }))).toBe(0);
  });
});

describe("depth layers", () => {
  test("a floret is behind the plant past depth 0.5", () => {
    expect(isBackFloret(floret(0))).toBe(false);
    expect(isBackFloret(floret(0.5))).toBe(false);
    expect(isBackFloret(floret(0.51))).toBe(true);
    expect(inLayer(floret(1), "back")).toBe(true);
    expect(inLayer(floret(1), "front")).toBe(false);
    expect(inLayer(floret(1), "all")).toBe(true);
    expect(inLayer(floret(0), "front")).toBe(true);
  });

  test("a solitary flower has no back layer, a spike does", () => {
    expect(hasBackFlorets(createFlowerPlan(spec(), 7))).toBe(false);
    expect(
      hasBackFlorets(
        createFlowerPlan(
          spec({ inflorescence: { kind: "Spike", head_count: 12 } }),
          7,
        ),
      ),
    ).toBe(true);
  });

  test("the back blur scales with the drawn radius", () => {
    expect(backBlurStrength(70)).toBeCloseTo(0.5, 6);
    expect(backBlurStrength(140)).toBeCloseTo(1, 6);
  });
});

describe("head lights", () => {
  test("a solitary flower lights one head at the stem tip, sized by its reach", () => {
    const plan = createFlowerPlan(spec(), 7);
    const lights = headLights(plan, 70, "all");
    expect(lights).toHaveLength(1);
    const [light] = lights;
    expect(light!.x).toBeCloseTo(plan.florets[0].offsetX * 70, 9);
    expect(light!.y).toBeCloseTo(plan.florets[0].offsetY * 70, 9);
    expect(light!.radius).toBeCloseTo(
      plan.heads[0].reach * plan.florets[0].scale * 70,
      9,
    );
    expect(light!.strength).toBeCloseTo(0.35, 6);
    expect(light!.translucency).toBeCloseTo(translucencyOf(plan.heads[0]), 9);
  });

  test("the front and back layers split a spike's florets and keep the largest first", () => {
    const plan = createFlowerPlan(
      spec({ inflorescence: { kind: "Spike", head_count: 12 } }),
      7,
    );
    const front = headLights(plan, 70, "front");
    const back = headLights(plan, 70, "back");
    expect(front.length + back.length).toBe(plan.florets.length);
    expect(front.length).toBe(
      plan.florets.filter(f => !isBackFloret(f)).length,
    );
    const radii = headLights(plan, 70, "all").map(l => l.radius);
    expect(radii).toEqual(radii.toSorted((a, b) => b - a));
  });

  test("more florets than the shader holds keeps the largest", () => {
    const plan = createFlowerPlan(
      spec({ inflorescence: { kind: "Corymb", head_count: 24 } }),
      7,
    );
    const lights = headLights(plan, 70, "all");
    expect(lights.length).toBeLessThanOrEqual(MAX_LIT_HEADS);
    expect(lights.length).toBe(Math.min(MAX_LIT_HEADS, plan.florets.length));
  });

  test("an arrangement lights every member's front head at its offset", () => {
    const plan = createArrangementPlan(
      [
        { spec: spec(), sid: 1 },
        { spec: spec({ texture: "Papery" }), sid: 2 },
        { spec: spec(), sid: 3 },
      ],
      1,
    );
    const lights = arrangementHeadLights(plan, 70);
    expect(lights).toHaveLength(plan.members.length);
    const byRadius = plan.members
      .map(m => ({
        x: m.offsetX * 70,
        radius: m.flowerPlan.heads[0].reach * m.scale * 70,
      }))
      .toSorted((a, b) => b.radius - a.radius);
    lights.map((light, i) => {
      expect(light.radius).toBeCloseTo(byRadius[i]!.radius, 9);
      expect(light.x).toBeCloseTo(byRadius[i]!.x, 9);
    });
  });
});
