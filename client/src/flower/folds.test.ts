import { describe, expect, test } from "bun:test";
import { PETAL_SHAPES, type EdgeStyle } from "../data/flower-enums.ts";
import { generatePetalFolds } from "./folds.ts";
import { createPetalFrame, generatePetal, type PetalFrame } from "./petal.ts";
import { flattenCmds, pointInPolygon } from "./test-helpers.ts";

const BUCKLED: EdgeStyle[] = ["Undulate", "Ruffled", "Crisped"];

const POSES = [
  { curvature: 0, curl: 0, length: 0.5, width: 0.5, radialOffset: 1 },
  { curvature: 0.7, curl: 0, length: 1.5, width: 1.2, radialOffset: 0.8 },
  { curvature: -0.6, curl: 0.25, length: 2.0, width: 0.8, radialOffset: 1 },
];

const frameOf = (
  edge: EdgeStyle,
  shape: "Orbicular" | "Ligulate" = "Orbicular",
  width = 1.2,
): PetalFrame =>
  createPetalFrame({
    angle: 0.4,
    shape,
    edge,
    length: 1.5,
    width,
    curvature: 0,
    curl: 0,
    seed: 0.61,
  });

/** Largest |slope| of the left margin over the stations with t in [from, to]. */
const slopeBetween = (frame: PetalFrame, from: number, to: number): number => {
  const last = frame.spine.length - 1;
  return frame.spine
    .filter((_, i) => i / last >= from && i / last <= to)
    .reduce((m, s) => Math.max(m, Math.abs(s.leftSlope)), 0);
};

describe("buckled margins", () => {
  test("a flat edge has no slope and casts no folds", () => {
    const frame = frameOf("Smooth");
    expect(slopeBetween(frame, 0, 1)).toBe(0);
    expect(generatePetalFolds(frame, 1)).toEqual([]);
  });

  test("the margin's excess grows toward the tip, so its waves do too", () => {
    const frames = BUCKLED.map(edge => frameOf(edge));
    const growing = frames.filter(
      frame => slopeBetween(frame, 0.75, 1) > 2 * slopeBetween(frame, 0, 0.3),
    );
    expect(growing.length).toBe(BUCKLED.length);
  });

  test("more excess means steeper flanks: undulate < ruffled < crisped", () => {
    const steepest = BUCKLED.map(edge => slopeBetween(frameOf(edge), 0, 1));
    expect(steepest).toEqual([...steepest].sort((a, b) => a - b));
    expect(steepest[0]).toBeGreaterThan(0);
  });

  test("a wide blade's margins buckle out of step; a narrow strap's move together", () => {
    const wide = frameOf("Ruffled", "Orbicular");
    const strap = frameOf("Ruffled", "Ligulate", 0.4);
    const gap = (frame: PetalFrame) =>
      frame.spine.reduce(
        (m, s) => Math.max(m, Math.abs(s.leftSlope - s.rightSlope)),
        0,
      );
    expect(gap(wide)).toBeGreaterThan(0.05);
    expect(gap(strap)).toBeLessThan(1e-9);
  });

  test("a buckled petal casts both light and shade lobes", () => {
    const shades = generatePetalFolds(frameOf("Ruffled"), 1).map(f => f.shade);
    expect(shades.some(s => s < 0)).toBe(true);
    expect(shades.some(s => s > 0)).toBe(true);
  });

  test("every fold vertex is inside the petal outline", () => {
    const outside = PETAL_SHAPES.flatMap(shape =>
      BUCKLED.flatMap(edge =>
        POSES.flatMap(pose => {
          const frame = createPetalFrame({
            angle: 1.1,
            shape,
            edge,
            seed: 0.37,
            ...pose,
          });
          const polygon = flattenCmds(generatePetal(frame));
          return generatePetalFolds(frame, 0.3)
            .flatMap(fold => flattenCmds(fold.cmds))
            .filter(point => !pointInPolygon(point, polygon))
            .map(point => ({ shape, edge, ...pose, point }));
        }),
      ),
    );
    expect(outside).toEqual([]);
  });
});
