import { describe, expect, test } from "bun:test";
import {
  gardenBed,
  setCanvasViewport,
  toCanvasPosition,
  toServerPosition,
} from "./bridge.ts";

describe("garden bed positions", () => {
  test("a position dropped on the canvas comes back where it was dropped", () => {
    const viewports: [number, number][] = [
      [800, 600],
      [1502, 812],
      [390, 844],
    ];
    const drifted = viewports.flatMap(([w, h]) => {
      setCanvasViewport(w, h);
      return [
        [12.5, 3],
        [50, 50],
        [99, 87.25],
      ].flatMap(([cx, cy]) => {
        const [x, y] = toCanvasPosition(cx!, cy!);
        const [backX, backY] = toServerPosition(x, y);
        return Math.abs(backX - cx!) < 1e-6 && Math.abs(backY - cy!) < 1e-6
          ? []
          : [{ w, h, cx, cy, backX, backY }];
      });
    });
    expect(drifted).toEqual([]);
  });

  test("every server position stands a plant inside the bed", () => {
    setCanvasViewport(1502, 812);
    const bed = gardenBed();
    const corners = [
      [0, 0],
      [100, 100],
    ].map(([cx, cy]) => toCanvasPosition(cx!, cy!));
    expect(corners).toEqual([
      [bed.left, bed.top],
      [bed.right, bed.bottom],
    ]);
    expect(bed.top).toBeGreaterThan(812 * 0.3);
  });
});
