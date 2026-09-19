import { describe, expect, test } from "bun:test";
import {
  INFLORESCENCE_KINDS,
  type InflorescenceKind,
} from "../data/flower-enums.ts";
import { cmdsBounds } from "./geometry.ts";
import {
  SOLITARY_LAYOUT,
  layoutInflorescence,
  type InflorescenceParams,
} from "./inflorescence.ts";
import { createFlowerPlan } from "./render.ts";
import { generateStem, stemAxis, type StemPlan } from "./stem.ts";

const HALF_WIDTH = 0.05;
const PRIMARY_FLORET = SOLITARY_LAYOUT.florets[0];

function straightStem(length = 1.2): StemPlan {
  const axis = stemAxis([0, length], [0, 0], 0, "Straight");
  return {
    cmds: generateStem(axis, HALF_WIDTH),
    color: 0x2d5a27,
    thorns: [],
    axis,
    halfWidth: HALF_WIDTH,
    surface: [],
    branches: [],
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
    headRadius: 0.45,
    sid: 7,
    ...overrides,
  });

const MULTI_HEAD_KINDS = INFLORESCENCE_KINDS.filter(
  kind => kind !== "Solitary" && kind !== "Spray",
);
const PEDICEL_KINDS: readonly InflorescenceKind[] = [
  ...MULTI_HEAD_KINDS.filter(kind => kind !== "Spike"),
  "Spray",
];
const LEVEL_KINDS: readonly InflorescenceKind[] = ["Umbel", "Corymb"];

describe("layoutInflorescence", () => {
  test("Solitary is always one head with no pedicels", () => {
    for (const headCount of [1, 4, 9]) {
      const { florets, pedicels } = layout("Solitary", headCount);
      expect(florets).toEqual([PRIMARY_FLORET]);
      expect(pedicels).toEqual([]);
    }
  });

  for (const kind of MULTI_HEAD_KINDS) {
    test(`${kind} draws head_count heads, the primary first at the origin`, () => {
      for (const headCount of [1, 2, 5, 8]) {
        const { florets } = layout(kind, headCount);
        expect(florets.length).toBe(headCount);
        expect(florets[0]).toEqual(PRIMARY_FLORET);
      }
    });
  }

  test("head_count clamps to 12", () => {
    expect(layout("Raceme", 40).florets.length).toBe(12);
  });

  test("Umbel and Corymb heads are level with the primary", () => {
    for (const kind of LEVEL_KINDS) {
      const offsets = layout(kind, 6).florets.map(f => f.offsetY);
      expect(offsets.every(y => Math.abs(y) < 1e-9)).toBe(true);
    }
  });

  test("Spike heads sit on the axis below the primary, without stalks", () => {
    const { florets, pedicels } = layout("Spike", 7);
    const secondaries = florets.slice(1);
    expect(secondaries.every(f => Math.abs(f.offsetX) < 1e-9)).toBe(true);
    expect(secondaries.every(f => f.offsetY > 0)).toBe(true);
    expect(pedicels).toEqual([]);
  });

  test("Spray has 3 to 5 heads with the primary on top", () => {
    for (const requested of [1, 3, 4, 5, 9]) {
      const { florets } = layout("Spray", requested);
      expect(florets.length).toBeGreaterThanOrEqual(3);
      expect(florets.length).toBeLessThanOrEqual(5);
      expect(florets[0]).toEqual(PRIMARY_FLORET);
      expect(florets.slice(1).every(f => f.offsetY > 0)).toBe(true);
    }
  });

  test("secondary heads take head_scale, with a floor so they stay visible", () => {
    expect(layout("Umbel", 4, { headScale: 0.7 }).florets[1]!.scale).toBe(0.7);
    expect(layout("Umbel", 4, { headScale: 0 }).florets[1]!.scale).toBe(0.2);
  });

  for (const kind of PEDICEL_KINDS) {
    test(`${kind} pedicels reach every secondary head`, () => {
      const { florets, pedicels } = layout(kind, 5);
      const box = cmdsBounds(pedicels);
      expect(box).not.toBeNull();
      for (const f of florets.slice(1)) {
        expect(f.offsetX).toBeGreaterThanOrEqual(box!.minX - HALF_WIDTH);
        expect(f.offsetX).toBeLessThanOrEqual(box!.maxX + HALF_WIDTH);
        expect(f.offsetY).toBeGreaterThanOrEqual(box!.minY - HALF_WIDTH);
        expect(f.offsetY).toBeLessThanOrEqual(box!.maxY + HALF_WIDTH);
      }
    });
  }

  test("heads never drop below the stem base", () => {
    const stem = straightStem(0.6);
    for (const kind of MULTI_HEAD_KINDS) {
      const { florets } = layout(kind, 12, { stem });
      expect(florets.every(f => f.offsetY <= stem.axis.fromY)).toBe(true);
    }
  });

  test("Panicle keeps its pyramid under the primary on a short stem", () => {
    const { florets } = layout("Panicle", 6, { stem: straightStem(0.6) });
    expect(florets.slice(1).every(f => f.offsetY > 0)).toBe(true);
  });

  test("spread pushes heads farther from the axis", () => {
    const reach = (spread: number) =>
      Math.max(
        ...layout("Umbel", 5, { spread }).florets.map(f => Math.abs(f.offsetX)),
      );
    expect(reach(1)).toBeGreaterThan(reach(0));
  });

  test("is deterministic and the seed picks the first side", () => {
    for (const kind of MULTI_HEAD_KINDS) {
      expect(layout(kind, 5)).toEqual(layout(kind, 5));
    }
    const firstSide = (sid: number) =>
      Math.sign(layout("Raceme", 3, { sid }).florets[1]!.offsetX);
    const sides = new Set(
      Array.from({ length: 12 }, (_, sid) => firstSide(sid)),
    );
    expect(sides).toEqual(new Set([-1, 1]));
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

  test("reads kind, head_count, head_scale and spread", () => {
    const plan = createFlowerPlan(
      specWith({ kind: "Umbel", head_count: 4, head_scale: 0.6, spread: 0.3 }),
      3,
    );
    expect(plan.florets.length).toBe(4);
    expect(plan.florets[1]!.scale).toBe(0.6);
    expect(plan.pedicels.length).toBeGreaterThan(0);
  });

  test("bounds contain every floret and the stem", () => {
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
    }
    expect(maxY).toBeGreaterThanOrEqual(plan.stem!.axis.fromY);
    expect(minY).toBeLessThan(0);
  });

  test("a missing inflorescence is solitary", () => {
    const plan = createFlowerPlan(specWith(null), 3);
    expect(plan.florets).toEqual([PRIMARY_FLORET]);
    expect(plan.pedicels).toEqual([]);
  });

  test("without a stem there is nothing to attach to, so the head is solitary", () => {
    const plan = createFlowerPlan(
      specWith({ kind: "Spike", head_count: 5 }, null),
      3,
    );
    expect(plan.florets).toEqual([PRIMARY_FLORET]);
  });
});
