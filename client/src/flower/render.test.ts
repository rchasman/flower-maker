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
import { colorFromSpec } from "./color.ts";
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
        return plan.layers.flatMap(layer =>
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

describe("parseSymmetry", () => {
  test("reads the flat divergence_angle for Spiral arrangements", () => {
    const plan = createFlowerPlan(
      specWith([{ count: 6, arrangement: "Spiral" }], {
        symmetry: "Spiral",
        symmetry_order: 0,
        divergence_angle: 90,
      }),
      3,
    );
    const angles = plan.layers[0]!.petals.map(p => p.angle);
    const steps = angles.slice(1).map((a, i) => a - angles[i]!);
    expect(steps.every(step => Math.abs(step - Math.PI / 2) < 1e-9)).toBe(true);
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
      colorFromSpec(0.1, 0.6, 0.2),
      colorFromSpec(0.5, 0.2, 0.7),
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
