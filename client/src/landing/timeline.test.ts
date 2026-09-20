import { describe, expect, test } from "bun:test";
import { plateIndex } from "./plates.ts";
import { armPoses, LOOP_SECONDS, SPRITE_COUNT, timeline } from "./timeline.ts";

const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
const deg = (d: number) => (d * Math.PI) / 180;
const SAMPLES = Array.from({ length: 121 }, (_, i) => (i / 120) * LOOP_SECONDS);

describe("timeline", () => {
  test("returns the belt, four links per arm and three items", () => {
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
        expect(Math.abs(pose.shoulder)).toBeLessThanOrEqual(deg(18));
        expect(Math.abs(pose.elbow)).toBeLessThanOrEqual(deg(45));
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

  test("stays in frame across the loop", () => {
    SAMPLES.map(t =>
      timeline(t).map(s => {
        expect(s.x).toBeGreaterThanOrEqual(-0.1);
        expect(s.x).toBeLessThanOrEqual(1.1);
        expect(s.y).toBeGreaterThanOrEqual(0);
        expect(s.y).toBeLessThanOrEqual(1);
        expect(s.visible).toBeGreaterThanOrEqual(0);
        expect(s.visible).toBeLessThanOrEqual(1);
        expect(s.scale).toBeGreaterThan(0);
      }),
    );
  });

  test("the elbow actually bends during the pick", () => {
    const rest = armPoses(4.0)[0];
    const reach = armPoses(0.5)[0];
    expect(near(rest.elbow, reach.elbow)).toBe(false);
    expect(near(rest.shoulder, reach.shoulder)).toBe(false);
  });

  test("is deterministic", () => {
    expect(timeline(2.5)).toEqual(timeline(2.5));
  });
});
