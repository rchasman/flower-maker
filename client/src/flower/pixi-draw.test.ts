import { describe, expect, test } from "bun:test";
import { Graphics } from "pixi.js";
import type { DrawCmd } from "./geometry.ts";
import { createFlowerPlan } from "./render.ts";
import {
  DETAIL_RADIUS,
  SHADING_RADIUS,
  drawFlowerFromPlan,
  fillCmds,
  petalPassesFor,
  strokeCmds,
} from "./pixi-draw.ts";

const TRIANGLE: DrawCmd[] = [
  { op: "M", x: 0, y: 0 },
  { op: "L", x: 1, y: 0 },
  { op: "L", x: 0, y: 1 },
  { op: "Z" },
];

/** A Graphics whose last instruction is a stroked triangle, the shape an empty fill would repaint. */
function afterStrokedTriangle(): Graphics {
  const g = new Graphics();
  strokeCmds(g, TRIANGLE, { color: 0x112233, width: 1 }, 10);
  return g;
}

describe("fillCmds and strokeCmds", () => {
  test("a non-empty path adds one instruction", () => {
    const g = afterStrokedTriangle();
    expect(g.context.instructions.length).toBe(1);
    fillCmds(g, TRIANGLE, { color: 0xabcdef }, 10);
    expect(g.context.instructions.length).toBe(2);
    expect(g.context.instructions[1]!.action).toBe("fill");
  });

  test("an empty path adds nothing instead of refilling the previous shape", () => {
    const g = afterStrokedTriangle();
    fillCmds(g, [], { color: 0xabcdef }, 10);
    strokeCmds(g, [], { color: 0xabcdef, width: 1 }, 10);
    expect(g.context.instructions.length).toBe(1);
  });
});

describe("petalPassesFor", () => {
  const full = {
    texture: true,
    veins: true,
    marks: true,
    gradient: true,
    depthShadow: true,
  };

  test("a flower at or above the detail radius gets every pass", () => {
    expect(petalPassesFor(70)).toEqual(full);
    expect(petalPassesFor(DETAIL_RADIUS)).toEqual(full);
  });

  test("below the detail radius the texture, veins and marks go", () => {
    expect(petalPassesFor(DETAIL_RADIUS - 1)).toEqual({
      ...full,
      texture: false,
      veins: false,
      marks: false,
    });
    expect(petalPassesFor(SHADING_RADIUS)).toEqual({
      ...full,
      texture: false,
      veins: false,
      marks: false,
    });
  });

  test("below the shading radius the gradient partials and depth shadows go too", () => {
    expect(petalPassesFor(SHADING_RADIUS - 1)).toEqual({
      texture: false,
      veins: false,
      marks: false,
      gradient: false,
      depthShadow: false,
    });
  });

  test("a small flower records fewer instructions than the same plan drawn large", () => {
    const plan = createFlowerPlan(
      JSON.stringify({
        petals: {
          layers: [
            {
              count: 6,
              length: 1.2,
              width: 0.9,
              texture: "Velvet",
              color: {
                stops: [
                  { position: 0, color: { r: 0.9, g: 0.3, b: 0.4, a: 1 } },
                  { position: 1, color: { r: 1, g: 0.9, b: 0.5, a: 1 } },
                ],
              },
            },
          ],
        },
        reproductive: { stamens: [] },
        structure: { stem: { height: 0.8, thickness: 0.3 }, sepals: [] },
      }),
      3,
    );
    const count = (r: number): number => {
      const g = new Graphics();
      drawFlowerFromPlan(g, plan, r, 1);
      return g.context.instructions.length;
    };
    expect(count(DETAIL_RADIUS - 1)).toBeLessThan(count(DETAIL_RADIUS));
    expect(count(SHADING_RADIUS - 1)).toBeLessThan(count(SHADING_RADIUS));
  });
});
