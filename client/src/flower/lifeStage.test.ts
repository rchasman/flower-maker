import { describe, expect, test } from "bun:test";
import { LIFE_STAGES, type LifeStage } from "../data/flower-enums.ts";
import { colorFromSpec } from "./color.ts";
import { cmdsReach } from "./geometry.ts";
import { fadedCount, hasPappus } from "./lifeStage.ts";
import { createFlowerPlan, type FlowerPlan } from "./render.ts";
import { stemPointAt } from "./stem.ts";
import { flattenCmds } from "./test-helpers.ts";

const rgb = (r: number, g: number, b: number) => ({ r, g, b, a: 1 });
const gradient = (r: number, g: number, b: number) => ({
  stops: [{ position: 0, color: rgb(r, g, b) }],
});

type Overrides = {
  stage?: LifeStage;
  family?: string;
  buds?: unknown[];
  stem?: Record<string, unknown> | null;
};

function spec(o: Overrides = {}): string {
  return JSON.stringify({
    taxonomy: { family: o.family ?? "Rosaceae" },
    petals: {
      stage: o.stage ?? "Bloom",
      layers: [
        {
          count: 8,
          length: 1.2,
          width: 0.9,
          color: gradient(0.9, 0.2, 0.4),
          vein_pattern: "Branching",
        },
        { count: 5, length: 0.8, width: 0.7 },
      ],
    },
    reproductive: {
      stamens: Array.from({ length: 6 }, () => ({ height: 0.6 })),
      pollen: { particle_count: 8, dispersal: "Wind" },
    },
    structure: {
      sepals: [{ length: 0.5 }, { length: 0.5 }, { length: 0.5 }],
      ...(o.stem === null
        ? {}
        : { stem: { height: 0.8, thickness: 0.3, ...o.stem } }),
      buds: o.buds ?? [],
    },
  });
}

const SID = 7;
const plan = (o: Overrides = {}): FlowerPlan => createFlowerPlan(spec(o), SID);
const outerReach = (p: FlowerPlan): number =>
  Math.max(...(p.layers[0]?.petals.map(petal => cmdsReach(petal.cmds)) ?? [0]));
