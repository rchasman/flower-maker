import { describe, expect, test } from "bun:test";
import {
  PETAL_SHAPES,
  VEIN_PATTERNS,
  type EdgeStyle,
  type PetalShape,
} from "../data/flower-enums.ts";
import type { DrawCmd, Vec2 } from "./geometry.ts";
import {
  createPetalFrame,
  generatePetal,
  petalLocalToFlower,
} from "./petal.ts";
import { colorFromSpec, desaturate } from "./color.ts";
import {
  createArrangementPlan,
  createFlowerPlan,
  type LeafPlan,
} from "./render.ts";
import { flattenCmds, pointInPolygon } from "./test-helpers.ts";

const EDGES: EdgeStyle[] = [
  "Smooth",
  "Ruffled",
  "Fringed",
  "Serrated",
  "Lobed",
  "Erose",
];

const POSES = [
  { curvature: 0, curl: 0, length: 0.5, width: 0.5, radialOffset: 1 },
  { curvature: 0.7, curl: 0, length: 1.5, width: 1.2, radialOffset: 0.8 },
  { curvature: -0.6, curl: 0.25, length: 2.0, width: 0.8, radialOffset: 1 },
];

const ANGLES = [0, 1.1, 2.9, -2.2];
const T_SAMPLES = Array.from({ length: 32 }, (_, i) => 0.03 + (i / 31) * 0.94);
const U_SAMPLES = [-0.85, -0.5, -0.2, 0, 0.2, 0.5, 0.85];

describe("petalLocalToFlower", () => {
  for (const shape of PETAL_SHAPES) {
    test(`${shape}: every |u| <= 0.85 point is inside the outline`, () => {
      const outside = EDGES.flatMap(edge =>
        POSES.flatMap(pose =>
          ANGLES.flatMap(angle => {
            const frame = createPetalFrame({
              angle,
              shape,
              edge,
              seed: 0.37,
              ...pose,
            });
            const polygon = flattenCmds(generatePetal(frame));
            return T_SAMPLES.flatMap(t =>
              U_SAMPLES.filter(
                u => !pointInPolygon(petalLocalToFlower(t, u, frame), polygon),
              ).map(u => ({ edge, angle, t, u, ...pose })),
            );
          }),
        ),
      );
      expect(outside).toEqual([]);
    });
  }

  test("u = ±1 is the outline itself", () => {
    const frame = createPetalFrame({
      angle: 0.4,
      shape: "Falcate",
      edge: "Smooth",
      length: 1,
      width: 1,
      curvature: 0.2,
      curl: 0,
      seed: 0.5,
    });
    const first = generatePetal(frame)[0];
    expect(first).toEqual({
      op: "M",
      ...toXY(petalLocalToFlower(0, 1, frame)),
    });
  });
});

const toXY = ([x, y]: Vec2) => ({ x, y });

type LayerSpec = Record<string, unknown>;

function specWith(
  layers: LayerSpec[],
  extra: Record<string, unknown> = {},
): string {
  return JSON.stringify({
    petals: { layers, ...extra },
    reproductive: { stamens: [] },
    structure: { sepals: [] },
  });
}

describe("createFlowerPlan veins", () => {
  const NARROW_SHAPES: PetalShape[] = ["Tubular", "Filiform", "Ligulate"];
  for (const veinPattern of VEIN_PATTERNS) {
    test(`${veinPattern} veins stay inside their petal`, () => {
      const escaped = NARROW_SHAPES.flatMap(shape => {
        const plan = createFlowerPlan(
          specWith([
            {
              count: 5,
              shape,
              vein_pattern: veinPattern,
              width: 0.6,
              length: 1.4,
              curl: 0.2,
            },
          ]),
          11,
        );
        return plan.heads[0].layers.flatMap(layer =>
          layer.petals.flatMap(petal => {
            const polygon = flattenCmds(petal.cmds);
            return flattenCmds(petal.veinCmds)
              .filter(point => !pointInPolygon(point, polygon))
              .map(point => ({ shape, point }));
          }),
        );
      });
      expect(escaped).toEqual([]);
    });
  }
});

