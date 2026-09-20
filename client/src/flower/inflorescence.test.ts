import { describe, expect, test } from "bun:test";
import {
  INFLORESCENCE_KINDS,
  LIFE_STAGES,
  type InflorescenceKind,
  type LifeStage,
} from "../data/flower-enums.ts";
import { cmdsBounds } from "./geometry.ts";
import {
  headCountFor,
  layoutInflorescence,
  solitaryLayout,
  type Floret,
  type InflorescenceParams,
} from "./inflorescence.ts";
import { createFlowerPlan } from "./render.ts";
import { generateStem, stemAxis, stemShading, type StemPlan } from "./stem.ts";
import { flattenCmds } from "./test-helpers.ts";

const LENGTH = 1.6;
const HALF_WIDTH = 0.025;
const HEAD_RADIUS = 0.45;

function straightStem(length = LENGTH, curvature = 0): StemPlan {
  const axis = stemAxis([0, length], [0, 0], curvature, "Straight");
  return {
    cmds: generateStem(axis, HALF_WIDTH),
    color: 0x2d5a27,
    thorns: [],
    axis,
    halfWidth: HALF_WIDTH,
    surface: [],
    shading: stemShading(axis, HALF_WIDTH),
  };
}

const layout = (
  kind: InflorescenceKind,
  headCount: number,
  overrides: Partial<InflorescenceParams> = {},
) =>
  layoutInflorescence({
    kind,
    headCount,
    headScale: 0.5,
    spread: 0.5,
    stem: straightStem(),
    headRadius: HEAD_RADIUS,
    stage: "Bloom",
    sid: 7,
    ...overrides,
  });

const MULTI_HEAD_KINDS = INFLORESCENCE_KINDS.filter(
  kind => kind !== "Solitary",
);
const STALKED_KINDS = MULTI_HEAD_KINDS.filter(kind => kind !== "Spike");
const AXIAL_KINDS: readonly InflorescenceKind[] = ["Spike", "Raceme"];

/** The floret's drawn diameter in plan units, for a bloom head of HEAD_RADIUS. */
const diameterOf = (f: Floret): number => 2 * HEAD_RADIUS * f.scale;

/** The stalk's end point and its arriving heading, read from the last outline station. */
function stalkEnd(f: Floret): { x: number; y: number; heading: number } {
  if (!f.stalk) throw new Error("floret has no stalk");
  const left = flattenCmds(f.stalk.edges.slice(0, 9));
  const right = flattenCmds(f.stalk.edges.slice(9));
  const tipL = left.at(-1)!;
  const tipR = right.at(-1)!;
  const beforeL = left.at(-2)!;
  const beforeR = right.at(-2)!;
  const x = (tipL[0] + tipR[0]) / 2;
  const y = (tipL[1] + tipR[1]) / 2;
  const tx = x - (beforeL[0] + beforeR[0]) / 2;
  const ty = y - (beforeL[1] + beforeR[1]) / 2;
  return { x, y, heading: Math.atan2(tx, -ty) };
}

const stageRank = (stage: LifeStage): number => LIFE_STAGES.indexOf(stage);

