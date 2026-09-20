export const SPRITE_IDS = [
  "belt",
  "arm-pick",
  "arm-wrap",
  "arm-handoff",
  "tulip",
  "bunch",
] as const;

export type SpriteId = (typeof SPRITE_IDS)[number];
export type Point = readonly [number, number];

/**
 * Joints of an arm plate in plate uv, base to tip: base flange, shoulder, elbow, wrist, tool tip.
 * The plate is cut into four links at the shoulder, elbow and wrist, and each link rotates about
 * the joint that starts it.
 */
export type ArmJoints = readonly [Point, Point, Point, Point, Point];

export interface Plate {
  readonly id: SpriteId;
  readonly prompt: string;
  /** Point in the image (uv, 0..1) that the sprite is positioned by. */
  readonly pivot: Point;
  /** Luminance multiplier before dithering, for dark subjects that would otherwise vanish. */
  readonly exposure: number;
  readonly joints?: ArmJoints;
}

const STYLE =
  "High-contrast studio photograph in muted natural colour on a pure black background. " +
  "Single hard key light from the upper left, deep shadows, one subject, generous negative space. " +
  "The background must be solid pure black with nothing else in frame. " +
  "No text, no letters, no logos, no watermark, no hands, no people.";

const PLATE_LIST: readonly Plate[] = [
  {
    id: "belt",
    prompt: `A long empty black rubber conveyor belt segment on a dark steel frame, seen from the side at eye level, running horizontally across the full width of the frame in the lower third, rollers visible at each end. ${STYLE}`,
    pivot: [0.5, 0.56],
    exposure: 1.2,
  },
  {
    id: "arm-pick",
    prompt: `An industrial six-axis robot arm in dark grey metal, bolted to a round base flange at the bottom centre of the frame, reaching up and to the left with an open two-finger gripper, full arm visible. ${STYLE}`,
    pivot: [0.51, 0.91],
    exposure: 2.8,
    joints: [
      [0.51, 0.91],
      [0.49, 0.66],
      [0.64, 0.36],
      [0.38, 0.19],
      [0.28, 0.12],
    ],
  },
  {
    id: "arm-wrap",
    prompt: `An industrial six-axis robot arm in dark grey metal, bolted to a round base flange at the bottom centre of the frame, reaching up and to the left with a flat paddle end effector held level, full arm visible. ${STYLE}`,
    pivot: [0.57, 0.91],
    exposure: 2.8,
    joints: [
      [0.57, 0.91],
      [0.55, 0.63],
      [0.68, 0.26],
      [0.41, 0.18],
      [0.16, 0.12],
    ],
  },
  {
    id: "arm-handoff",
    prompt: `An industrial six-axis robot arm in dark grey metal, bolted to a round base flange at the bottom centre of the frame, reaching up and to the left with a closed two-finger gripper, full arm visible. ${STYLE}`,
    pivot: [0.53, 0.91],
    exposure: 2.8,
    joints: [
      [0.53, 0.91],
      [0.52, 0.66],
      [0.64, 0.35],
      [0.41, 0.18],
      [0.27, 0.1],
    ],
  },
  {
    id: "tulip",
    prompt: `A single white tulip with a long green stem lying horizontally, bloom to the left, centred in the frame. ${STYLE}`,
    pivot: [0.5, 0.53],
    exposure: 1.6,
  },
  {
    id: "bunch",
    prompt: `A small hand-tied bunch of five white tulips wrapped in a kraft paper cone, lying horizontally with the blooms to the left, centred in the frame. ${STYLE}`,
    pivot: [0.5, 0.53],
    exposure: 1.6,
  },
];

const plateById = new Map(PLATE_LIST.map(plate => [plate.id, plate]));

/** One plate per sprite id, in SPRITE_IDS order, so shader texture slots line up with `tex`. */
export const PLATES: readonly Plate[] = SPRITE_IDS.map(id => {
  const plate = plateById.get(id);
  if (!plate) throw new Error(`No plate declared for sprite "${id}"`);
  return plate;
});

export const plateIndex = (id: SpriteId): number => SPRITE_IDS.indexOf(id);

export const armJoints = (plate: Plate): ArmJoints => {
  if (!plate.joints) throw new Error(`Plate "${plate.id}" is not an arm`);
  return plate.joints;
};

export const artUrl = (id: SpriteId): string => `/art/${id}.png`;
export const FALLBACK_URL = "/art/assembly-line.dither.png";