describe("Spiral arrangement", () => {
  const spiral = (count: number, width: number) =>
    createFlowerPlan(
      specWith([
        { count, arrangement: "Spiral", shape: "Ovate", width, length: 1.4 },
        { count: 8, arrangement: "Spiral", shape: "Ovate", width, length: 1.2 },
      ]),
      3,
    ).heads[0];

  test("petals sit in an even ring, each overlapping its neighbours", () => {
    const head = spiral(5, 1);
    const petals = head.layers[0]!.petals;
    const angles = petals.map(p => p.angle);
    const steps = angles.slice(1).map((a, i) => a - angles[i]!);
    expect(steps.every(step => Math.abs(step - (2 * Math.PI) / 5) < 1e-9)).toBe(
      true,
    );
    const polygons = petals.map(p => flattenCmds(p.cmds));
    const overlaps = polygons.map((polygon, i) => {
      const next = polygons[(i + 1) % polygons.length]!;
      return next.filter(point => pointInPolygon(point, polygon)).length;
    });
    expect(overlaps.every(n => n > 0)).toBe(true);
  });

  test("inner rings sit deeper in the cup than the outer ring", () => {
    const head = spiral(5, 1);
    const reach = (cmds: readonly DrawCmd[]) =>
      Math.max(...flattenCmds(cmds).map(([x, y]) => Math.hypot(x, y)));
    const outer = Math.max(...head.layers[0]!.petals.map(p => reach(p.cmds)));
    const inner = Math.max(...head.layers[1]!.petals.map(p => reach(p.cmds)));
    expect(inner).toBeLessThan(outer);
  });
});

describe("parseFoliage", () => {
  const stem = { height: 0.8, thickness: 0.3 };
  const gradient = (r: number, g: number, b: number) => ({
    stops: [{ position: 0, color: { r, g, b, a: 1 } }],
  });

  test("each leaf carries its own shape and color", () => {
    const plan = createFlowerPlan(
      JSON.stringify({
        petals: { layers: [{ count: 5 }] },
        structure: { stem },
        foliage: {
          leaves: [
            { shape: "Linear", color: gradient(0.1, 0.6, 0.2), position: 0.4 },
            {
              shape: "Cordate",
              color: gradient(0.5, 0.2, 0.7),
              position: 0.7,
              side: "Right",
            },
          ],
        },
      }),
      7,
    );
    expect(plan.leaves.map(l => l.color)).toEqual([
      desaturate(colorFromSpec(0.1, 0.6, 0.2), 0.12),
      desaturate(colorFromSpec(0.5, 0.2, 0.7), 0.12),
    ]);
  });

  test("a spec with no leaves draws no leaves", () => {
    const plan = createFlowerPlan(
      JSON.stringify({
        petals: { layers: [{ count: 5 }] },
        structure: { stem },
        foliage: { leaves: [] },
      }),
      7,
    );
    expect(plan.leaves).toEqual([]);
  });

  const leafPlans = (leaves: Record<string, unknown>[]) =>
    createFlowerPlan(
      JSON.stringify({
        petals: { layers: [{ count: 5 }] },
        structure: { stem },
        foliage: { leaves },
      }),
      7,
    ).leaves;
  const centroidX = (cmds: readonly DrawCmd[]): number => {
    const pts = flattenCmds(cmds);
    return pts.reduce((sum, [x]) => sum + x, 0) / pts.length;
  };
  /** the midrib is the first vein: a move to the petiole, then a line to the tip */
  const tipY = (leaf: LeafPlan): number => {
    const tip = leaf.veins[1];
    if (tip?.op !== "L") throw new Error("midrib tip is not a line");
    return tip.y;
  };

  test("Left and Right leaves at one position sit on opposite sides of an upright stem", () => {
    const [left, right] = leafPlans([
      { position: 0.5, side: "Left" },
      { position: 0.5, side: "Right" },
    ]);
    expect(centroidX(left!.cmds)).toBeLessThan(0);
    expect(centroidX(right!.cmds)).toBeGreaterThan(0);
  });

  test("droop hangs the leaf tip lower on screen on both sides", () => {
    const [left, right, leftDroop, rightDroop] = leafPlans([
      { position: 0.5, side: "Left", droop: 0 },
      { position: 0.5, side: "Right", droop: 0 },
      { position: 0.5, side: "Left", droop: 0.8 },
      { position: 0.5, side: "Right", droop: 0.8 },
    ]);
    expect(tipY(leftDroop!)).toBeGreaterThan(tipY(left!));
    expect(tipY(rightDroop!)).toBeGreaterThan(tipY(right!));
  });
});

