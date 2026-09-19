import { describe, expect, test } from "bun:test";
import type { DrawCmd } from "./geometry.ts";
import { generateStem, stemAxis, stemPointAt } from "./stem.ts";

const HALF_WIDTH = 0.05;

/** The outline's two mid stations are the bezier control point pushed out to each edge. */
function controlPoint(outline: readonly DrawCmd[]): [number, number] {
  const left = outline[1];
  const right = outline[4];
  if (left?.op !== "C" || right?.op !== "C") {
    throw new Error("outline is not the standard two-curve stem");
  }
  return [(left.x + right.x) / 2, (left.y + right.y) / 2];
}

describe("stemAxis", () => {
  test("an Arching stem's axis point at 0.5 lies on the drawn midline", () => {
    const axis = stemAxis([0, 1.2], [0, 0], 0.3, "Arching");
    const [midX, midY] = controlPoint(
      generateStem(axis, HALF_WIDTH, "Arching"),
    );
    const onCurveX = 0.25 * axis.fromX + 0.5 * midX + 0.25 * axis.toX;
    const onCurveY = 0.25 * axis.fromY + 0.5 * midY + 0.25 * axis.toY;
    const p = stemPointAt(axis, 0.5);
    expect(p.x).toBeCloseTo(onCurveX, 6);
    expect(p.y).toBeCloseTo(onCurveY, 6);
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
