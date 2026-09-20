/**
 * The assembly line loop. Pure: the same time always yields the same sprites.
 * Frame coordinates are uv with y down. One tulip enters on the belt from the right, is lifted
 * and checked by the first arm, wrapped under the second arm's paddle, carried up by the third
 * and leaves to the left. Arms are rigged: joint angles become link sprites and gripper positions.
 */

import { PLATES, plateIndex, type Point } from "./plates.ts";
import {
  armLinks,
  armTip,
  NO_CUT,
  REST,
  type ArmPlacement,
  type ArmPose,
  type SpriteTransform,
} from "./rig.ts";

export const LOOP_SECONDS = 10;
/** Width over height of the frame the transforms are laid out for. */
export const DEFAULT_FRAME_ASPECT = 16 / 9;

/** The belt runs right to left along the bottom of the frame; the copy lives above it. */
const STATION_X = [0.85, 0.49, 0.13] as const;
const BELT_Y = 0.8;
const ARM_BASE_Y = 0.98;
const ARM_SCALE = 0.42;
/** Where an item rests on the belt surface. */
const ITEM_Y = BELT_Y - 0.035;
/** Where the tulip starts, just off the right edge. */
const ENTRY_X = 1.15;

const ARM_IDS = ["arm-pick", "arm-wrap", "arm-handoff"] as const;
const ARM_PLATES = ARM_IDS.map(id => PLATES[plateIndex(id)]!);
/** Base offsets put each arm's rest gripper over its station; the paddle reaches further left. */
const ARM_BASE_DX = [0.07, 0.13, 0.07] as const;
const PLACEMENTS: readonly ArmPlacement[] = STATION_X.map((x, i) => ({
  x: x + ARM_BASE_DX[i]!,
  y: ARM_BASE_Y,
  scale: ARM_SCALE,
}));

const clamp01 = (u: number) => Math.min(1, Math.max(0, u));
const ease = (u: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp01(u));
/** 0 before `from`, eased to 1 by `to`, 1 after. */
const seg = (t: number, from: number, to: number) =>
  ease((t - from) / (to - from));
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const deg = (d: number) => (d * Math.PI) / 180;
const wrap = (t: number) => ((t % LOOP_SECONDS) + LOOP_SECONDS) % LOOP_SECONDS;

const pose = (shoulder: number, elbow: number, wrist: number): ArmPose => ({
  shoulder: deg(shoulder),
  elbow: deg(elbow),
  wrist: deg(wrist),
});

const mixPose = (a: ArmPose, b: ArmPose, u: number): ArmPose => ({
  shoulder: lerp(a.shoulder, b.shoulder, u),
  elbow: lerp(a.elbow, b.elbow, u),
  wrist: lerp(a.wrist, b.wrist, u),
});

type Keyframe = readonly [number, ArmPose];

/**
 * Eased interpolation through keyframes sorted by time. The first keyframe must sit at 0 and the
 * last at LOOP_SECONDS with the same pose, so the loop closes.
 */
const track = (t: number, keys: readonly Keyframe[]): ArmPose => {
  const next = keys.findIndex(([time]) => time > t);
  if (next <= 0) return keys[keys.length - 1]![1];
  const [fromTime, fromPose] = keys[next - 1]!;
  const [toTime, toPose] = keys[next]!;
  return mixPose(fromPose, toPose, seg(t, fromTime, toTime));
};

/** Poses were fitted with a grid search over the rig so each gripper lands on its target. */
/** Gripper down on the tulip at station one. */
const PICK_DOWN = pose(-22, 44, 0);
/** Tulip lifted for a look. */
const PICK_UP = pose(-9, 8, 0);
/** Paddle pressed onto the tulip at station two. */
const PRESS = pose(-10, 28, 6);
/** Gripper down on the wrapped bunch at station three. */
const GRAB_DOWN = pose(-28, 50, 0);
/** Bunch lifted clear of the belt. */
const GRAB_UP = pose(-11, 4, 0);
/** Arm extended up and toward the viewer, offering the bunch. */
const OFFER = pose(-17, -24, -2);

/**
 * The belt moves in four eased runs and stands still while an arm works. Everything on the
 * belt, including the shader's stripes, follows this travel, so nothing slides under a gripper.
 */
const BELT_RUNS: readonly (readonly [number, number, number])[] = [
  [0, 1.0, 0.3],
  [2.4, 3.6, 0.36],
  [4.7, 5.9, 0.36],
];

/** Distance the belt has carried since the loop started. */
export const beltTravel = (t: number): number =>
  BELT_RUNS.reduce(
    (sum, [from, to, distance]) => sum + distance * seg(t, from, to),
    0,
  );

