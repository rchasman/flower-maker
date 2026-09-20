import { describe, expect, test } from "bun:test";
import {
  BIO_PATTERNS,
  DISPERSAL_PATTERNS,
  LEAF_SHAPES,
  NECTARY_POSITIONS,
  SURFACE_TEXTURES,
  VARIEGATION_KINDS,
  type LeafShape,
  type SurfaceTexture,
  type VariegationKind,
} from "../data/flower-enums.ts";
import { colorFromSpec, hueRotate } from "./color.ts";
import { generateLeaf, type LeafParams } from "./leaf.ts";
import { createFlowerPlan } from "./render.ts";
import { branchTipHalfWidth, generateStemSurface, stemAxis } from "./stem.ts";
import { flattenCmds, pointInPolygon } from "./test-helpers.ts";

const rgb = (r: number, g: number, b: number) => ({ r, g, b, a: 1 });
const gradient = (r: number, g: number, b: number) => ({
  stops: [{ position: 0, color: rgb(r, g, b) }],
});

const STEM = { height: 0.8, thickness: 0.3 };
const STAMENS = Array.from({ length: 6 }, () => ({ height: 0.6 }));

type Overrides = {
  foliage?: Record<string, unknown>;
  reproductive?: Record<string, unknown>;
  ornamentation?: Record<string, unknown>;
  stem?: Record<string, unknown> | null;
  sepals?: unknown[];
};

function spec(o: Overrides = {}): string {
  return JSON.stringify({
    petals: {
      layers: [
        { count: 5, length: 1.2, width: 1, vein_pattern: "Branching" },
        { count: 4, length: 0.8, width: 0.7 },
      ],
    },
    reproductive: { stamens: STAMENS, ...o.reproductive },
    structure: {
      sepals: o.sepals ?? [{ length: 0.5 }, { length: 0.5 }, { length: 0.5 }],
      ...(o.stem === null ? {} : { stem: { ...STEM, ...o.stem } }),
    },
    foliage: o.foliage ?? {},
    ornamentation: o.ornamentation ?? {},
  });
}

const bract = (showy: boolean, shape: LeafShape = "Lanceolate") => ({
  color: gradient(0.9, 0.2, 0.3),
  size: 0.5,
  shape,
  showy,
  position: 0.95,
});

describe("bracts", () => {
  test("showy bracts ring the head with twice their count, at least three", () => {
    const four = createFlowerPlan(
      spec({
        foliage: { bracts: Array.from({ length: 4 }, () => bract(true)) },
      }),
      3,
    );
    expect(four.heads[0].bracts.length).toBe(8);
    const one = createFlowerPlan(
      spec({ foliage: { bracts: [bract(true, "Cordate")] } }),
      3,
    );
    expect(one.heads[0].bracts.length).toBe(3);
    expect(
      one.heads[0].bracts.every(b => b.color === colorFromSpec(0.9, 0.2, 0.3)),
    ).toBe(true);
  });

  test("every leaf shape has a bract silhouette that reaches past the sepals", () => {
    for (const shape of LEAF_SHAPES) {
      const plan = createFlowerPlan(
        spec({ foliage: { bracts: [bract(true, shape)] } }),
        5,
      );
      const reach = (cmds: Parameters<typeof flattenCmds>[0]) =>
        Math.max(...flattenCmds(cmds).map(([x, y]) => Math.hypot(x, y)));
      const bractReach = Math.max(
        ...plan.heads[0].bracts.map(b => reach(b.cmds)),
      );
      const sepalReach = Math.max(
        ...plan.heads[0].sepals.map(s => reach(s.cmds)),
      );
      expect(bractReach).toBeGreaterThan(sepalReach);
    }
  });

  test("non-showy bracts become small leaves on the stem, not a ring", () => {
    const plan = createFlowerPlan(
      spec({ foliage: { bracts: [bract(false), bract(false), bract(false)] } }),
      3,
    );
    expect(plan.heads[0].bracts).toEqual([]);
    expect(plan.leaves.length).toBe(3);
    // Position 0.95 is just under the head, so the scales sit near the stem tip
    for (const leaf of plan.leaves) {
      const points = flattenCmds(leaf.cmds);
      expect(Math.max(...points.map(([, y]) => y))).toBeLessThan(
        plan.stem!.axis.fromY * 0.3,
      );
    }
  });

  test("without a stem there is nowhere to put scale bracts", () => {
    const plan = createFlowerPlan(
      spec({ stem: null, foliage: { bracts: [bract(false)] } }),
      3,
    );
    expect(plan.leaves).toEqual([]);
  });
});

