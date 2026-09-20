import { describe, expect, test } from "bun:test";
import { Graphics } from "pixi.js";
import type { DrawCmd } from "./geometry.ts";
import { fillCmds, strokeCmds } from "./pixi-draw.ts";

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