describe("layoutInflorescence", () => {
  test("headCountFor keeps Solitary at one, Spray at three to five and clamps the rest", () => {
    expect(headCountFor("Solitary", 9)).toBe(1);
    expect(headCountFor("Spray", 1)).toBe(3);
    expect(headCountFor("Spray", 9)).toBe(5);
    expect(headCountFor("Spike", 40)).toBe(20);
    expect(headCountFor("Corymb", 40)).toBe(24);
  });

  for (const kind of MULTI_HEAD_KINDS) {
    test(`${kind} draws its florets, the mature ones at least half, up to the stem tip`, () => {
      for (const headCount of [3, 5, 8]) {
        const { florets } = layout(kind, headCount);
        const heads = florets.filter(f => f.stage === "Bloom").length;
        expect(heads).toBeGreaterThanOrEqual(
          Math.floor(headCountFor(kind, headCount) / 2),
        );
        expect(Math.min(...florets.map(f => f.offsetY))).toBeLessThanOrEqual(
          1e-9,
        );
      }
    });

    test(`${kind} florets are all 0.12 to 0.20 stem lengths across, the head size class aside`, () => {
      const jitter = 1.15;
      for (const headScale of [0, 1]) {
        const { florets } = layout(kind, 8, { headScale });
        const target = LENGTH * (0.12 + 0.08 * headScale);
        for (const f of florets.filter(f => f.stage === "Bloom")) {
          const size = diameterOf(f) / (f.back ? 0.9 : 1);
          expect(size).toBeLessThanOrEqual(target * jitter + 1e-9);
          expect(size).toBeGreaterThanOrEqual((target / jitter) * 0.5);
        }
      }
    });
  }

  for (const kind of STALKED_KINDS) {
    test(`${kind}: every pedicel ends on its floret and the floret faces along it`, () => {
      const { florets } = layout(kind, 8);
      const stalked = florets.filter(f => f.stalk !== null);
      expect(stalked.length).toBeGreaterThan(0);
      for (const f of stalked) {
        const end = stalkEnd(f);
        expect(Math.hypot(end.x - f.offsetX, end.y - f.offsetY)).toBeLessThan(
          0.02 * LENGTH,
        );
        const turn = Math.atan2(
          Math.sin(f.angle - end.heading),
          Math.cos(f.angle - end.heading),
        );
        expect(Math.abs(turn)).toBeLessThan((3 + 6) * (Math.PI / 180));
      }
    });
  }

  test("Spike florets are sessile, on both sides of the axis, packed on its upper half", () => {
    const { florets } = layout("Spike", 12);
    expect(florets.every(f => f.stalk === null)).toBe(true);
    expect(florets.some(f => f.offsetX > 0.01)).toBe(true);
    expect(florets.some(f => f.offsetX < -0.01)).toBe(true);
    expect(Math.max(...florets.map(f => f.offsetY))).toBeLessThan(
      0.6 * LENGTH + 0.01,
    );
    expect(Math.max(...florets.map(f => f.offsetY))).toBeGreaterThan(
      0.4 * LENGTH,
    );
  });

  for (const kind of AXIAL_KINDS) {
    test(`${kind} has buds at the top and blooms at the bottom`, () => {
      const { florets } = layout(kind, 12);
      const byHeight = florets.toSorted((a, b) => a.offsetY - b.offsetY);
      expect(byHeight[0]!.stage).toBe("Bud");
      expect(byHeight.at(-1)!.stage).toBe("Bloom");
      const ranks = byHeight.map(f => stageRank(f.stage));
      expect(ranks.every((r, i) => i === 0 || r >= ranks[i - 1]!)).toBe(true);
      expect(new Set(florets.map(f => f.stage))).toEqual(
        new Set(["Bud", "Opening", "Bloom"]),
      );
    });

    test(`${kind} at a Bud or SeedHead stage keeps every floret at that stage`, () => {
      for (const stage of ["Bud", "SeedHead"] as const) {
        const { florets } = layout(kind, 8, { stage });
        expect(florets.every(f => f.stage === stage)).toBe(true);
      }
    });
  }

  test("Raceme pedicels alternate sides up the axis and lower florets sit farther out", () => {
    const { florets } = layout("Raceme", 8);
    const byHeight = florets.toSorted((a, b) => a.offsetY - b.offsetY);
    const sides = byHeight.map(f => Math.sign(f.offsetX));
    expect(sides.every((s, i) => i === 0 || s !== sides[i - 1])).toBe(true);
    const top = Math.abs(byHeight[1]!.offsetX);
    const bottom = Math.abs(byHeight.at(-1)!.offsetX);
    expect(bottom).toBeGreaterThan(top);
  });

  test("Umbel heads lie on a dome: the farther from the axis, the lower", () => {
    const { florets } = layout("Umbel", 9);
    const front = florets.filter(f => !f.back);
    const byOut = front.toSorted(
      (a, b) => Math.abs(a.offsetX) - Math.abs(b.offsetX),
    );
    const ys = byOut.map(f => f.offsetY);
    expect(ys.every((y, i) => i === 0 || y >= ys[i - 1]! - 1e-9)).toBe(true);
    expect(ys.at(-1)!).toBeGreaterThan(ys[0]!);
  });

  test("Umbel stalks all fan from the stem tip", () => {
    const { florets } = layout("Umbel", 9);
    for (const f of florets) {
      const start = flattenCmds(f.stalk!.fill)[0]!;
      expect(Math.hypot(start[0], start[1])).toBeLessThan(HALF_WIDTH * 1.5);
    }
  });

  test("a Corymb is a filled hemisphere: a third of the heads lie inside 0.6 of the radius, the outline is lumpy, the front centre is largest and drawn last", () => {
    for (const count of [9, 12, 16, 24]) {
      const { florets } = layout("Corymb", count);
      const hub = { x: 0, y: -0.04 * LENGTH };
      const dist = (f: Floret) =>
        Math.hypot(f.offsetX - hub.x, f.offsetY - hub.y);
      const radius = Math.max(...florets.map(dist));
      const inside = florets.filter(f => dist(f) < 0.6 * radius);
      expect(inside.length * 3).toBeGreaterThanOrEqual(count);
      const bands = new Set(
        florets.map(f => Math.round((dist(f) / radius) * 5)),
      );
      expect(bands.size).toBeGreaterThanOrEqual(3);
      const byDist = florets.toSorted((a, b) => dist(a) - dist(b));
      const centre = byDist[0]!;
      const rim = byDist.at(-1)!;
      expect(centre.depth).toBeLessThan(rim.depth);
      expect(centre.back).toBe(false);
      expect(rim.back).toBe(true);
      expect(rim.scale).toBeLessThan(centre.scale);
      expect(Math.min(...florets.map(f => f.offsetY))).toBeLessThan(
        hub.y - 0.5 * radius,
      );
    }
  });

  test("Corymb stalks show for at most half a floret diameter under their heads", () => {
    const { florets } = layout("Corymb", 12);
    for (const f of florets) {
      const pts = flattenCmds(f.stalk!.fill);
      const root = pts[0]!;
      const shown = Math.hypot(root[0] - f.offsetX, root[1] - f.offsetY);
      expect(shown).toBeLessThanOrEqual(
        (0.5 * diameterOf(f)) / 0.85 / 0.8 / (f.back ? 0.9 : 1) + 1e-6,
      );
    }
  });

  test("Panicle has three to five branches, each carrying florets, shorter toward the top", () => {
    const { florets, branches } = layout("Panicle", 10);
    expect(branches.length).toBeGreaterThanOrEqual(3);
    expect(branches.length).toBeLessThanOrEqual(5);
    const widths = branches.map(b => {
      const box = cmdsBounds(b.fill)!;
      return { top: box.minY, width: box.maxX - box.minX };
    });
    const byHeight = widths.toSorted((a, b) => a.top - b.top);
    expect(byHeight[0]!.width).toBeLessThan(byHeight.at(-1)!.width);
    expect(florets.length).toBe(10);
  });

  test("Spray has a nodding head at every branch tip and a bud behind it", () => {
    const { florets, branches } = layout("Spray", 4);
    expect(branches.length).toBe(3);
    const heads = florets.filter(f => f.stage === "Bloom");
    const buds = florets.filter(f => f.stage === "Bud");
    expect(heads.length).toBe(4);
    expect(buds.length).toBe(3);
    for (const head of heads.filter(f => f.stalk !== null)) {
      expect(Math.abs(head.angle)).toBeGreaterThan(Math.PI * 0.25);
    }
  });

  test("back florets are smaller than front ones of the same stage", () => {
    const { florets } = layout("Spike", 16);
    const mean = (fs: readonly Floret[]) =>
      fs.reduce((sum, f) => sum + f.scale, 0) / fs.length;
    const bloom = florets.filter(f => f.stage === "Bloom");
    expect(mean(bloom.filter(f => f.back))).toBeLessThan(
      mean(bloom.filter(f => !f.back)),
    );
  });

  test("heads never drop below the stem base", () => {
    const stem = straightStem(1.2);
    for (const kind of MULTI_HEAD_KINDS) {
      const { florets } = layout(kind, 12, { stem });
      expect(florets.every(f => f.offsetY <= stem.axis.fromY)).toBe(true);
    }
  });

  test("spread pushes heads farther from the axis", () => {
    const reach = (spread: number) =>
      Math.max(
        ...layout("Umbel", 9, { spread }).florets.map(f => Math.abs(f.offsetX)),
      );
    expect(reach(1)).toBeGreaterThan(reach(0));
  });

  test("is deterministic and the seed picks the first side", () => {
    for (const kind of MULTI_HEAD_KINDS) {
      expect(layout(kind, 5)).toEqual(layout(kind, 5));
    }
    const firstSide = (sid: number) =>
      Math.sign(
        layout("Raceme", 3, { sid }).florets.toSorted(
          (a, b) => b.offsetY - a.offsetY,
        )[0]!.offsetX,
      );
    const sides = new Set(
      Array.from({ length: 12 }, (_, sid) => firstSide(sid)),
    );
    expect(sides).toEqual(new Set([-1, 1]));
  });

  test("a solitary head leans the way the stem tip does", () => {
    const stem = straightStem(LENGTH, 0.3);
    const { florets } = solitaryLayout(stem, 1, "Bloom");
    expect(florets.length).toBe(1);
    expect(florets[0].angle).not.toBe(0);
    expect(solitaryLayout(null, 1, "Bloom").florets[0].angle).toBe(0);
  });
});