describe("pollen", () => {
  const pollen = (dispersal: string, particle_count = 10) => ({
    particle_count,
    drift_speed: 0.4,
    color: rgb(1, 0.9, 0.3),
    luminosity: 0.7,
    dispersal,
  });

  for (const dispersal of DISPERSAL_PATTERNS) {
    test(`${dispersal} grains start at the anther tips`, () => {
      const plan = createFlowerPlan(
        spec({ reproductive: { stamens: STAMENS, pollen: pollen(dispersal) } }),
        9,
      );
      const grains = plan.particles.filter(p => p.kind === "Pollen");
      expect(grains.length).toBe(10);
      const anthers = plan.heads[0].center.stamens;
      for (const grain of grains) {
        const nearest = Math.min(
          ...anthers.map(a =>
            Math.hypot(
              grain.x - Math.cos(a.angle) * a.length,
              grain.y - Math.sin(a.angle) * a.length,
            ),
          ),
        );
        expect(nearest).toBeLessThanOrEqual(anthers[0]!.antherRadius);
        expect(grain.luminosity).toBeCloseTo(0.7);
        expect(grain.color).toBe(colorFromSpec(1, 0.9, 0.3));
      }
    });
  }

  test("dispersal sets the motion: gravity falls, burst flies outward", () => {
    const grainsFor = (dispersal: string) =>
      createFlowerPlan(
        spec({ reproductive: { stamens: STAMENS, pollen: pollen(dispersal) } }),
        9,
      ).particles.filter(p => p.kind === "Pollen");
    expect(grainsFor("Gravity").every(g => g.gravity > 0.5)).toBe(true);
    expect(
      grainsFor("Burst").every(g => g.x * g.driftX + g.y * g.driftY > 0),
    ).toBe(true);
  });

  test("with no stamens the grains start on the disc", () => {
    const plan = createFlowerPlan(
      spec({ reproductive: { stamens: [], pollen: pollen("Wind", 6) } }),
      9,
    );
    const grains = plan.particles.filter(p => p.kind === "Pollen");
    expect(grains.length).toBe(6);
    for (const grain of grains) {
      expect(Math.hypot(grain.x, grain.y)).toBeLessThanOrEqual(
        plan.heads[0].center.discRadius + 0.02,
      );
    }
  });

  test("a spec without pollen seeds no pollen", () => {
    expect(
      createFlowerPlan(spec(), 9).particles.filter(p => p.kind === "Pollen"),
    ).toEqual([]);
  });
});

describe("nectary", () => {
  for (const position of NECTARY_POSITIONS) {
    test(`${position} produces static shapes at the centre`, () => {
      const plan = createFlowerPlan(
        spec({
          reproductive: {
            stamens: STAMENS,
            nectary: {
              position,
              color: rgb(0.9, 0.3, 0.6),
              glow: { intensity: 0.6, color: rgb(0.9, 0.3, 0.6), radius: 0.3 },
            },
          },
        }),
        4,
      );
      const nectary = plan.heads[0].center.nectary;
      expect(nectary).not.toBeNull();
      expect(nectary!.position).toBe(position);
      expect(nectary!.fills.length + nectary!.strokes.length).toBeGreaterThan(
        0,
      );
      expect(nectary!.glow).not.toBeNull();
      expect(nectary!.glow!.pulse).toBeNull();
    });
  }

  test("Petaline marks sit at the base of every outer petal", () => {
    const plan = createFlowerPlan(
      spec({
        reproductive: {
          stamens: STAMENS,
          nectary: { position: "Petaline", color: rgb(0.9, 0.3, 0.6) },
        },
      }),
      4,
    );
    const marks = flattenCmds(plan.heads[0].center.nectary!.fills);
    expect(marks.length).toBeGreaterThan(0);
    const outer = plan.heads[0].layers[0]!.petals.map(p => flattenCmds(p.cmds));
    const escaped = marks.filter(
      point => !outer.some(polygon => pointInPolygon(point, polygon)),
    );
    expect(escaped).toEqual([]);
    expect(plan.heads[0].center.nectary!.glow).toBeNull();
  });

  test("a pulse in the glow is kept for the per-frame overlay", () => {
    const plan = createFlowerPlan(
      spec({
        reproductive: {
          stamens: STAMENS,
          nectary: {
            position: "Basal",
            glow: {
              intensity: 0.8,
              radius: 0.5,
              pulse: { speed: 0.5, pattern: "Sine", min_intensity: 0.2 },
            },
          },
        },
      }),
      4,
    );
    expect(plan.heads[0].center.nectary!.glow!.pulse).toEqual({
      speed: 0.5,
      minIntensity: 0.2,
    });
  });
});