describe("createArrangementPlan", () => {
  test("is deterministic for the same constituents", () => {
    const constituents = Array.from({ length: 5 }, (_, i) => ({
      spec: specWith([{ count: 5 + i }]),
      sid: 100 + i,
    }));
    const slots = (plan: ReturnType<typeof createArrangementPlan>) =>
      plan.members.map(m => [m.offsetX, m.offsetY, m.scale]);
    expect(slots(createArrangementPlan(constituents, 3))).toEqual(
      slots(createArrangementPlan(constituents, 3)),
    );
  });
});

describe("plant proportions", () => {
  const plant = (
    layer: Record<string, unknown>,
    leaves: Record<string, unknown>[] = [],
    stem: Record<string, unknown> = { height: 0.6, thickness: 0.45 },
  ) =>
    createFlowerPlan(
      JSON.stringify({
        petals: { layers: [layer] },
        reproductive: { stamens: [{ height: 0.8 }] },
        structure: { sepals: [{ length: 0.5 }], stem },
        foliage: { leaves },
      }),
      5,
    );
  const stemLength = (plan: ReturnType<typeof createFlowerPlan>): number =>
    plan.stem!.axis.fromY;
  const headDiameter = (plan: ReturnType<typeof createFlowerPlan>): number => {
    const head = plan.heads[0];
    const petals = head.layers.flatMap(l => l.petals.map(p => p.cmds));
    const reach = Math.max(
      ...petals.map(cmds =>
        Math.max(...flattenCmds(cmds).map(([x, y]) => Math.hypot(x, y))),
      ),
    );
    return 2 * reach * plan.florets[0].scale;
  };

  test("a solitary stem is at least 2.5 head diameters long, for big and small petals alike", () => {
    for (const layer of [
      { count: 8, length: 2.5, width: 2 },
      { count: 5, length: 0.4, width: 0.3 },
      { count: 21, length: 1.4, width: 0.5 },
    ]) {
      const plan = plant(layer);
      const ratio = stemLength(plan) / headDiameter(plan);
      expect(ratio).toBeGreaterThanOrEqual(2.5 - 1e-9);
      expect(ratio).toBeLessThanOrEqual(1 / 0.28 + 1e-9);
    }
  });

  test("the stem base half width is at most 0.02 of its length, whatever the thickness", () => {
    for (const thickness of [0, 0.3, 1, 5]) {
      const plan = plant({ count: 5 }, [], { height: 0.6, thickness });
      expect(plan.stem!.halfWidth).toBeLessThanOrEqual(
        0.02 * stemLength(plan) + 1e-9,
      );
      expect(plan.stem!.halfWidth).toBeGreaterThan(0);
    }
  });

  test("the solitary head leans with the stem tip, 5 to 12 degrees under its weight", () => {
    const light = plant({ count: 3, length: 0.5, width: 0.3 });
    const heavy = plant({ count: 30, length: 2, width: 1.5 });
    for (const plan of [light, heavy]) {
      const lean = Math.abs(plan.florets[0].angle);
      expect(lean).toBeGreaterThanOrEqual(Math.PI * (5 / 180) - 1e-9);
      expect(lean).toBeLessThanOrEqual(Math.PI * (12 / 180) + 1e-9);
      expect(plan.florets[0].angle).toBeCloseTo(plan.stem!.axis.tipBend, 6);
    }
    expect(Math.abs(heavy.florets[0].angle)).toBeGreaterThan(
      Math.abs(light.florets[0].angle),
    );
  });

  const attachY = (leaf: LeafPlan): number => {
    const root = flattenCmds(leaf.petiole!.fill)[0]!;
    return root[1];
  };

  test("no leaf attaches in the top 20 percent of a solitary stem, and they alternate sides", () => {
    const plan = plant(
      { count: 5 },
      [0.05, 0.4, 0.75, 1].map(position => ({ position, side: "Right" })),
    );
    const length = stemLength(plan);
    expect(plan.leaves.length).toBe(4);
    for (const leaf of plan.leaves) {
      expect(attachY(leaf)).toBeGreaterThanOrEqual(0.2 * length);
      expect(attachY(leaf)).toBeLessThanOrEqual(0.85 * length);
    }
    const sides = plan.leaves.map(l => Math.sign(centroidXOf(l.cmds)));
    expect(sides).toEqual([1, -1, 1, -1]);
  });

  test("lower leaves are larger, and every blade is 0.18 to 0.30 stem lengths long", () => {
    const plan = plant(
      { count: 5 },
      [0.1, 0.5, 0.9].map(position => ({ position, size: 0.5 })),
    );
    const length = stemLength(plan);
    const bladeLength = (leaf: LeafPlan): number => {
      const [base, tip] = leaf.veins;
      if (base?.op !== "M" || tip?.op !== "L") throw new Error("no midrib");
      return Math.hypot(tip.x - base.x, tip.y - base.y);
    };
    const blades = plan.leaves.map(bladeLength);
    expect(blades[0]!).toBeGreaterThan(blades[2]!);
    for (const blade of blades) {
      expect(blade).toBeGreaterThanOrEqual(0.18 * length * 0.95);
      expect(blade).toBeLessThanOrEqual(0.3 * length * 1.05);
    }
  });
});

