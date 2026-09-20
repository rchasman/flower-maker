import { describe, expect, test } from "bun:test";
import { LOOP_SECONDS, SPRITE_IDS, timeline } from "./timeline.ts";

const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
const MAX_ARM_ANGLE = (16 * Math.PI) / 180;

describe("timeline", () => {
  test("returns one transform per sprite in SPRITE_IDS order", () => {
    expect(timeline(0).map(s => s.id)).toEqual([...SPRITE_IDS]);
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

  test("stays in frame and within arm angle bounds across the loop", () => {
    Array.from({ length: 121 }, (_, i) => (i / 120) * LOOP_SECONDS).map(t =>
      timeline(t).map(s => {
        expect(s.x).toBeGreaterThanOrEqual(-0.1);
        expect(s.x).toBeLessThanOrEqual(1.1);
        expect(s.y).toBeGreaterThanOrEqual(0);
        expect(s.y).toBeLessThanOrEqual(1);
        expect(Math.abs(s.angle)).toBeLessThanOrEqual(MAX_ARM_ANGLE);
        expect(s.visible).toBeGreaterThanOrEqual(0);
        expect(s.visible).toBeLessThanOrEqual(1);
        expect(s.scale).toBeGreaterThan(0);
      }),
    );
  });

  test("is deterministic", () => {
    expect(timeline(2.5)).toEqual(timeline(2.5));
  });

  test("something is always moving: transforms differ between nearby times", () => {
    const a = timeline(1.0);
    const b = timeline(1.1);
    const moved = a.some((s, i) => {
      const o = b[i]!;
      return !near(s.x, o.x) || !near(s.y, o.y) || !near(s.angle, o.angle);
    });
    expect(moved).toBe(true);
  });
});