describe("hueRotate", () => {
  test("a whole turn is the identity", () => {
    for (const color of [0xff6b9d, 0x123456, 0x808080, 0x00ff00, 0xffffff]) {
      expect(hueRotate(color, 360)).toBe(color);
      expect(hueRotate(color, -720)).toBe(color);
    }
  });

  test("red turned 120 degrees is green", () => {
    const rotated = hueRotate(0xff0000, 120);
    const r = (rotated >> 16) & 0xff;
    const g = (rotated >> 8) & 0xff;
    const b = rotated & 0xff;
    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(b);
    expect(rotated).toBe(0x00ff00);
  });

  test("a gray has no hue to rotate", () => {
    expect(hueRotate(0x777777, 90)).toBe(0x777777);
  });
});

describe("iridescence", () => {
  const iridescent = (affected_parts: string[] = []) =>
    createFlowerPlan(
      spec({
        ornamentation: {
          iridescence: { intensity: 0.6, hue_shift_range: 60, affected_parts },
        },
      }),
      6,
    );

  test("each petal gets a sheen shifted by how it faces the light", () => {
    const petals = iridescent().heads[0].layers[0]!.petals;
    expect(petals.every(p => p.iridescence !== null)).toBe(true);
    const sheens = new Set(petals.map(p => p.iridescence!.color));
    expect(sheens.size).toBeGreaterThan(1);
    expect(petals[0]!.iridescence!.intensity).toBeCloseTo(0.6);
  });

  test("affected_parts without petals leaves the petals plain", () => {
    const petals = iridescent(["stem"]).heads[0].layers[0]!.petals;
    expect(petals.every(p => p.iridescence === null)).toBe(true);
    expect(
      createFlowerPlan(spec(), 6).heads[0].layers[0]!.petals.every(
        p => p.iridescence === null,
      ),
    ).toBe(true);
  });
});

describe("bioluminescence", () => {
  for (const pattern of BIO_PATTERNS) {
    test(`${pattern} has glow geometry`, () => {
      const plan = createFlowerPlan(
        spec({
          ornamentation: {
            bioluminescence: {
              pattern,
              color: rgb(0.2, 0.9, 0.8),
              intensity: 0.7,
              trigger: "Night",
            },
          },
        }),
        8,
      );
      expect(plan.heads[0].bio).not.toBeNull();
      expect(plan.heads[0].bio!.pattern).toBe(pattern);
      expect(
        plan.heads[0].bio!.strokes.length + plan.heads[0].bio!.fills.length,
      ).toBeGreaterThan(0);
    });
  }

  test("Veins reuses the petal veins", () => {
    const plan = createFlowerPlan(
      spec({
        ornamentation: {
          bioluminescence: { pattern: "Veins", color: rgb(0.2, 0.9, 0.8) },
        },
      }),
      8,
    );
    const veins = plan.heads[0].layers.flatMap(l =>
      l.petals.flatMap(p => p.veinCmds),
    );
    expect(plan.heads[0].bio!.strokes).toEqual(veins);
    expect(createFlowerPlan(spec(), 8).heads[0].bio).toBeNull();
  });
});