describe("corymb leaves", () => {
  test("a corymb carries a pair of opposite leaves just under its dome", () => {
    const plan = createFlowerPlan(
      JSON.stringify({
        petals: { layers: [{ count: 4 }] },
        structure: { sepals: [], stem: { height: 0.6, thickness: 0.3 } },
        foliage: { leaves: [{ position: 0.3, side: "Left" }] },
        inflorescence: { kind: "Corymb", head_count: 12, head_scale: 0.3 },
      }),
      4,
    );
    const length = plan.stem!.axis.fromY;
    const rootY = (leaf: LeafPlan) => flattenCmds(leaf.petiole!.fill)[0]![1];
    const pair = plan.leaves.filter(l => rootY(l) < 0.15 * length);
    expect(pair.length).toBe(2);
    const sides = pair.map(l => Math.sign(centroidXOf(l.cmds)));
    expect(new Set(sides)).toEqual(new Set([1, -1]));
    expect(Math.abs(rootY(pair[0]!) - rootY(pair[1]!))).toBeLessThan(0.05);
  });
});

describe("closed centre", () => {
  const head = (arrangement: string, curvature: number) =>
    createFlowerPlan(
      specWith([
        { count: 5, arrangement, curvature: 0 },
        { count: 8, arrangement, curvature },
      ]),
      3,
    ).heads[0];

  test("a spiralled bloom whose inner ring cups closes over its centre", () => {
    expect(head("Spiral", 0.85).closedCentre).toBe(true);
    expect(head("Spiral", 0.2).closedCentre).toBe(false);
    expect(head("Radial", 0.85).closedCentre).toBe(false);
  });
});

const centroidXOf = (cmds: readonly DrawCmd[]): number => {
  const pts = flattenCmds(cmds);
  return pts.reduce((sum, [x]) => sum + x, 0) / pts.length;
};
