import { describe, expect, test } from "bun:test";
import type { EdgeStyle } from "../data/flower-enums.ts";
import { createPetalFrame, type PetalFrame } from "./petal.ts";
import { COLUMNS, petalSurface, type PetalSurface } from "./surface.ts";

const frameOf = (
  o: {
    edge?: EdgeStyle;
    shape?: "Orbicular" | "Ligulate";
    width?: number;
    curvature?: number;
    curl?: number;
  } = {},
): PetalFrame =>
  createPetalFrame({
    angle: 0,
    shape: o.shape ?? "Orbicular",
    edge: o.edge ?? "Smooth",
    length: 1.5,
    width: o.width ?? 1.2,
    curvature: o.curvature ?? 0,
    curl: o.curl ?? 0,
    seed: 0.61,
  });

type Vertex = {
  /** across the blade, 1 at the left margin and -1 at the right */
  u: number;
  x: number;
  y: number;
  nx: number;
  ny: number;
  nz: number;
  t: number;
  thin: number;
};

const vertices = (s: PetalSurface): Vertex[] =>
  Array.from({ length: s.positions.length / 2 }, (_, i) => ({
    u: ((i % COLUMNS) / (COLUMNS - 1)) * 2 - 1,
    x: s.positions[i * 2]!,
    y: s.positions[i * 2 + 1]!,
    nx: s.normals[i * 3]!,
    ny: s.normals[i * 3 + 1]!,
    nz: s.normals[i * 3 + 2]!,
    t: s.surface[i * 2]!,
    thin: s.surface[i * 2 + 1]!,
  }));

/** Largest |slope| of the left margin's waves between t = from and t = to. */
const waveSlope = (frame: PetalFrame, from: number, to: number): number => {
  const last = frame.spine.length - 1;
  const lifts = frame.spine.map(s => s.leftLift);
  return lifts
    .slice(1)
    .map((lift, i) => ({
      t: (i + 1) / last,
      slope:
        Math.abs(lift - lifts[i]!) /
        (frame.spine[i + 1]!.along - frame.spine[i]!.along),
    }))
    .filter(s => s.t >= from && s.t <= to)
    .reduce((m, s) => Math.max(m, s.slope), 0);
};

describe("petal surface", () => {
  test("a flat petal faces the viewer everywhere", () => {
    const tilted = vertices(petalSurface(frameOf())).filter(v => v.nz < 0.999);
    expect(tilted).toEqual([]);
  });

  test("a cupped petal's margins tilt in toward its midrib", () => {
    // The petal points along +x, so its left margin (u = 1) lies toward +y:
    // there the normal leans back toward -y, and on the right toward +y.
    const cupped = vertices(petalSurface(frameOf({ curvature: 0.8 })));
    const band = cupped.filter(v => v.t > 0.3 && v.t < 0.7);
    const left = band.filter(v => v.u > 0.5);
    const right = band.filter(v => v.u < -0.5);
    expect(left.length).toBeGreaterThan(0);
    expect(left.every(v => v.ny < -0.05)).toBe(true);
    expect(right.every(v => v.ny > 0.05)).toBe(true);
  });

  test("a curled tip turns away from the viewer more than the blade does", () => {
    const curled = vertices(petalSurface(frameOf({ curl: 1 })));
    const tilt = (from: number, to: number) =>
      Math.min(...curled.filter(v => v.t >= from && v.t <= to).map(v => v.nz));
    expect(tilt(0.9, 1)).toBeLessThan(tilt(0.2, 0.5) - 0.1);
  });

  test("the blade is thickest at the base of the midrib and thinnest at the margins", () => {
    const vs = vertices(petalSurface(frameOf()));
    const base = vs.find(v => v.t === 0 && v.thin === 0);
    const margin = vs.filter(v => v.t > 0.4 && v.t < 0.6);
    expect(base).toBeDefined();
    expect(Math.max(...margin.map(v => v.thin))).toBeGreaterThan(0.7);
  });

  test("every index names a vertex", () => {
    const s = petalSurface(frameOf({ edge: "Crisped" }));
    const count = s.positions.length / 2;
    expect(Array.from(s.indices).every(i => i < count)).toBe(true);
    expect(s.indices.length % 3).toBe(0);
  });
});

describe("buckled margins", () => {
  const BUCKLED: EdgeStyle[] = ["Undulate", "Ruffled", "Crisped"];

  test("a flat edge does not buckle", () => {
    const frame = frameOf();
    expect(frame.spine.every(s => s.leftLift === 0 && s.rightLift === 0)).toBe(
      true,
    );
  });

  test("the margin's excess grows toward the tip, so its waves do too", () => {
    const growing = BUCKLED.filter(edge => {
      const frame = frameOf({ edge });
      return waveSlope(frame, 0.75, 1) > 2 * waveSlope(frame, 0, 0.3);
    });
    expect(growing).toEqual(BUCKLED);
  });

  test("more excess means steeper flanks: undulate < ruffled < crisped", () => {
    const steepest = BUCKLED.map(edge => waveSlope(frameOf({ edge }), 0, 1));
    expect(steepest).toEqual([...steepest].sort((a, b) => a - b));
    expect(steepest[0]).toBeGreaterThan(0);
  });

  test("a wide blade's margins buckle out of step; a narrow strap's move together", () => {
    const gap = (frame: PetalFrame) =>
      frame.spine.reduce(
        (m, s) => Math.max(m, Math.abs(s.leftLift - s.rightLift)),
        0,
      );
    const wide = frameOf({ edge: "Ruffled" });
    const strap = frameOf({ edge: "Ruffled", shape: "Ligulate", width: 0.4 });
    expect(gap(wide)).toBeGreaterThan(0.005);
    expect(gap(strap)).toBeLessThan(1e-9);
    expect(strap.coupling).toBe(1);
  });

  test("a buckled margin tilts the surface where its waves rise and fall", () => {
    const tilted = (edge: EdgeStyle) =>
      vertices(petalSurface(frameOf({ edge })))
        .filter(v => v.t > 0.6 && v.thin > 0.6)
        .reduce((m, v) => Math.max(m, 1 - v.nz), 0);
    expect(tilted("Smooth")).toBeLessThan(1e-6);
    expect(tilted("Ruffled")).toBeGreaterThan(0.02);
  });
});