const saturation = (color: number): number => {
  const channels = [(color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff];
  return Math.max(...channels) - Math.min(...channels);
};

describe("life stage", () => {
  const bloom = plan();

  test("Bud draws one closed shell of three to five petals and hides the centre", () => {
    const bud = plan({ stage: "Bud" });
    expect(bud.center.stamens).toEqual([]);
    expect(bud.center.discRadius).toBe(0);
    expect(bud.layers).toHaveLength(1);
    const shell = bud.layers[0]!.petals;
    expect(shell.length).toBeGreaterThanOrEqual(3);
    expect(shell.length).toBeLessThanOrEqual(5);
    expect(outerReach(bud)).toBeLessThan(outerReach(bloom));
    expect(bud.particles.filter(p => p.kind === "Pollen")).toEqual([]);
  });

  test("the Bud shell stays inside its sepals", () => {
    const bud = plan({ stage: "Bud" });
    const sepalReach = Math.max(...bud.sepals.map(s => cmdsReach(s.cmds)));
    expect(outerReach(bud)).toBeLessThan(sepalReach);
    expect(outerReach(bloom)).toBeGreaterThan(
      Math.max(...bloom.sepals.map(s => cmdsReach(s.cmds))),
    );
  });

  test("Opening keeps the outer layer only, shorter than the bloom", () => {
    const opening = plan({ stage: "Opening" });
    expect(opening.layers).toHaveLength(1);
    expect(opening.layers[0]!.petals).toHaveLength(8);
    expect(outerReach(opening)).toBeLessThan(outerReach(bloom));
    expect(opening.center.stamens.length).toBe(bloom.center.stamens.length);
  });

  test("Bloom is unchanged: two layers, all petals, stamens and pollen", () => {
    expect(bloom.layers).toHaveLength(2);
    expect(bloom.layers.map(l => l.petals.length)).toEqual([8, 5]);
    expect(bloom.center.stamens).toHaveLength(6);
    expect(bloom.particles.filter(p => p.kind === "Pollen")).toHaveLength(8);
  });

  test("Fading lowers opacity, drops about a fifth of the petals and grays them", () => {
    const fading = plan({ stage: "Fading" });
    expect(fading.layers[0]!.opacity).toBeLessThan(bloom.layers[0]!.opacity);
    expect(fading.layers.map(l => l.petals.length)).toEqual([
      fadedCount(8),
      fadedCount(5),
    ]);
    expect(fadedCount(8)).toBe(6);
    expect(fadedCount(1)).toBe(1);
    expect(saturation(fading.layers[0]!.petals[0]!.color)).toBeLessThan(
      saturation(bloom.layers[0]!.petals[0]!.color),
    );
  });

  test("SeedHead has no petal layers and a receptacle larger than the bloom's", () => {
    const seedHead = plan({ stage: "SeedHead" });
    expect(seedHead.layers).toEqual([]);
    expect(seedHead.center.discRadius).toBeGreaterThan(bloom.center.discRadius);
    expect(seedHead.center.stamens).toEqual([]);
    expect(seedHead.center.seedHead).not.toBeNull();
    expect(seedHead.center.seedHead!.stipple.length).toBeGreaterThan(0);
    expect(bloom.center.seedHead).toBeNull();
  });

  test("disc families carry a pappus, every other family carries seed marks", () => {
    const aster = plan({ stage: "SeedHead", family: "Asteraceae" }).center
      .seedHead!;
    const rose = plan({ stage: "SeedHead", family: "Rosaceae" }).center
      .seedHead!;
    expect(hasPappus("Asteraceae")).toBe(true);
    expect(hasPappus("Apiaceae")).toBe(true);
    expect(hasPappus("Rosaceae")).toBe(false);
    expect(aster.strokes.length).toBeGreaterThan(0);
    expect(rose.strokes).toEqual([]);
    expect(rose.fills.length).toBeGreaterThan(0);
    expect(cmdsReach(aster.strokes)).toBeGreaterThan(aster.discRadius);
  });

  test("the pappus counts toward the head's reach", () => {
    const aster = plan({ stage: "SeedHead", family: "Asteraceae" });
    const rose = plan({ stage: "SeedHead", family: "Rosaceae" });
    expect(aster.bounds.maxX).toBeGreaterThan(rose.bounds.maxX);
  });

  test("an unknown stage falls back to Bloom", () => {
    const odd = createFlowerPlan(
      spec().replace('"stage":"Bloom"', '"stage":"Wilting"'),
      SID,
    );
    expect(odd.layers.map(l => l.petals.length)).toEqual([8, 5]);
  });

  for (const stage of LIFE_STAGES) {
    test(`${stage} builds a finite plan`, () => {
      const p = plan({ stage });
      expect(Number.isFinite(p.bounds.minX)).toBe(true);
      expect(Number.isFinite(p.bounds.maxY)).toBe(true);
    });
  }
});

describe("side buds", () => {
  const buds = [
    { position: 0.55, side: "Right", size: 0.4, openness: 0.2 },
    { position: 0.7, side: "Left", size: 0.3, openness: 0.8 },
    { position: 0.85, side: "Right", size: 0.2, openness: 0.5 },
  ];

  test("one bud per spec entry, none without a stem", () => {
    expect(plan({ buds }).buds).toHaveLength(3);
    expect(plan({ buds, stem: null }).buds).toEqual([]);
    expect(plan().buds).toEqual([]);
  });

  test("each pedicel starts on the stem at the bud's position", () => {
    const p = plan({ buds, stem: { curvature: 0.4 } });
    const axis = p.stem!.axis;
    const tolerance = p.stem!.halfWidth * 2;
    const gaps = p.buds.map((bud, i) => {
      const on = stemPointAt(axis, buds[i]!.position);
      return Math.min(
        ...flattenCmds(bud.pedicel).map(([x, y]) =>
          Math.hypot(x - on.x, y - on.y),
        ),
      );
    });
    expect(gaps).toHaveLength(3);
    expect(gaps.every(gap => gap <= tolerance)).toBe(true);
  });

  test("the shell sits on the named side of the stem and grows with size", () => {
    const p = plan({ buds });
    const axis = p.stem!.axis;
    const centreX = (cmds: FlowerPlan["buds"][number]["shell"]) => {
      const pts = flattenCmds(cmds);
      return pts.reduce((sum, [x]) => sum + x, 0) / pts.length;
    };
    const [right, left, small] = p.buds;
    expect(centreX(right!.shell)).toBeGreaterThan(stemPointAt(axis, 0.55).x);
    expect(centreX(left!.shell)).toBeLessThan(stemPointAt(axis, 0.7).x);
    const size = (cmds: FlowerPlan["buds"][number]["shell"]) => {
      const pts = flattenCmds(cmds);
      const xs = pts.map(([x]) => x);
      const ys = pts.map(([, y]) => y);
      return Math.hypot(
        Math.max(...xs) - Math.min(...xs),
        Math.max(...ys) - Math.min(...ys),
      );
    };
    expect(size(small!.shell)).toBeLessThan(size(right!.shell));
  });

  test("petal color shows only past openness 0.6, in the outer layer's base color", () => {
    const p = plan({ buds });
    expect(p.buds.map(b => b.petal.length > 0)).toEqual([false, true, false]);
    expect(p.buds[1]!.petalColor).toBe(colorFromSpec(0.9, 0.2, 0.4));
    expect(p.buds[1]!.shellColor).toBe(p.sepals[0]!.color);
  });

  test("a bud on the outside of a bowed stem widens the plan bounds", () => {
    const stem = { curvature: 1 };
    const bare = plan({ stem });
    const budded = plan({
      stem,
      buds: [{ position: 0.5, side: "Right", size: 1, openness: 0 }],
    });
    expect(budded.bounds.maxX).toBeGreaterThan(bare.bounds.maxX);
  });

  test("a spec without a stage is a Bloom, the Rust default", () => {
    const withoutStage = createFlowerPlan(
      spec().replace('"stage":"Bloom",', ""),
      SID,
    );
    expect(withoutStage.layers.map(l => l.petals.length)).toEqual([8, 5]);
  });
});
