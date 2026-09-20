import { armJoints, type Plate, type Point } from "./plates.ts";

/** Joint angles in radians. Positive turns a link counter-clockwise on screen. */
export interface ArmPose {
  readonly shoulder: number;
  readonly elbow: number;
  readonly wrist: number;
}

export const REST: ArmPose = { shoulder: 0, elbow: 0, wrist: 0 };

/** A half-plane in plate uv. Pixels with dot(uv - point, normal) < 0 are cut away. A zero normal cuts nothing. */
export interface Cut {
  readonly point: Point;
  readonly normal: Point;
}

export const NO_CUT: Cut = { point: [0, 0], normal: [0, 0] };

export interface SpriteTransform {
  /** Index into PLATES: which texture this sprite samples. */
  readonly tex: number;
  /** Where `pivot` lands in the frame (uv, y down). */
  readonly x: number;
  readonly y: number;
  /** Rotation centre in plate uv. */
  readonly pivot: Point;
  /** Radians; positive turns the sprite counter-clockwise on screen. */
  readonly angle: number;
  /** Sprite height as a fraction of frame height. */
  readonly scale: number;
  /** 0..1 */
  readonly visible: number;
  /** Painter's order: higher draws in front. */
  readonly z: number;
  readonly cutA: Cut;
  readonly cutB: Cut;
}

/** Depth layers of the scene, back to front. */
export const Z = {
  belt: 0,
  onBelt: 1,
  arm: 2,
  held: 3,
} as const;

/** Where an arm's base flange sits in frame uv and how tall the whole plate is. */
export interface ArmPlacement {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
}

/** Width over height of the arm plates. */
export const PLATE_ASPECT = 1.5;
/** Cuts sit this far past a joint centre so the round joint housing stays with the parent link. */
const JOINT_RADIUS = 0.045;

/** Rotate a y-down vector counter-clockwise on screen by `angle`. */
export const rotate = ([dx, dy]: Point, angle: number): Point => [
  dx * Math.cos(angle) + dy * Math.sin(angle),
  -dx * Math.sin(angle) + dy * Math.cos(angle),
];

const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]];
const add = (a: Point, b: Point): Point => [a[0] + b[0], a[1] + b[1]];
const scaleBy = (v: Point, k: number): Point => [v[0] * k, v[1] * k];
const normalize = (v: Point): Point => {
  const length = Math.hypot(v[0], v[1]);
  return length === 0 ? [0, 0] : [v[0] / length, v[1] / length];
};

/** Cumulative link angles, base to gripper. The base never turns. */
const linkAngles = (
  pose: ArmPose,
): readonly [number, number, number, number] => [
  0,
  pose.shoulder,
  pose.shoulder + pose.elbow,
  pose.shoulder + pose.elbow + pose.wrist,
];

/** Frame-uv position of every joint after posing: forward kinematics down the chain. */
export const jointPositions = (
  plate: Plate,
  placement: ArmPlacement,
  pose: ArmPose,
  frameAspect: number,
): readonly [Point, Point, Point, Point, Point] => {
  const joints = armJoints(plate);
  const angles = linkAngles(pose);
  const size: Point = [placement.scale * PLATE_ASPECT, placement.scale];
  const step = (from: Point, k: number): Point => {
    const local = sub(joints[k + 1]!, joints[k]!);
    const [dx, dy] = rotate(
      [local[0] * size[0], local[1] * size[1]],
      angles[k]!,
    );
    return add(from, [dx / frameAspect, dy]);
  };
  const p0: Point = [placement.x, placement.y];
  const p1 = step(p0, 0);
  const p2 = step(p1, 1);
  const p3 = step(p2, 2);
  const p4 = step(p3, 3);
  return [p0, p1, p2, p3, p4];
};

export const armTip = (
  plate: Plate,
  placement: ArmPlacement,
  pose: ArmPose,
  frameAspect: number,
): Point => jointPositions(plate, placement, pose, frameAspect)[4];

/** Direction the cut at joint k faces: the bisector of the links meeting there, pointing tipward. */
const cutNormal = (joints: readonly Point[], k: number): Point =>
  normalize(
    add(
      normalize(sub(joints[k]!, joints[k - 1]!)),
      normalize(sub(joints[k + 1]!, joints[k]!)),
    ),
  );

const cutAt = (joints: readonly Point[], k: number, sign: 1 | -1): Cut => {
  const normal = cutNormal(joints, k);
  return {
    point: add(joints[k]!, scaleBy(normal, JOINT_RADIUS)),
    normal: scaleBy(normal, sign),
  };
};

/** The four link sprites of one arm: base, upper arm, forearm, gripper. */
export const armLinks = (
  plate: Plate,
  tex: number,
  placement: ArmPlacement,
  pose: ArmPose,
  frameAspect: number,
): readonly SpriteTransform[] => {
  const joints = armJoints(plate);
  const angles = linkAngles(pose);
  const positions = jointPositions(plate, placement, pose, frameAspect);
  return [0, 1, 2, 3].map(k => ({
    tex,
    x: positions[k]![0],
    y: positions[k]![1],
    pivot: joints[k]!,
    angle: angles[k]!,
    scale: placement.scale,
    visible: 1,
    z: Z.arm,
    cutA: k === 0 ? NO_CUT : cutAt(joints, k, 1),
    cutB: k === 3 ? NO_CUT : cutAt(joints, k + 1, -1),
  }));
};