describe("leaf variegation and translucency", () => {
  const leaf = (kind: VariegationKind, shape: LeafShape): LeafParams => ({
    shape,
    serration: "Coarse",
    droop: 0.4,
    variegation: { kind },
  });

  for (const kind of VARIEGATION_KINDS.filter(k => k !== "None")) {
    test(`${kind} marks lie inside the leaf outline`, () => {
      const escaped = LEAF_SHAPES.flatMap(shape =>
        [0.3, 1.9, -1.1].flatMap(angle => {
          const geometry = generateLeaf(
            {
              x: 0.1,
              y: 0.4,
              angle,
              blade: 0.45,
              petiole: 0.09,
              stemHalfWidth: 0.02,
            },
            leaf(kind, shape),
          );
          const polygon = flattenCmds(geometry.outline);
          expect(geometry.variegation.length).toBeGreaterThan(0);
          return flattenCmds(geometry.variegation)
            .filter(point => !pointInPolygon(point, polygon))
            .map(point => ({ shape, angle, point }));
        }),
      );
      expect(escaped).toEqual([]);
    });
  }

  test("the blade base is as wide as the petiole tip, so the join has no step", () => {
    const stemHalfWidth = 0.03;
    const pose = {
      x: 0,
      y: 0,
      angle: 0.4,
      blade: 0.4,
      petiole: 0.08,
      stemHalfWidth,
    };
    const geometry = generateLeaf(pose, leaf("None", "Ovate"));
    const outline = flattenCmds(geometry.outline);
    const first = outline[0]!;
    const last = outline.at(-1)!;
    const baseWidth = Math.hypot(first[0] - last[0], first[1] - last[1]);
    expect(baseWidth).toBeCloseTo(2 * branchTipHalfWidth(stemHalfWidth), 6);
    const bract = generateLeaf({ ...pose, petiole: 0 }, leaf("None", "Ovate"));
    const bractOutline = flattenCmds(bract.outline);
    expect(
      Math.hypot(
        bractOutline[0]![0] - bractOutline.at(-1)![0],
        bractOutline[0]![1] - bractOutline.at(-1)![1],
      ),
    ).toBeCloseTo(0, 6);
  });

  test("None draws no marks", () => {
    expect(
      generateLeaf(
        { x: 0, y: 0, angle: 0.5, blade: 0.4, petiole: 0, stemHalfWidth: 0.02 },
        leaf("None", "Ovate"),
      ).variegation,
    ).toEqual([]);
  });

  test("the plan carries the variegation color, translucency alpha and vein color", () => {
    const plan = createFlowerPlan(
      spec({
        foliage: {
          leaves: [
            {
              shape: "Ovate",
              color: gradient(0.2, 0.5, 0.2),
              translucency: 0.8,
              variegation: { kind: "Edge", color: rgb(0.95, 0.95, 0.7) },
            },
            {
              shape: "Ovate",
              color: gradient(0.2, 0.5, 0.2),
              translucency: 0.2,
            },
          ],
        },
      }),
      2,
    );
    const [glassy, plain] = plan.leaves;
    expect(glassy!.alpha).toBeCloseTo(1 - 0.8 * 0.45);
    expect(glassy!.variegation!.color).toBe(colorFromSpec(0.95, 0.95, 0.7));
    expect(glassy!.variegation!.cmds.length).toBeGreaterThan(0);
    expect(plain!.alpha).toBeCloseTo(1 - 0.2 * 0.45);
    expect(plain!.variegation).toBeNull();
    // A translucent leaf's veins read lighter than the blade, an opaque leaf's darker
    expect(glassy!.veinColor).toBeGreaterThan(glassy!.color);
    expect(plain!.veinColor).toBeLessThan(plain!.color);
  });
});

describe("stem surface", () => {
  const surface = (texture: SurfaceTexture, style: "Straight" | "Woody") =>
    generateStemSurface(
      stemAxis([0, 1], [0, 0], 0, style),
      0.05,
      texture,
      0x2d5a27,
      3,
    );

  test("a smooth straight stem has no surface detail", () => {
    expect(surface("Smooth", "Straight")).toEqual([]);
  });

  test("a Woody style draws bark lines", () => {
    const [bark] = surface("Smooth", "Woody");
    expect(bark!.strokes.length).toBeGreaterThan(0);
    expect(bark!.fills).toEqual([]);
    const xs = flattenCmds(bark!.strokes).map(([x]) => x);
    expect(Math.min(...xs)).toBeLessThan(0);
    expect(Math.max(...xs)).toBeGreaterThan(0);
  });

  const TEXTURED: SurfaceTexture[] = [
    "Hairy",
    "Fuzzy",
    "Scaled",
    "Rough",
    "Waxy",
    "Frosted",
    "Leathery",
  ];
  for (const texture of TEXTURED) {
    test(`${texture} adds detail over the stem`, () => {
      const layers = surface(texture, "Straight");
      expect(layers.length).toBe(1);
      expect(
        layers[0]!.strokes.length + layers[0]!.fills.length,
      ).toBeGreaterThan(0);
    });
  }

  test("every surface texture keeps its detail within the stem's length", () => {
    for (const texture of SURFACE_TEXTURES) {
      for (const layer of surface(texture, "Woody")) {
        const ys = flattenCmds([...layer.strokes, ...layer.fills]).map(
          ([, y]) => y,
        );
        expect(Math.min(...ys)).toBeGreaterThanOrEqual(-0.001);
        expect(Math.max(...ys)).toBeLessThanOrEqual(1.001);
      }
    }
  });

  test("the plan reads the surface from the stem", () => {
    const plan = createFlowerPlan(
      spec({ stem: { surface: "Hairy", style: "Woody" } }),
      3,
    );
    expect(plan.stem!.surface.length).toBe(2);
    expect(createFlowerPlan(spec(), 3).stem!.surface).toEqual([]);
  });
});
