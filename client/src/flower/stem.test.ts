import { describe, expect, test } from "bun:test";
import { STEM_STYLES } from "../data/flower-enums.ts";
import type { Vec2 } from "./geometry.ts";
import {
  branch,
  branchHalfWidthAt,
  branchPointAt,
  branchTipHeading,
  generateStem,
  stemAxis,
  stemPointAt,
  stemTipHeading,
} from "./stem.ts";
import { flattenCmds } from "./test-helpers.ts";

const HALF_WIDTH = 0.05;

/**
 * Signed distances from `p` along the unit direction `dir` to the nearest
 * outline crossing on each side. Null when the outline does not cross on
 * both sides, so `p` is not between two edges.
 */
function edgeOffsets(
  outline: readonly Vec2[],
  p: { x: number; y: number },
  dir: Vec2,
): { left: number; right: number } | null {
  const crossings = outline.flatMap((a, i) => {
    const b = outline[(i + 1) % outline.length]!;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const denom = dx * dir[1] - dy * dir[0];
    if (Math.abs(denom) < 1e-12) return [];
    const u = ((p.x - a[0]) * dir[1] - (p.y - a[1]) * dir[0]) / denom;
    if (u < 0 || u > 1) return [];
    const x = a[0] + u * dx - p.x;
    const y = a[1] + u * dy - p.y;
    return [x * dir[0] + y * dir[1]];
  });
  const left = crossings.filter(s => s > 0);
  const right = crossings.filter(s => s < 0);
  if (left.length === 0 || right.length === 0) return null;
  return { left: Math.min(...left), right: Math.max(...right) };
}

describe("stemAxis", () => {
  test("an Arching stem's axis point at 0.5 lies on the drawn midline", () => {
    const axis = stemAxis([0, 1.2], [0, 0], 0.3, "Arching");
    const outline = flattenCmds(generateStem(axis, HALF_WIDTH));
    const p = stemPointAt(axis, 0.5);
    const offsets = edgeOffsets(outline, p, [
      Math.cos(p.angle),
      Math.sin(p.angle),
    ]);
    expect(offsets).not.toBeNull();
    expect(offsets!.left + offsets!.right).toBeCloseTo(0, 3);
  });

  test("a Trailing stem bends away from the raw curvature", () => {
    const raw = stemAxis([0, 1.2], [0, 0], 0.3, "Straight");
    const trailing = stemAxis([0, 1.2], [0, 0], 0.3, "Trailing");
    expect(trailing.curvature).toBeLessThanOrEqual(-0.2);
    expect(stemPointAt(trailing, 0.5).x).not.toBeCloseTo(
      stemPointAt(raw, 0.5).x,
      3,
    );
  });
});

describe("stemPointAt is on the drawn stem", () => {
  const LENGTH = 1.4;
  const CURVATURES = [0, 0.5, -0.4];
  const STATIONS = [0.2, 0.5, 0.8];
  /** allowed off-centre drift, as a fraction of the local drawn width */
  const CENTRE_TOLERANCE = 0.1;

  for (const style of STEM_STYLES) {
    for (const curvature of CURVATURES) {
      test(`${style} at curvature ${curvature}`, () => {
        const axis = stemAxis([0, LENGTH], [0, 0], curvature, style);
        const outline = flattenCmds(generateStem(axis, HALF_WIDTH));
        for (const t of STATIONS) {
          const p = stemPointAt(axis, t);
          const offsets = edgeOffsets(outline, p, [
            Math.cos(p.angle),
            Math.sin(p.angle),
          ]);
          expect(offsets).not.toBeNull();
          const width = offsets!.left - offsets!.right;
          expect(width).toBeGreaterThan(0);
          expect(Math.abs(offsets!.left + offsets!.right)).toBeLessThan(
            width * CENTRE_TOLERANCE,
          );
        }
      });
    }
  }
});

describe("tip bend", () => {
  test("the tip stays on `to` while its tangent turns to the bend", () => {
    const bent = stemAxis([0, 1.6], [0, 0], 0, "Straight", 0.15);
    expect(stemTipHeading(bent)).toBeCloseTo(0.15, 6);
    const tip = stemPointAt(bent, 1);
    expect(tip.x).toBeCloseTo(0, 9);
    expect(tip.y).toBeCloseTo(0, 9);
    const straight = stemAxis([0, 1.6], [0, 0], 0, "Straight");
    expect(stemTipHeading(straight)).toBe(0);
    expect(stemPointAt(bent, 0.5).x).not.toBeCloseTo(0, 3);
  });

  test("a branch ends exactly where it was told to, facing the way it was told", () => {
    const b = branch([0, 1], [0, -1], [0.5, 0.6], [1, 0], 0.03);
    const tip = branchPointAt(b, 1);
    expect(tip.x).toBeCloseTo(0.5, 9);
    expect(tip.y).toBeCloseTo(0.6, 9);
    expect(branchTipHeading(b)).toBeCloseTo(Math.PI / 2, 6);
    expect(branchHalfWidthAt(b, 0)).toBeCloseTo(0.03, 9);
    expect(branchHalfWidthAt(b, 0.5)).toBeLessThan(0.03 * 0.6);
    expect(branchHalfWidthAt(b, 1)).toBeLessThan(branchHalfWidthAt(b, 0.5));
  });
});
