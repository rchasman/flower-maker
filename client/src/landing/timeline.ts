/**
 * The assembly line loop. Pure: the same time always yields the same transforms.
 * Frame coordinates are uv with y down. Sprites rotate about their plate's pivot.
 */

export const LOOP_SECONDS = 6;

export const SPRITE_IDS = [
  "belt",
  "arm-pick",
  "arm-wrap",
  "arm-handoff",
  "tulip",
  "bunch",
  "bouquet",
] as const;

export type SpriteId = (typeof SPRITE_IDS)[number];

export interface SpriteTransform {
  readonly id: SpriteId;
  /** Where the plate's pivot lands in the frame (uv). */
  readonly x: number;
  readonly y: number;
  /** Radians; positive turns the sprite counter-clockwise on screen. */
  readonly angle: number;
  /** Sprite height as a fraction of frame height. */
  readonly scale: number;
  /** 0..1 */
  readonly visible: number;
}

const STATION_X = [1 / 6, 1 / 2, 5 / 6] as const;
const BELT_Y = 0.72;
const ARM_BASE_Y = 0.92;
const ARM_BASE_DX = 0.12;
const ARM_SCALE = 0.62;
const PLATE_ASPECT = 1.5;
/** Gripper position in the arm plate, relative to its base pivot, in plate uv units. */
const GRIPPER_OFFSET = [-0.25, -0.75] as const;

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

type Point = readonly [number, number];

/** Rotate a y-down vector counter-clockwise on screen by `angle`. */
const rotate = ([dx, dy]: Point, angle: number): Point => [
  dx * Math.cos(angle) + dy * Math.sin(angle),
  -dx * Math.sin(angle) + dy * Math.cos(angle),
];

const gripperOf = (armX: number, angle: number): Point => {
  const offset: Point = [
    GRIPPER_OFFSET[0] * ARM_SCALE * PLATE_ASPECT,
    GRIPPER_OFFSET[1] * ARM_SCALE,
  ];
  const [dx, dy] = rotate(offset, angle);
  return [armX + dx, ARM_BASE_Y + dy];
};

const arm = (
  id: SpriteId,
  station: number,
  angle: number,
): SpriteTransform => ({
  id,
  x: STATION_X[station]! + ARM_BASE_DX,
  y: ARM_BASE_Y,
  angle,
  scale: ARM_SCALE,
  visible: 1,
});

/** Arm one dips to the tray across the loop seam (4.8 to 0.9) and is back up by 1.5. */
const pickAngle = (t: number) => deg(14) * present(t, 4.8, 5.4, 0.9, 1.5);

/** Arm two presses the paddle down over the belt around 3.5 seconds. */
const wrapAngle = (t: number) =>
  deg(-10) * (seg(t, 3.3, 3.7) - seg(t, 3.9, 4.3));

/** Arm three dips to the belt at 5.0, lifts by 6.0 and holds the bouquet out until 3.0. */
const handoffAngle = (t: number) =>
  deg(12) * (seg(t, 5.0, 5.4) - seg(t, 5.7, 6.0));

const belt: SpriteTransform = {
  id: "belt",
  x: 0.5,
  y: BELT_Y,
  angle: 0,
  scale: 0.34,
  visible: 1,
};

const tulip = (t: number, pickA: number): SpriteTransform => {
  const held = gripperOf(STATION_X[0]! + ARM_BASE_DX, pickA);
  const dropX = STATION_X[0]! - 0.08;
  const lowered = seg(t, 1.5, 1.9);
  const ride = seg(t, 1.9, 3.6);
  const x = lerp(lerp(held[0], dropX, lowered), STATION_X[1]!, ride);
  const y = lerp(held[1] + 0.04, BELT_Y - 0.03, lowered);
  return {
    id: "tulip",
    x,
    y,
    angle: 0,
    scale: 0.1,
    visible: present(t, 0.6, 0.9, 3.6, 3.9),
  };
};

const bunch = (t: number): SpriteTransform => ({
  id: "bunch",
  x: lerp(STATION_X[1]!, STATION_X[2]! - 0.1, seg(t, 3.9, 5.4)),
  y: BELT_Y - 0.06,
  angle: 0,
  scale: 0.16,
  visible: present(t, 3.6, 3.9, 5.4, 5.7),
});

const bouquet = (t: number, handoffA: number): SpriteTransform => {
  const [gx, gy] = gripperOf(STATION_X[2]! + ARM_BASE_DX, handoffA);
  return {
    id: "bouquet",
    x: gx,
    y: gy + 0.04,
    angle: 0,
    scale: 0.24,
    visible: present(t, 5.4, 5.7, 3.0, 3.4),
  };
};

export const timeline = (time: number): readonly SpriteTransform[] => {
  const t = wrap(time);
  const pickA = pickAngle(t);
  const handoffA = handoffAngle(t);
  return [
    belt,
    arm("arm-pick", 0, pickA),
    arm("arm-wrap", 1, wrapAngle(t)),
    arm("arm-handoff", 2, handoffA),
    tulip(t, pickA),
    bunch(t),
    bouquet(t, handoffA),
  ];
};