const PICK_TRACK: readonly Keyframe[] = [
  [0, REST],
  [1.0, REST],
  [1.5, PICK_DOWN],
  [1.9, PICK_UP],
  [2.0, PICK_UP],
  [2.4, PICK_DOWN],
  [2.9, REST],
  [LOOP_SECONDS, REST],
];

const WRAP_TRACK: readonly Keyframe[] = [
  [0, REST],
  [3.6, REST],
  [4.0, PRESS],
  [4.3, PRESS],
  [4.7, REST],
  [LOOP_SECONDS, REST],
];

const HANDOFF_TRACK: readonly Keyframe[] = [
  [0, REST],
  [5.9, REST],
  [6.3, GRAB_DOWN],
  [6.7, GRAB_UP],
  [8.0, OFFER],
  [9.2, OFFER],
  [LOOP_SECONDS, REST],
];

/** Joint angles of the three arms at time `t`. */
export const armPoses = (
  time: number,
): readonly [ArmPose, ArmPose, ArmPose] => {
  const t = wrap(time);
  return [track(t, PICK_TRACK), track(t, WRAP_TRACK), track(t, HANDOFF_TRACK)];
};

const item = (
  id: "tulip" | "bunch",
  [x, y]: Point,
  scale: number,
  visible: number,
  angle = 0,
): SpriteTransform => ({
  tex: plateIndex(id),
  x,
  y,
  pivot: PLATES[plateIndex(id)]!.pivot,
  angle,
  scale,
  visible,
  cutA: NO_CUT,
  cutB: NO_CUT,
});

const belt: SpriteTransform = {
  tex: plateIndex("belt"),
  x: 0.5,
  y: BELT_Y,
  pivot: PLATES[plateIndex("belt")]!.pivot,
  angle: 0,
  scale: 1.19,
  visible: 1,
  cutA: NO_CUT,
  cutB: NO_CUT,
};

/** Held objects hang a little below the gripper tip. */
const HELD_DROP = 0.02;

const tip = (arm: number, armPose: ArmPose, frameAspect: number): Point =>
  armTip(ARM_PLATES[arm]!, PLACEMENTS[arm]!, armPose, frameAspect);

/** The tulip rides in from the right, is lifted at station one, and is wrapped at station two. */
const tulip = (t: number, pickPose: ArmPose, frameAspect: number) => {
  const onBelt: Point = [ENTRY_X - beltTravel(t), ITEM_Y];
  const held = t >= 1.5 && t < 2.4;
  const [gx, gy] = tip(0, pickPose, frameAspect);
  const position: Point = held ? [gx, gy + HELD_DROP] : onBelt;
  return item("tulip", position, 0.22, 1 - seg(t, 4.05, 4.25));
};

/** How far the bunch turns upright while it is offered, so the blooms face the viewer. */
const OFFER_TURN = deg(-90);
/** How much the bunch grows as it comes toward the viewer. */
const OFFER_GROWTH = 1.5;

/**
 * The bunch appears under the paddle where the tulip was and rides to station three. The third
 * arm lifts it, turns it upright and holds it out to the viewer, who takes it; by then a new
 * tulip is already on its way in.
 */
const bunch = (t: number, handoffPose: ArmPose, frameAspect: number) => {
  const onBelt: Point = [
    STATION_X[1] - (beltTravel(t) - beltTravel(4.05)),
    ITEM_Y,
  ];
  const held = t >= 6.3;
  const [gx, gy] = tip(2, handoffPose, frameAspect);
  const offered = seg(t, 6.8, 8.0);
  const position: Point = held ? [gx, gy + HELD_DROP * (1 + offered)] : onBelt;
  const scale = 0.26 * lerp(1, OFFER_GROWTH, offered);
  const visible = seg(t, 4.05, 4.25) - seg(t, 9.2, 9.6);
  return item("bunch", position, scale, visible, OFFER_TURN * offered);
};

export const timeline = (
  time: number,
  frameAspect: number = DEFAULT_FRAME_ASPECT,
): readonly SpriteTransform[] => {
  const t = wrap(time);
  const poses = armPoses(t);
  return [
    belt,
    ...ARM_PLATES.flatMap((plate, i) =>
      armLinks(
        plate,
        plateIndex(ARM_IDS[i]!),
        PLACEMENTS[i]!,
        poses[i]!,
        frameAspect,
      ),
    ),
    tulip(t, poses[0], frameAspect),
    bunch(t, poses[2], frameAspect),
  ];
};

export const SPRITE_COUNT = 1 + ARM_IDS.length * 4 + 2;
export type { SpriteTransform } from "./rig.ts";
