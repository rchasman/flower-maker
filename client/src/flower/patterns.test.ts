import { describe, expect, test } from "bun:test";
import {
  PATTERN_KINDS,
  PETAL_SHAPES,
  type EdgeStyle,
  type PatternKind,
} from "../data/flower-enums.ts";
import { generatePetalMarks, type PetalPatternSpec } from "./patterns.ts";
import { createPetalFrame, generatePetal } from "./petal.ts";
import { colorFromSpec } from "./color.ts";
import { createFlowerPlan } from "./render.ts";
import { flattenCmds, pointInPolygon } from "./test-helpers.ts";

const EDGES: EdgeStyle[] = ["Smooth", "Ruffled", "Serrated", "Erose"];

const POSES = [
  { curvature: 0, curl: 0, length: 0.5, width: 0.5, radialOffset: 1 },
  { curvature: 0.7, curl: 0, length: 1.5, width: 1.2, radialOffset: 0.8 },
  { curvature: -0.6, curl: 0.25, length: 2.0, width: 0.8, radialOffset: 1 },
];

const DIALS = [
  { scale: 1, density: 1, extent: 1 },
  { scale: 0, density: 1, extent: 0 },
  { scale: 0.3, density: 0.6, extent: 0.5 },
];

const pattern = (
  kind: PatternKind,
  dials: Omit<PetalPatternSpec, "kind" | "color"> = DIALS[0]!,
): PetalPatternSpec => ({ kind, color: 0x442200, ...dials });

const ALWAYS_DRAWN: PatternKind[] = ["ThroatBlotch", "Picotee", "Band"];
const DENSITY_DRIVEN = PATTERN_KINDS.filter(
  kind => kind !== "None" && !ALWAYS_DRAWN.includes(kind),
);

const referenceFrame = (angle = 0.6) =>
  createPetalFrame({
    angle,
    shape: "Ovate",
    edge: "Smooth",
    length: 1,
    width: 1,
    curvature: 0.2,
    curl: 0,
    seed: 0.5,
  });

describe("generatePetalMarks", () => {
  for (const kind of PATTERN_KINDS.filter(k => k !== "None")) {
    test(`${kind}: every mark vertex is inside the petal outline`, () => {
      const outside = PETAL_SHAPES.flatMap(shape =>
        EDGES.flatMap(edge =>
          POSES.flatMap(pose =>
            DIALS.flatMap(dials => {
              const frame = createPetalFrame({
                angle: 1.1,
                shape,
                edge,
                seed: 0.37,
                ...pose,
              });
              const polygon = flattenCmds(generatePetal(frame));
              return generatePetalMarks(pattern(kind, dials), frame, 0.42)
                .flatMap(mark => flattenCmds(mark.cmds))
                .filter(point => !pointInPolygon(point, polygon))
                .map(point => ({ shape, edge, ...pose, ...dials, point }));
            }),
          ),
        ),
      );
      expect(outside).toEqual([]);
    });

    test(`${kind}: draws at least one mark at full dials`, () => {
      const marks = generatePetalMarks(pattern(kind), referenceFrame(), 0.42);
      expect(marks.length).toBe(1);
      expect(marks[0]!.cmds.length).toBeGreaterThan(3);
    });
  }

  test("None draws nothing", () => {
    expect(generatePetalMarks(pattern("None"), referenceFrame(), 0.1)).toEqual(
      [],
    );
  });

  test("density 0 draws nothing for the count driven kinds", () => {
    const drawn = DENSITY_DRIVEN.filter(
      kind =>
        generatePetalMarks(
          pattern(kind, { scale: 1, density: 0, extent: 1 }),
          referenceFrame(),
          0.1,
        ).length > 0,
    );
    expect(drawn).toEqual([]);
  });

  test("density 0 still draws ThroatBlotch, Picotee and Band", () => {
    const silent = ALWAYS_DRAWN.filter(
      kind =>
        generatePetalMarks(
          pattern(kind, { scale: 0.5, density: 0, extent: 0.5 }),
          referenceFrame(),
          0.1,
        ).length === 0,
    );
    expect(silent).toEqual([]);
  });

  test("the same seed gives the same marks, another seed moves them", () => {
    const frame = referenceFrame();
    const a = generatePetalMarks(pattern("Spots"), frame, 0.31);
    const b = generatePetalMarks(pattern("Spots"), frame, 0.31);
    const c = generatePetalMarks(pattern("Spots"), frame, 0.77);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  test("marks carry the pattern color and a visible alpha", () => {
    const [mark] = generatePetalMarks(pattern("Band"), referenceFrame(), 0.2);
    expect(mark!.color).toBe(0x442200);
    expect(mark!.alpha).toBeGreaterThan(0);
    expect(mark!.alpha).toBeLessThanOrEqual(1);
  });
});

describe("createFlowerPlan marks", () => {
  const spec = (layer: Record<string, unknown>) =>
    JSON.stringify({
      petals: { layers: [{ count: 5, ...layer }] },
      reproductive: { stamens: [] },
      structure: { sepals: [] },
    });

  test("reads petals.layers[].pattern and marks every petal in the spec color", () => {
    const plan = createFlowerPlan(
      spec({
        pattern: {
          kind: "Spots",
          color: { r: 0.1, g: 0.1, b: 0.6, a: 1 },
          scale: 0.6,
          density: 1,
          extent: 0.5,
        },
      }),
      11,
    );
    const petals = plan.layers[0]!.petals;
    expect(petals.length).toBe(5);
    expect(petals.map(p => p.marks.map(m => m.color))).toEqual(
      petals.map(() => [colorFromSpec(0.1, 0.1, 0.6)]),
    );
  });

  test("petals of the same layer get different spot layouts", () => {
    const plan = createFlowerPlan(
      spec({ pattern: { kind: "Spots", density: 1 } }),
      11,
    );
    const [first, second] = plan.layers[0]!.petals;
    expect(first!.marks[0]!.cmds.length).toBe(second!.marks[0]!.cmds.length);
    expect(first!.marks).not.toEqual(second!.marks);
  });

  test("a layer without a pattern has no marks", () => {
    const plan = createFlowerPlan(spec({}), 11);
    expect(plan.layers[0]!.petals.every(p => p.marks.length === 0)).toBe(true);
  });
});
