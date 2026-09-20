import { describe, expect, test } from "bun:test";
import { plateIndex } from "./plates.ts";
import { armPoses, LOOP_SECONDS, SPRITE_COUNT, timeline } from "./timeline.ts";

const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
const deg = (d: number) => (d * Math.PI) / 180;
const SAMPLES = Array.from({ length: 121 }, (_, i) => (i / 120) * LOOP_SECONDS);

describe("timeline", () => {
  test("returns the belt, four links per arm and two items", () => {
    const sprites = timeline(0);
    expect(sprites.length).toBe(SPRITE_COUNT);
    expect(sprites[0]!.tex).toBe(plateIndex("belt"));
    expect(sprites.filter(s => s.tex === plateIndex("arm-pick")).length).toBe(
      4,
    );
    expect(sprites.filter(s => s.tex === plateIndex("arm-wrap")).length).toBe(
      4,
    );
    expect(
      sprites.filter(s => s.tex === plateIndex("arm-handoff")).length,
    ).toBe(4);
  });

  test("loops: t=0 equals t=LOOP_SECONDS", () => {
    const start = timeline(0);
    const end = timeline(LOOP_SECONDS);
    start.map((s, i) => {
      const o = end[i]!;
      expect(near(s.x, o.x)).toBe(true);
      expect(near(s.y, o.y)).toBe(true);
      expect(near(s.angle, o.angle)).toBe(true);
      expect(near(s.visible, o.visible)).toBe(true);
    });
  });

  test("bases never turn and joints stay within their ranges", () => {
    SAMPLES.map(t => {
      armPoses(t).map(pose => {
        expect(Math.abs(pose.shoulder)).toBeLessThanOrEqual(deg(30));
        expect(Math.abs(pose.elbow)).toBeLessThanOrEqual(deg(55));
        expect(Math.abs(pose.wrist)).toBeLessThanOrEqual(deg(15));
      });
      const bases = timeline(t).filter(
        s =>
          s.cutA.normal[0] === 0 &&
          s.cutA.normal[1] === 0 &&
          s.cutB.normal[0] !== 0,
      );
      expect(bases.length).toBe(3);
      bases.map(base => expect(base.angle).toBe(0));
    });
  });

  test("stays near the frame across the loop", () => {
    SAMPLES.map(t =>
      timeline(t).map(s => {
        if (s.visible > 0) {
          expect(s.x).toBeGreaterThanOrEqual(-0.4);
          expect(s.x).toBeLessThanOrEqual(1.2);
        }
        expect(s.y).toBeGreaterThanOrEqual(0);
        expect(s.y).toBeLessThanOrEqual(1);
        expect(s.visible).toBeGreaterThanOrEqual(0);
        expect(s.visible).toBeLessThanOrEqual(1);
        expect(s.scale).toBeGreaterThan(0);
      }),
    );
  });

  test("the elbow actually bends during the pick", () => {
    const rest = armPoses(0.5)[0];
    const reach = armPoses(1.5)[0];
    expect(near(rest.elbow, reach.elbow)).toBe(false);
    expect(near(rest.shoulder, reach.shoulder)).toBe(false);
  });

  test("is deterministic", () => {
    expect(timeline(2.5)).toEqual(timeline(2.5));
  });
});

describe("belt continuity", () => {
  test("the tulip rides the belt and only leaves the belt while the first gripper holds it", () => {
    const tulipAt = (t: number) =>
      timeline(t).find(s => s.tex === plateIndex("tulip"))!;
    expect(tulipAt(0).x).toBeGreaterThan(1);
    expect(tulipAt(1.0).x).toBeCloseTo(0.85, 1);
    expect(tulipAt(3.6).x).toBeCloseTo(0.49, 1);
    expect(tulipAt(1.7).y).toBeLessThan(tulipAt(1.0).y);
  });

  test("the bunch takes over exactly where the tulip was, is offered upright and taken", () => {
    const bunchAt = (t: number) =>
      timeline(t).find(s => s.tex === plateIndex("bunch"))!;
    const tulipAt = (t: number) =>
      timeline(t).find(s => s.tex === plateIndex("tulip"))!;
    expect(bunchAt(4.15).x).toBeCloseTo(tulipAt(4.15).x, 5);
    expect(bunchAt(4.15).visible + tulipAt(4.15).visible).toBeCloseTo(1, 5);
    expect(bunchAt(5.9).x).toBeCloseTo(0.13, 1);
    expect(bunchAt(8.5).y).toBeLessThan(bunchAt(5.9).y);
    expect(bunchAt(8.5).angle).toBeCloseTo((-55 * Math.PI) / 180, 5);
    expect(bunchAt(8.5).scale).toBeGreaterThan(bunchAt(5.9).scale);
    expect(bunchAt(9.8).visible).toBe(0);
    expect(bunchAt(0.5).visible).toBe(0);
  });
});

describe("depth", () => {
  test("flowers ride behind the arms and the bunch comes in front only while the last arm holds it", () => {
    const tulipAt = (t: number) =>
      timeline(t).find(s => s.tex === plateIndex("tulip"))!;
    const bunchAt = (t: number) =>
      timeline(t).find(s => s.tex === plateIndex("bunch"))!;
    const armZ = timeline(0).find(s => s.tex === plateIndex("arm-pick"))!.z;
    expect(tulipAt(1.7).z).toBeLessThan(armZ);
    expect(tulipAt(4.1).z).toBeLessThan(armZ);
    expect(bunchAt(5.9).z).toBeLessThan(armZ);
    expect(bunchAt(6.2).z).toBeLessThan(armZ);
    expect(bunchAt(7.0).z).toBeGreaterThan(armZ);
    expect(bunchAt(8.6).z).toBeGreaterThan(armZ);
  });
});
