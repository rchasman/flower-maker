import { describe, expect, test } from "bun:test";
import { PLATES, plateIndex } from "./plates.ts";
import { armLinks, armTip, jointPositions, PLATE_ASPECT, REST } from "./rig.ts";

const ARM = PLATES[plateIndex("arm-pick")]!;
const PLACEMENT = { x: 0.5, y: 0.9, scale: 0.5 };
const ASPECT = 16 / 9;
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

describe("rig", () => {
  test("at rest, joints land where the plate puts them", () => {
    const joints = ARM.joints!;
    const positions = jointPositions(ARM, PLACEMENT, REST, ASPECT);
    positions.map((p, k) => {
      const expectedX =
        PLACEMENT.x +
        ((joints[k]![0] - joints[0]![0]) * PLACEMENT.scale * PLATE_ASPECT) /
          ASPECT;
      const expectedY =
        PLACEMENT.y + (joints[k]![1] - joints[0]![1]) * PLACEMENT.scale;
      expect(near(p[0], expectedX)).toBe(true);
      expect(near(p[1], expectedY)).toBe(true);
    });
  });

  test("bending the elbow moves the tip but not the elbow or anything below it", () => {
    const rest = jointPositions(ARM, PLACEMENT, REST, ASPECT);
    const bent = jointPositions(
      ARM,
      PLACEMENT,
      { ...REST, elbow: 0.3 },
      ASPECT,
    );
    [0, 1, 2].map(k => {
      expect(near(rest[k]![0], bent[k]![0])).toBe(true);
      expect(near(rest[k]![1], bent[k]![1])).toBe(true);
    });
    expect(
      near(rest[4]![0], bent[4]![0]) && near(rest[4]![1], bent[4]![1]),
    ).toBe(false);
    expect(armTip(ARM, PLACEMENT, { ...REST, elbow: 0.3 }, ASPECT)).toEqual(
      bent[4],
    );
  });

  test("the base link never turns and links rotate about their own joint", () => {
    const pose = { shoulder: 0.1, elbow: 0.2, wrist: -0.1 };
    const links = armLinks(ARM, 1, PLACEMENT, pose, ASPECT);
    expect(links.length).toBe(4);
    expect(links[0]!.angle).toBe(0);
    expect(links[1]!.angle).toBeCloseTo(0.1);
    expect(links[2]!.angle).toBeCloseTo(0.3);
    expect(links[3]!.angle).toBeCloseTo(0.2);
    links.map((link, k) => expect(link.pivot).toEqual(ARM.joints![k]!));
  });

  test("the base has no cut above it and the gripper none below", () => {
    const links = armLinks(ARM, 1, PLACEMENT, REST, ASPECT);
    expect(links[0]!.cutA.normal).toEqual([0, 0]);
    expect(links[3]!.cutB.normal).toEqual([0, 0]);
    expect(Math.hypot(...links[1]!.cutA.normal)).toBeCloseTo(1);
    expect(Math.hypot(...links[1]!.cutB.normal)).toBeCloseTo(1);
  });
});
