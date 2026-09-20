/**
 * The assembly line loop. Pure: the same time always yields the same sprites.
 * Frame coordinates are uv with y down. Arms are rigged: the timeline drives joint angles and
 * the rig turns them into link sprites and gripper positions.
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

export const LOOP_SECONDS = 6;
/** Width over height of the frame the transforms are laid out for. */
export const DEFAULT_FRAME_ASPECT = 16 / 9;

/** The belt runs right to left, so every arm works the belt on its left: pick, wrap, hand off. */
const STATION_X = [0.78, 0.5, 0.22] as const;
const BELT_Y = 0.66;
const ARM_BASE_Y = 0.86;
const ARM_BASE_DX = 0.06;
const ARM_SCALE = 0.48;

const ARM_IDS = ["arm-pick", "arm-wrap", "arm-handoff"] as const;
const ARM_PLATES = ARM_IDS.map(id => PLATES[plateIndex(id)]!);
const PLACEMENTS: readonly ArmPlacement[] = STATION_X.map(x => ({
  x: x + ARM_BASE_DX,
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

/**
 * 1 while something is present: fades in over [inFrom, inTo], out over [outFrom, outTo].
 * When the window straddles the loop seam (inFrom > outFrom) the early part of the loop
 * counts as still present, so t=0 and t=LOOP_SECONDS agree.
 */
const present = (
  t: number,
  inFrom: number,
  inTo: number,
  outFrom: number,
  outTo: number,
) => {
  if (inFrom <= outFrom) return seg(t, inFrom, inTo) - seg(t, outFrom, outTo);
  if (t < outTo) return 1 - seg(t, outFrom, outTo);
  return seg(t, inFrom, inTo);
};

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
/** Reaching down to the tray below the belt: shoulder leans out, elbow folds. */
const REACH = pose(16, 30, -6);
/** Setting the tulip down on the belt, a little higher than the tray. */
const PLACE = pose(14, 12, -4);
/** Paddle pressed down onto the belt. */
const PRESS = pose(-4, 21, 6);
/** Dipping to the belt to grab the bunch. */
const GRAB = pose(16, 17, -6);
/** Holding the bouquet up and out. */
const HOLD = pose(14, -32, 4);

const PICK_TRACK: readonly Keyframe[] = [
  [0, REACH],
  [0.9, REACH],
  [1.5, REST],
  [2.1, PLACE],
  [2.6, PLACE],
  [3.4, REST],
  [4.8, REST],
  [5.4, REACH],
  [LOOP_SECONDS, REACH],
];

const WRAP_TRACK: readonly Keyframe[] = [
  [0, REST],
  [3.4, REST],
  [3.9, PRESS],
  [4.3, PRESS],
  [4.8, REST],
  [LOOP_SECONDS, REST],
];

const HANDOFF_TRACK: readonly Keyframe[] = [
  [0, GRAB],
  [0.2, GRAB],
  [0.8, HOLD],
  [3.0, HOLD],
  [3.6, REST],
  [5.4, REST],
  [5.8, GRAB],
  [LOOP_SECONDS, GRAB],
];

const TRACKS = [PICK_TRACK, WRAP_TRACK, HANDOFF_TRACK] as const;

/** Joint angles of the three arms at time `t` (already wrapped into the loop). */
export const armPoses = (
  time: number,
): readonly [ArmPose, ArmPose, ArmPose] => {
  const t = wrap(time);
  return [track(t, PICK_TRACK), track(t, WRAP_TRACK), track(t, HANDOFF_TRACK)];
};

const item = (
  id: "tulip" | "bunch" | "bouquet",
  [x, y]: Point,
  scale: number,
  visible: number,
): SpriteTransform => ({
  tex: plateIndex(id),
  x,
  y,
  pivot: PLATES[plateIndex(id)]!.pivot,
  angle: 0,
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
  scale: 0.95,
  visible: 1,
  cutA: NO_CUT,
  cutB: NO_CUT,
};

/** Held objects hang a little below the gripper tip. */
const HELD_DROP = 0.03;

const tulip = (t: number, pickPose: ArmPose, frameAspect: number) => {
  const held = armTip(ARM_PLATES[0]!, PLACEMENTS[0]!, pickPose, frameAspect);
  const released = armTip(ARM_PLATES[0]!, PLACEMENTS[0]!, PLACE, frameAspect);
  const ride = seg(t, 2.6, 4.0);
  const onBelt = t >= 2.6 && t < 4.3;
  const x = onBelt ? lerp(released[0], STATION_X[1], ride) : held[0];
  const y = onBelt
    ? lerp(released[1] + HELD_DROP, BELT_Y - 0.04, seg(t, 2.6, 2.9))
    : held[1] + HELD_DROP;
  return item("tulip", [x, y], 0.2, present(t, 0.6, 0.9, 3.9, 4.2));
};

const bunch = (t: number) =>
  item(
    "bunch",
    [lerp(STATION_X[1], STATION_X[2] + 0.08, seg(t, 4.3, 5.6)), BELT_Y - 0.05],
    0.2,
    present(t, 4.0, 4.3, 5.5, 5.8),
  );

const bouquet = (t: number, handoffPose: ArmPose, frameAspect: number) => {
  const [x, y] = armTip(
    ARM_PLATES[2]!,
    PLACEMENTS[2]!,
    handoffPose,
    frameAspect,
  );
  return item("bouquet", [x, y + 0.06], 0.24, present(t, 5.6, 5.9, 3.0, 3.4));
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
    bunch(t),
    bouquet(t, poses[2], frameAspect),
  ];
};

export const SPRITE_COUNT = 1 + ARM_IDS.length * 4 + 3;
export type { SpriteTransform } from "./rig.ts";