describe("createFlowerPlan inflorescence", () => {
  const DEFAULT_STEM = { height: 0.8, thickness: 0.3 };
  const specWith = (
    inflorescence: Record<string, unknown> | null,
    stem: Record<string, unknown> | null = DEFAULT_STEM,
  ) =>
    JSON.stringify({
      petals: { layers: [{ count: 5, length: 1.2, width: 1 }] },
      reproductive: { stamens: [{ height: 0.5 }] },
      structure: { sepals: [], ...(stem ? { stem } : {}) },
      ...(inflorescence ? { inflorescence } : {}),
    });

  test("reads kind and head_count and builds one head per stage and depth", () => {
    const plan = createFlowerPlan(
      specWith({ kind: "Spike", head_count: 12, head_scale: 0.6, spread: 0.3 }),
      3,
    );
    expect(plan.florets.length).toBe(12);
    expect(plan.heads[0].stage).toBe("Bloom");
    expect(plan.heads[0].back).toBe(false);
    const keys = new Set(plan.heads.map(h => `${h.stage}:${h.back}`));
    expect(keys.size).toBe(plan.heads.length);
    for (const f of plan.florets) {
      const head = plan.heads[f.head]!;
      expect(head.stage).toBe(f.stage);
      expect(head.back).toBe(f.back);
    }
    expect(plan.heads.some(h => h.stage === "Bud")).toBe(true);
  });

  test("bounds contain every floret, every stalk and the stem", () => {
    const plan = createFlowerPlan(
      specWith({ kind: "Raceme", head_count: 6, head_scale: 0.5, spread: 1 }),
      3,
    );
    const { minX, minY, maxX, maxY } = plan.bounds;
    for (const f of plan.florets) {
      expect(f.offsetX).toBeGreaterThan(minX);
      expect(f.offsetX).toBeLessThan(maxX);
      expect(f.offsetY).toBeGreaterThan(minY);
      expect(f.offsetY).toBeLessThan(maxY);
      for (const [x, y] of flattenCmds(f.stalk?.fill ?? [])) {
        expect(x).toBeGreaterThanOrEqual(minX);
        expect(x).toBeLessThanOrEqual(maxX);
        expect(y).toBeGreaterThanOrEqual(minY);
        expect(y).toBeLessThanOrEqual(maxY);
      }
    }
    expect(maxY).toBeGreaterThanOrEqual(plan.stem!.axis.fromY);
    expect(minY).toBeLessThan(0);
  });

  test("a missing inflorescence is solitary", () => {
    const plan = createFlowerPlan(specWith(null), 3);
    expect(plan.florets.length).toBe(1);
    expect(plan.florets[0].stalk).toBeNull();
    expect(plan.branches).toEqual([]);
  });

  test("without a stem there is nothing to attach to, so the head is solitary and upright", () => {
    const plan = createFlowerPlan(
      specWith({ kind: "Spike", head_count: 5 }, null),
      3,
    );
    expect(plan.florets.length).toBe(1);
    expect(plan.florets[0].angle).toBe(0);
    expect(plan.florets[0].scale).toBe(1);
  });
});
