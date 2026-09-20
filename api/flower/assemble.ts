// Turns a family profile plus the answered questions into a complete
// FlowerSpec. Missing answers take the profile defaults, so stage one alone
// renders the family archetype. Every random value comes from one RNG seeded
// by the prompt and drawn in one fixed order, so an answer changes only the
// parts it names.
import {
  ANTHER_SHAPES,
  AURA_KINDS,
  EDGE_STYLES,
  FUSION_KINDS,
  INFLORESCENCE_KINDS,
  LEAF_SHAPES,
  LIFE_STAGES,
  PARTICLE_KINDS,
  PATTERN_KINDS,
  PETAL_SHAPES,
  SERRATIONS,
  STEM_STYLES,
  STIGMA_SHAPES,
  SURFACE_TEXTURES,
  THORN_SHAPES,
  VARIEGATION_KINDS,
  VEIN_PATTERNS,
  isVariant,
  type BranchPattern,
  type EdgeStyle,
  type FlowerFamily,
  type FusionKind,
  type InflorescenceKind,
  type LeafShape,
  type LifeStage,
  type ParticleKind,
  type PatternKind,
  type PetalShape,
  type Serration,
  type StemStyle,
  type StigmaShape,
  type SurfaceTexture,
  type ThornShape,
  type VariegationKind,
  type VeinPattern,
} from "../../client/src/data/flower-enums.ts";
import type { TemplateInfo } from "../../client/src/data/templates.ts";
import {
  LEAF_COLORS,
  LEAF_COLOR_NAMES,
  PALETTE,
  PALETTE_NAMES,
  SEPAL_COLOR_NAMES,
  STAMEN_PROMINENCES,
  STEM_COLORS,
  STEM_COLOR_NAMES,
  darken,
  hexToRgba,
  legalList,
  round3,
  type FamilyProfile,
  type LeafColorName,
  type ListName,
  type PaletteName,
  type Rgba,
  type SepalColorName,
  type SpecialStructure,
  type StamenProminence,
  type StemColorName,
  type Strangeness,
} from "./families.ts";
import { at, first, pickUnit } from "./lists.ts";
import { createRng, type Rng } from "./seed.ts";
import {
  FlowerSpecSchema,
  type BudJson,
  type ColorGradientJson,
  type FlowerSpecJson,
  type LeafJson,
  type PetalLayerJson,
  type StamenJson,
} from "./specSchema.ts";

// ═══════════════════════════════════════════════════════════════════════════
// Option lists. Each carries the descriptions Jev reads next to it.
// ═══════════════════════════════════════════════════════════════════════════

export type Descriptions<T extends readonly string[]> = Readonly<
  Record<T[number], string | null>
>;

export const NONE = "none";

export const MOOD_WORDS = [
  "Midnight",
  "Dawn",
  "Frost",
  "Ember",
  "Velvet",
  "Wild",
  "Ghost",
  "Solar",
  "Coral",
  "Storm",
  "Silk",
  "Nebula",
  "Garden",
  "Royal",
] as const;
export type MoodWord = (typeof MOOD_WORDS)[number];
export const MOOD_WORD_DESCRIPTIONS: Descriptions<typeof MOOD_WORDS> = {
  Midnight: "dark, nocturnal, deep tones",
  Dawn: "soft, pale, fresh",
  Frost: "icy, pale blue or white, crystalline",
  Ember: "warm red and orange, smoldering",
  Velvet: "rich, deep, plush",
  Wild: "untamed, meadow, irregular",
  Ghost: "translucent, white, faded",
  Solar: "bright yellow and gold, radiant",
  Coral: "reef tones, pink and orange",
  Storm: "grey, blue, dramatic",
  Silk: "smooth, elegant, pastel",
  Nebula: "cosmic, purple and teal, glowing",
  Garden: "classic, familiar, homely",
  Royal: "purple, gold, formal",
};

export const NAME_NOUNS = [
  "Lantern",
  "Spindle",
  "Crown",
  "Bell",
  "Star",
  "Flame",
  "Veil",
  "Comet",
  "Thorn",
  "Dancer",
  "Chalice",
  "Compass",
  "Feather",
  "Gale",
  "Halo",
  "Kite",
  "Mirror",
  "Moth",
  "Needle",
  "Oracle",
  "Pilgrim",
  "Quill",
  "Ribbon",
  "Saber",
  "Tide",
  "Trumpet",
  "Whisper",
  "Wick",
  "Zephyr",
  "Anvil",
] as const;
export type NameNoun = (typeof NAME_NOUNS)[number];
export const NAME_NOUN_DESCRIPTIONS: Descriptions<typeof NAME_NOUNS> = {
  Lantern: "glowing, rounded, hanging",
  Spindle: "tall, narrow, spun",
  Crown: "regal ring of upright petals",
  Bell: "bell shaped, nodding",
  Star: "pointed radial petals",
  Flame: "tapering, warm, flickering",
  Veil: "sheer, translucent, layered",
  Comet: "trailing, streaked, fast",
  Thorn: "sharp, armored, defensive",
  Dancer: "twisting, poised, graceful",
  Chalice: "cupped, deep, ceremonial",
  Compass: "four square, cruciform",
  Feather: "fringed, soft, plumed",
  Gale: "windblown, wild, leaning",
  Halo: "ringed with a glow or corona",
  Kite: "angular, lifted, tethered",
  Mirror: "glassy, reflective, metallic",
  Moth: "dusky, velvet, nocturnal",
  Needle: "thin, spiky, linear",
  Oracle: "mysterious, patterned, watching",
  Pilgrim: "plain, hardy, travel worn",
  Quill: "slender, inked, writing",
  Ribbon: "strap like, curling, flowing",
  Saber: "curved blade petals",
  Tide: "rippled, blue green, pulsing",
  Trumpet: "funnel shaped, loud, open",
  Whisper: "pale, small, quiet",
  Wick: "small flame at the center",
  Zephyr: "light, airy, drifting",
  Anvil: "heavy, dark, dense head",
};

export const PETAL_COUNT_CLASSES = ["few", "some", "many", "dense"] as const;
export type PetalCountClass = (typeof PETAL_COUNT_CLASSES)[number];
export const PETAL_COUNT_CLASS_DESCRIPTIONS: Descriptions<
  typeof PETAL_COUNT_CLASSES
> = {
  few: "3 to 5 petals in the outer ring, like a trillium or a wild rose",
  some: "6 to 8 petals, like a lily or a cosmos",
  many: "10 to 20 petals, like a daisy or a gerbera",
  dense: "30 or more petals, like a sunflower or a pompon",
};
const PETAL_COUNT_TARGET: Record<PetalCountClass, number> = {
  few: 4,
  some: 6,
  many: 13,
  dense: 34,
};

export const LAYER_COUNTS = ["single", "double", "triple"] as const;
export type LayerCount = (typeof LAYER_COUNTS)[number];
export const LAYER_COUNT_DESCRIPTIONS: Descriptions<typeof LAYER_COUNTS> = {
  single: "one ring of petals",
  double: "two rings of petals",
  triple: "three or more rings, dense like a rose or a peony",
};
const LAYER_COUNT_VALUE: Record<LayerCount, number> = {
  single: 1,
  double: 2,
  triple: 3,
};

export const POSES = ["recurved", "open", "cupped", "tight"] as const;
export type Pose = (typeof POSES)[number];
export const POSE_DESCRIPTIONS: Descriptions<typeof POSES> = {
  recurved: "petals bend backward and away from the center",
  open: "petals lie flat and open",
  cupped: "petals curve gently inward, bowl shaped",
  tight: "petals curve strongly inward, a closed bud like form",
};
const POSE_VALUE: Record<Pose, { curvature: number; curl: number }> = {
  recurved: { curvature: -0.4, curl: 0.5 },
  open: { curvature: 0, curl: 0.1 },
  cupped: { curvature: 0.35, curl: 0.1 },
  tight: { curvature: 0.7, curl: 0 },
};

export const WIDTH_CLASSES = ["strap", "normal", "broad"] as const;
export type WidthClass = (typeof WIDTH_CLASSES)[number];
export const WIDTH_CLASS_DESCRIPTIONS: Descriptions<typeof WIDTH_CLASSES> = {
  strap: "narrow strap like petals",
  normal: "petals about as wide as a typical rose petal",
  broad: "wide rounded petals that overlap",
};
const WIDTH_VALUE: Record<WidthClass, number> = {
  strap: 0.5,
  normal: 1,
  broad: 1.5,
};

export const DROOPS = ["upright", "relaxed", "hanging"] as const;
export type Droop = (typeof DROOPS)[number];
export const DROOP_DESCRIPTIONS: Descriptions<typeof DROOPS> = {
  upright: "petals held up and out",
  relaxed: "petals lean gently downward",
  hanging: "petals hang down like a fuchsia",
};
const DROOP_VALUE: Record<Droop, number> = {
  upright: 0.05,
  relaxed: 0.25,
  hanging: 0.6,
};

export const OPACITIES = ["solid", "translucent", "glassy"] as const;
export type Opacity = (typeof OPACITIES)[number];
export const OPACITY_DESCRIPTIONS: Descriptions<typeof OPACITIES> = {
  solid: "opaque petals",
  translucent: "light shows through the petals",
  glassy: "nearly transparent petals",
};
const OPACITY_VALUE: Record<Opacity, number> = {
  solid: 1,
  translucent: 0.75,
  glassy: 0.5,
};

export const GRADIENT_DIRECTIONS = [
  "base_to_tip",
  "tip_to_base",
  "edge_band",
] as const;
export type GradientDirection = (typeof GRADIENT_DIRECTIONS)[number];
export const GRADIENT_DIRECTION_DESCRIPTIONS: Descriptions<
  typeof GRADIENT_DIRECTIONS
> = {
  base_to_tip: "the base color at the center fading to the tip color",
  tip_to_base: "the tip color at the center fading to the base color",
  edge_band: "one color with a band of the second color at the edge",
};

export const HEAD_COUNT_CLASSES = ["single", "few", "several", "many"] as const;
export type HeadCountClass = (typeof HEAD_COUNT_CLASSES)[number];
export const HEAD_COUNT_CLASS_DESCRIPTIONS: Descriptions<
  typeof HEAD_COUNT_CLASSES
> = {
  single: "one flower head",
  few: "a sparse cluster, few heads for its kind",
  several: "a typical cluster for its kind",
  many: "a dense cluster, many heads for its kind",
};
/** The share of the kind's head count range each class draws from. */
const HEAD_COUNT_SHARE: Record<HeadCountClass, readonly [number, number]> = {
  single: [0, 0],
  few: [0, 0.34],
  several: [0.33, 0.67],
  many: [0.66, 1],
};
/** How many florets each kind carries, from its sparsest to its densest cluster. */
export const KIND_HEAD_RANGE: Record<
  InflorescenceKind,
  readonly [number, number]
> = {
  Solitary: [1, 1],
  Spike: [12, 20],
  Raceme: [6, 10],
  Umbel: [7, 12],
  Corymb: [12, 24],
  Panicle: [6, 12],
  Spray: [3, 5],
};

export const BUD_COUNT_CLASSES = ["none", "one", "several"] as const;
export type BudCountClass = (typeof BUD_COUNT_CLASSES)[number];
export const BUD_COUNT_CLASS_DESCRIPTIONS: Descriptions<
  typeof BUD_COUNT_CLASSES
> = {
  none: "no side buds on the stem",
  one: "one side bud",
  several: "several side buds",
};
const BUD_COUNT_VALUE: Record<BudCountClass, number> = {
  none: 0,
  one: 1,
  several: 3,
};

export { STAMEN_PROMINENCES, SEPAL_COLOR_NAMES };
export const STAMEN_PROMINENCE_DESCRIPTIONS: Descriptions<
  typeof STAMEN_PROMINENCES
> = {
  hidden: "stamens not visible",
  visible: "a few short stamens at the center",
  prominent: "long showy stamens, like a lily or a hibiscus",
  brush: "a dense brush of many stamens, like a bottlebrush",
};
const STAMEN_VALUE: Record<
  StamenProminence,
  { fraction: number; height: number }
> = {
  hidden: { fraction: 0, height: 0 },
  visible: { fraction: 0.33, height: 0.35 },
  prominent: { fraction: 0.66, height: 0.6 },
  brush: { fraction: 1, height: 0.5 },
};

export const SEPAL_COLOR_DESCRIPTIONS: Descriptions<typeof SEPAL_COLOR_NAMES> =
  {
    green: "ordinary green sepals",
    matching: "sepals the same color as the petals",
    contrasting: "sepals in the petal tip color",
    dark: "dark, near black sepals",
  };

export const SEPAL_REFLEXES = ["closed", "spread", "reflexed"] as const;
export type SepalReflex = (typeof SEPAL_REFLEXES)[number];
export const SEPAL_REFLEX_DESCRIPTIONS: Descriptions<typeof SEPAL_REFLEXES> = {
  closed: "sepals hug the base of the petals",
  spread: "sepals spread out flat under the flower",
  reflexed: "sepals bend back down the stem",
};
const SEPAL_REFLEX_ANGLE: Record<SepalReflex, number> = {
  closed: 20,
  spread: 90,
  reflexed: 160,
};

export const STEM_HEIGHTS = ["short", "medium", "tall"] as const;
export type StemHeight = (typeof STEM_HEIGHTS)[number];
export const STEM_HEIGHT_DESCRIPTIONS: Descriptions<typeof STEM_HEIGHTS> = {
  short: "low, compact, ground hugging",
  medium: "a typical cut flower stem",
  tall: "very tall, towering",
};
const STEM_HEIGHT_VALUE: Record<StemHeight, number> = {
  short: 0.4,
  medium: 0.6,
  tall: 0.85,
};

export const STEM_THICKNESSES = ["thin", "normal", "thick"] as const;
export type StemThickness = (typeof STEM_THICKNESSES)[number];
export const STEM_THICKNESS_DESCRIPTIONS: Descriptions<
  typeof STEM_THICKNESSES
> = {
  thin: "a wiry thin stem",
  normal: "a typical stem",
  thick: "a thick fleshy or woody stem",
};
const STEM_THICKNESS_VALUE: Record<StemThickness, number> = {
  thin: 0.2,
  normal: 0.3,
  thick: 0.45,
};

export const LEAF_COUNT_CLASSES = ["sparse", "normal", "lush"] as const;
export type LeafCountClass = (typeof LEAF_COUNT_CLASSES)[number];
export const LEAF_COUNT_CLASS_DESCRIPTIONS: Descriptions<
  typeof LEAF_COUNT_CLASSES
> = {
  sparse: "one or two leaves",
  normal: "a few leaves along the stem",
  lush: "many leaves, a leafy stem",
};
const LEAF_COUNT_VALUE: Record<LeafCountClass, number> = {
  sparse: 2,
  normal: 3,
  lush: 5,
};

export const LEAF_DROOPS = ["level", "relaxed", "hanging"] as const;
export type LeafDroop = (typeof LEAF_DROOPS)[number];
export const LEAF_DROOP_DESCRIPTIONS: Descriptions<typeof LEAF_DROOPS> = {
  level: "leaves held out level",
  relaxed: "leaves lean gently downward",
  hanging: "leaves hang down along the stem",
};
const LEAF_DROOP_VALUE: Record<LeafDroop, number> = {
  level: 0.05,
  relaxed: 0.25,
  hanging: 0.6,
};

export const DEWDROP_CLASSES = ["none", "few", "many"] as const;
export type DewdropClass = (typeof DEWDROP_CLASSES)[number];
export const DEWDROP_CLASS_DESCRIPTIONS: Descriptions<typeof DEWDROP_CLASSES> =
  {
    none: "dry petals",
    few: "a few dewdrops",
    many: "petals covered in dew",
  };
const DEWDROP_COUNT: Record<DewdropClass, number> = {
  none: 0,
  few: 4,
  many: 12,
};

export const AURA_CHOICES = [NONE, ...AURA_KINDS] as const;
export type AuraChoice = (typeof AURA_CHOICES)[number];

export const PARTICLE_CHOICES = [NONE, ...PARTICLE_KINDS] as const;
export type ParticleChoice = (typeof PARTICLE_CHOICES)[number];

// ═══════════════════════════════════════════════════════════════════════════
// Answer types, keyed by the question ids of spec section 4.4
// ═══════════════════════════════════════════════════════════════════════════

export type StageOneAnswers = {
  family: FlowerFamily;
  template: string;
  strangeness: Strangeness;
  mood: MoodWord;
};

// The value each stage two question yields. StageTwoAnswers is derived from
// STAGE_TWO_IDS over this map, so an id missing from either side fails to
// compile inside defaultAnswers.
type AnswerValues = {
  outer_shape: PetalShape;
  inner_shape: PetalShape;
  petal_count_class: PetalCountClass;
  layer_count: LayerCount;
  pose: Pose;
  width_class: WidthClass;
  droop: Droop;
  edge_style: EdgeStyle;
  texture: SurfaceTexture;
  vein_pattern: VeinPattern;
  opacity: Opacity;
  outer_base_color: PaletteName;
  outer_tip_color: PaletteName;
  inner_base_color: PaletteName;
  inner_tip_color: PaletteName;
  gradient_direction: GradientDirection;
  pattern_kind: PatternKind;
  pattern_color: PaletteName;
  fusion_kind: FusionKind;
  inflorescence_kind: InflorescenceKind;
  head_count_class: HeadCountClass;
  life_stage: LifeStage;
  bud_count_class: BudCountClass;
  stamen_prominence: StamenProminence;
  filament_color: PaletteName;
  anther_color: PaletteName;
  stigma_shape: StigmaShape;
  pistil_color: PaletteName;
  receptacle_color: PaletteName;
  pollen_drift: boolean;
  nectary_glow: boolean;
  sepal_color: SepalColorName;
  sepal_reflex: SepalReflex;
  bracts: boolean;
  bract_color: PaletteName;
  stem_style: StemStyle;
  stem_height: StemHeight;
  stem_thickness: StemThickness;
  stem_color: StemColorName;
  stem_surface: SurfaceTexture;
  has_thorns: boolean;
  thorn_shape: ThornShape;
  leaf_shape: LeafShape;
  serration: Serration;
  leaf_color: LeafColorName;
  leaf_variegation: VariegationKind;
  variegation_color: PaletteName;
  leaf_count_class: LeafCountClass;
  leaf_droop: LeafDroop;
  leaf_vein: VeinPattern;
  leaf_translucency: boolean;
  dewdrops: DewdropClass;
  aura_kind: AuraChoice;
  aura_color: PaletteName;
  particle_kind: ParticleChoice;
  particle_color: PaletteName;
  iridescence: boolean;
  bioluminescence: boolean;
  name_noun: NameNoun;
};

/** Every stage two question id, in the order the questions are asked. */
export const STAGE_TWO_IDS = [
  "outer_shape",
  "inner_shape",
  "petal_count_class",
  "layer_count",
  "pose",
  "width_class",
  "droop",
  "edge_style",
  "texture",
  "vein_pattern",
  "opacity",
  "outer_base_color",
  "outer_tip_color",
  "inner_base_color",
  "inner_tip_color",
  "gradient_direction",
  "pattern_kind",
  "pattern_color",
  "fusion_kind",
  "inflorescence_kind",
  "head_count_class",
  "life_stage",
  "bud_count_class",
  "stamen_prominence",
  "filament_color",
  "anther_color",
  "stigma_shape",
  "pistil_color",
  "receptacle_color",
  "pollen_drift",
  "nectary_glow",
  "sepal_color",
  "sepal_reflex",
  "bracts",
  "bract_color",
  "stem_style",
  "stem_height",
  "stem_thickness",
  "stem_color",
  "stem_surface",
  "has_thorns",
  "thorn_shape",
  "leaf_shape",
  "serration",
  "leaf_color",
  "leaf_variegation",
  "variegation_color",
  "leaf_count_class",
  "leaf_droop",
  "leaf_vein",
  "leaf_translucency",
  "dewdrops",
  "aura_kind",
  "aura_color",
  "particle_kind",
  "particle_color",
  "iridescence",
  "bioluminescence",
  "name_noun",
] as const satisfies readonly (keyof AnswerValues)[];

export type StageTwoId = (typeof STAGE_TWO_IDS)[number];
export type StageTwoAnswers = { [K in StageTwoId]: AnswerValues[K] };

/** Raw answers as a model returns them: any id, a choice name or a yes/no. */
export type AnswerInput = Partial<Record<string, string | boolean>>;

type ChoiceField<V extends string> = {
  type: "choice";
  options: readonly V[];
  parse: (value: unknown) => V | undefined;
};
type BooleanField = {
  type: "boolean";
  parse: (value: unknown) => boolean | undefined;
};
type AnswerField<V> = {
  parse: (value: unknown) => V | undefined;
} & ([V] extends [boolean] ? BooleanField : ChoiceField<Extract<V, string>>);

const oneOf = <const T extends readonly string[]>(
  options: T,
): ChoiceField<T[number]> => ({
  type: "choice",
  options,
  parse: value => (isVariant(options, value) ? value : undefined),
});

const yesNo: BooleanField = {
  type: "boolean",
  parse: value => (typeof value === "boolean" ? value : undefined),
};

/** The full option list and the parser for every stage two answer. Family and strangeness narrow the options further (PROFILE_LIST_FOR_ANSWER). */
export const STAGE_TWO_FIELDS: {
  [K in StageTwoId]: AnswerField<AnswerValues[K]>;
} = {
  outer_shape: oneOf(PETAL_SHAPES),
  inner_shape: oneOf(PETAL_SHAPES),
  petal_count_class: oneOf(PETAL_COUNT_CLASSES),
  layer_count: oneOf(LAYER_COUNTS),
  pose: oneOf(POSES),
  width_class: oneOf(WIDTH_CLASSES),
  droop: oneOf(DROOPS),
  edge_style: oneOf(EDGE_STYLES),
  texture: oneOf(SURFACE_TEXTURES),
  vein_pattern: oneOf(VEIN_PATTERNS),
  opacity: oneOf(OPACITIES),
  outer_base_color: oneOf(PALETTE_NAMES),
  outer_tip_color: oneOf(PALETTE_NAMES),
  inner_base_color: oneOf(PALETTE_NAMES),
  inner_tip_color: oneOf(PALETTE_NAMES),
  gradient_direction: oneOf(GRADIENT_DIRECTIONS),
  pattern_kind: oneOf(PATTERN_KINDS),
  pattern_color: oneOf(PALETTE_NAMES),
  fusion_kind: oneOf(FUSION_KINDS),
  inflorescence_kind: oneOf(INFLORESCENCE_KINDS),
  head_count_class: oneOf(HEAD_COUNT_CLASSES),
  life_stage: oneOf(LIFE_STAGES),
  bud_count_class: oneOf(BUD_COUNT_CLASSES),
  stamen_prominence: oneOf(STAMEN_PROMINENCES),
  filament_color: oneOf(PALETTE_NAMES),
  anther_color: oneOf(PALETTE_NAMES),
  stigma_shape: oneOf(STIGMA_SHAPES),
  pistil_color: oneOf(PALETTE_NAMES),
  receptacle_color: oneOf(PALETTE_NAMES),
  pollen_drift: yesNo,
  nectary_glow: yesNo,
  sepal_color: oneOf(SEPAL_COLOR_NAMES),
  sepal_reflex: oneOf(SEPAL_REFLEXES),
  bracts: yesNo,
  bract_color: oneOf(PALETTE_NAMES),
  stem_style: oneOf(STEM_STYLES),
  stem_height: oneOf(STEM_HEIGHTS),
  stem_thickness: oneOf(STEM_THICKNESSES),
  stem_color: oneOf(STEM_COLOR_NAMES),
  stem_surface: oneOf(SURFACE_TEXTURES),
  has_thorns: yesNo,
  thorn_shape: oneOf(THORN_SHAPES),
  leaf_shape: oneOf(LEAF_SHAPES),
  serration: oneOf(SERRATIONS),
  leaf_color: oneOf(LEAF_COLOR_NAMES),
  leaf_variegation: oneOf(VARIEGATION_KINDS),
  variegation_color: oneOf(PALETTE_NAMES),
  leaf_count_class: oneOf(LEAF_COUNT_CLASSES),
  leaf_droop: oneOf(LEAF_DROOPS),
  leaf_vein: oneOf(VEIN_PATTERNS),
  leaf_translucency: yesNo,
  dewdrops: oneOf(DEWDROP_CLASSES),
  aura_kind: oneOf(AURA_CHOICES),
  aura_color: oneOf(PALETTE_NAMES),
  particle_kind: oneOf(PARTICLE_CHOICES),
  particle_color: oneOf(PALETTE_NAMES),
  iridescence: yesNo,
  bioluminescence: yesNo,
  name_noun: oneOf(NAME_NOUNS),
};

/** Which family list makes an answer legal. Class word answers are absent: their whole option list is always legal. */
export const PROFILE_LIST_FOR_ANSWER: Partial<Record<StageTwoId, ListName>> = {
  outer_shape: "shapes",
  inner_shape: "innerShapes",
  edge_style: "edges",
  texture: "textures",
  vein_pattern: "veins",
  pattern_kind: "patterns",
  fusion_kind: "fusions",
  inflorescence_kind: "inflorescences",
  stamen_prominence: "stamenProminence",
  stigma_shape: "stigmaShapes",
  stem_style: "stemStyles",
  leaf_shape: "leafShapes",
  serration: "serrations",
  outer_base_color: "colors",
  outer_tip_color: "colors",
  inner_base_color: "colors",
  inner_tip_color: "colors",
  pattern_color: "colors",
  bract_color: "colors",
  aura_color: "colors",
  particle_color: "colors",
};

export type AssembleInput = {
  profile: FamilyProfile;
  strangeness: Strangeness;
  answers: AnswerInput;
  stageOne: StageOneAnswers;
  seed: number;
  template?: TemplateInfo;
};

// ═══════════════════════════════════════════════════════════════════════════
// Jitter: every random draw, taken once in a fixed order
// ═══════════════════════════════════════════════════════════════════════════

const MAX_LAYERS = 5;
const MAX_LEAVES = 6;
const MAX_STAMENS = 40;
const MAX_BUDS = 4;

const JITTER_AMPLITUDE: Record<Strangeness, number> = {
  faithful: 0.5,
  stylized: 1,
  invented: 1.5,
};

type LayerJitter = {
  offset: number;
  stop: number;
  patternScale: number;
  patternDensity: number;
  patternExtent: number;
  fusionDepth: number;
};
type LeafJitter = { position: number; size: number; angle: number };
type BudJitter = { position: number; size: number; openness: number };

type Jitter = {
  layerFactor: number;
  layers: readonly LayerJitter[];
  leaves: readonly LeafJitter[];
  stamens: readonly number[];
  buds: readonly BudJitter[];
  headCount: number;
  headScale: number;
  spread: number;
  receptacle: number;
  stemHeight: number;
  sepalLength: number;
  pollenCount: number;
  noun: number;
  epithet: number;
};

const drawMany = <T>(rng: Rng, length: number, draw: (next: Rng) => T) =>
  Array.from({ length }, () => draw(rng));

function drawJitter(rng: Rng): Jitter {
  return {
    layerFactor: rng(),
    layers: drawMany(rng, MAX_LAYERS, next => ({
      offset: next(),
      stop: next(),
      patternScale: next(),
      patternDensity: next(),
      patternExtent: next(),
      fusionDepth: next(),
    })),
    leaves: drawMany(rng, MAX_LEAVES, next => ({
      position: next(),
      size: next(),
      angle: next(),
    })),
    stamens: drawMany(rng, MAX_STAMENS, next => next()),
    buds: drawMany(rng, MAX_BUDS, next => ({
      position: next(),
      size: next(),
      openness: next(),
    })),
    headCount: rng(),
    headScale: rng(),
    spread: rng(),
    receptacle: rng(),
    stemHeight: rng(),
    sepalLength: rng(),
    pollenCount: rng(),
    noun: rng(),
    epithet: rng(),
  };
}

const clamp = (lo: number, hi: number, value: number) =>
  Math.min(hi, Math.max(lo, value));
const lerp = (lo: number, hi: number, t: number) => lo + (hi - lo) * t;

// ═══════════════════════════════════════════════════════════════════════════
// Answer resolution: defaults from the profile, answers kept when legal
// ═══════════════════════════════════════════════════════════════════════════

const nearest = <T extends string>(
  classes: readonly T[],
  valueOf: Record<T, number>,
  target: number,
): T =>
  classes.reduce((best, cls) =>
    Math.abs(valueOf[cls] - target) < Math.abs(valueOf[best] - target)
      ? cls
      : best,
  );

function defaultAnswers(
  profile: FamilyProfile,
  nounDraw: number,
  template: TemplateInfo | undefined,
): StageTwoAnswers {
  const head = <T>(list: readonly T[], name: string): T =>
    first(list, `${profile.key}.${name}`);
  const baseColor = head(profile.colors, "colors");
  const inflorescence =
    template?.inflorescence ?? head(profile.inflorescences, "inflorescences");
  const composite = profile.special === "Composite";
  return {
    outer_shape: head(profile.shapes, "shapes"),
    inner_shape: head(profile.innerShapes, "innerShapes"),
    petal_count_class: nearest(
      PETAL_COUNT_CLASSES,
      PETAL_COUNT_TARGET,
      head(profile.petalCounts, "petalCounts"),
    ),
    layer_count: nearest(
      LAYER_COUNTS,
      LAYER_COUNT_VALUE,
      profile.layerRange[0],
    ),
    pose: "open",
    width_class: "normal",
    droop: "upright",
    edge_style: head(profile.edges, "edges"),
    texture: head(profile.textures, "textures"),
    vein_pattern: head(profile.veins, "veins"),
    opacity: "solid",
    outer_base_color: baseColor,
    outer_tip_color: baseColor,
    inner_base_color: baseColor,
    inner_tip_color: baseColor,
    gradient_direction: "base_to_tip",
    pattern_kind: head(profile.patterns, "patterns"),
    pattern_color: profile.colors[1] ?? baseColor,
    fusion_kind: head(profile.fusions, "fusions"),
    inflorescence_kind: inflorescence,
    head_count_class: inflorescence === "Solitary" ? "single" : "several",
    life_stage: "Bloom",
    bud_count_class: "none",
    stamen_prominence: head(profile.stamenProminence, "stamenProminence"),
    filament_color: "cream",
    anther_color: "gold",
    stigma_shape: head(profile.stigmaShapes, "stigmaShapes"),
    pistil_color: "cream",
    receptacle_color: composite ? "gold" : "green",
    pollen_drift: false,
    nectary_glow: false,
    sepal_color: "green",
    sepal_reflex: "spread",
    bracts: profile.bracts,
    bract_color: composite ? "green" : baseColor,
    stem_style: head(profile.stemStyles, "stemStyles"),
    stem_height: "medium",
    stem_thickness: "normal",
    stem_color: "green",
    stem_surface: "Smooth",
    has_thorns: profile.thorns,
    thorn_shape: first(THORN_SHAPES, "THORN_SHAPES"),
    leaf_shape: head(profile.leafShapes, "leafShapes"),
    serration: head(profile.serrations, "serrations"),
    leaf_color: profile.leafColor,
    leaf_variegation: first(VARIEGATION_KINDS, "VARIEGATION_KINDS"),
    variegation_color: "cream",
    leaf_count_class: "normal",
    leaf_droop: "relaxed",
    leaf_vein: profile.botanicalClass === "Monocot" ? "Parallel" : "Pinnate",
    leaf_translucency: false,
    dewdrops: "none",
    aura_kind: NONE,
    aura_color: baseColor,
    particle_kind: NONE,
    particle_color: baseColor,
    iridescence: false,
    bioluminescence: false,
    name_noun: pickUnit(NAME_NOUNS, nounDraw, "NAME_NOUNS"),
  };
}

type Narrowing = <T extends string>(
  profile: FamilyProfile,
  options: readonly T[],
) => readonly T[];

// Spec 4.5: a composite head's outer ring is always Ligulate and a bell
// corolla is never Free. The questions and the assembler both read the
// narrowed list, so the answer trace never contradicts the spec.
const SKELETON_NARROWING: Partial<Record<StageTwoId, Narrowing>> = {
  outer_shape: (profile, options) =>
    profile.special === "Composite"
      ? options.filter(option => option === "Ligulate")
      : options,
  fusion_kind: (profile, options) =>
    profile.special === "Bell"
      ? options.filter(option => option !== "Free")
      : options,
};

/** The options the family skeleton leaves open for one answer. */
export function legalOptions<T extends string>(
  profile: FamilyProfile,
  id: StageTwoId,
  options: readonly T[],
): readonly T[] {
  const narrow = SKELETON_NARROWING[id];
  return narrow === undefined ? options : narrow(profile, options);
}

// A value that is not an option, or is outside the family's legal list, is
// treated as unanswered so the skeleton holds even when a streamed partial
// answer is a prefix of a real option.
function legalAnswer<K extends StageTwoId>(
  profile: FamilyProfile,
  strangeness: Strangeness,
  id: K,
  value: unknown,
): StageTwoAnswers[K] | undefined {
  const parsed = STAGE_TWO_FIELDS[id].parse(value);
  const listName = PROFILE_LIST_FOR_ANSWER[id];
  if (parsed === undefined || listName === undefined) return parsed;
  const legal = legalOptions(
    profile,
    id,
    legalList(profile, strangeness, listName),
  );
  return isVariant(legal, parsed) ? parsed : undefined;
}

function resolveAnswers(
  profile: FamilyProfile,
  strangeness: Strangeness,
  answers: AnswerInput,
  nounDraw: number,
  template: TemplateInfo | undefined,
): StageTwoAnswers {
  const defaults = defaultAnswers(profile, nounDraw, template);
  const keep = <K extends StageTwoId>(id: K): StageTwoAnswers[K] =>
    legalAnswer(profile, strangeness, id, answers[id]) ?? defaults[id];
  const resolved = STAGE_TWO_IDS.reduce<StageTwoAnswers>(
    (acc, id) => ({ ...acc, [id]: keep(id) }),
    defaults,
  );
  // A named template knows its own inflorescence; the model's answer cannot
  // turn a hydrangea into one flower.
  return template?.inflorescence
    ? { ...resolved, inflorescence_kind: template.inflorescence }
    : resolved;
}

// ═══════════════════════════════════════════════════════════════════════════
// Colors
// ═══════════════════════════════════════════════════════════════════════════

const palette = (name: PaletteName): Rgba => hexToRgba(PALETTE[name]);

// The same name for base and tip still gives a visible gradient.
const tipColor = (base: PaletteName, tip: PaletteName): Rgba =>
  base === tip ? darken(palette(base), 0.8) : palette(tip);

function gradient(
  base: Rgba,
  tip: Rgba,
  direction: GradientDirection,
  stopJitter: number,
): ColorGradientJson {
  const stops: Record<GradientDirection, ColorGradientJson["stops"]> = {
    base_to_tip: [
      { position: 0, color: base },
      { position: round3(clamp(0.5, 1, 0.9 + stopJitter)), color: tip },
    ],
    tip_to_base: [
      { position: 0, color: tip },
      { position: round3(clamp(0.5, 1, 0.9 + stopJitter)), color: base },
    ],
    edge_band: [
      { position: 0, color: base },
      { position: round3(clamp(0.5, 0.9, 0.7 + stopJitter)), color: base },
      { position: 1, color: tip },
    ],
  };
  return { stops: stops[direction] };
}

const solid = (color: Rgba): ColorGradientJson => ({
  stops: [{ position: 0, color }],
});

// ═══════════════════════════════════════════════════════════════════════════
// Petals
// ═══════════════════════════════════════════════════════════════════════════

type Context = {
  profile: FamilyProfile;
  strangeness: Strangeness;
  answers: StageTwoAnswers;
  jitter: Jitter;
  /** Signed jitter scaled by the strangeness amplitude. */
  jit: (unit: number, scale: number) => number;
};

function outerPetalCount(profile: FamilyProfile, cls: PetalCountClass): number {
  const target = PETAL_COUNT_TARGET[cls];
  return profile.petalCounts.reduce(
    (best, count) =>
      Math.abs(count - target) < Math.abs(best - target) ? count : best,
    first(profile.petalCounts, `${profile.key}.petalCounts`),
  );
}

// Only invented may exceed the family's layer range, by one ring.
function layerCount(ctx: Context): number {
  const { profile, strangeness, answers } = ctx;
  const [lo, hi] = profile.layerRange;
  const ceiling = strangeness === "invented" ? hi + 1 : hi;
  const needsInner =
    profile.special === "Labellum" || profile.special === "Corona";
  return Math.max(
    needsInner ? 2 : 1,
    clamp(lo, ceiling, LAYER_COUNT_VALUE[answers.layer_count]),
  );
}

/** Families whose first arrangement is Spiral bloom like a rose: rings grow inward along the Fibonacci numbers. */
const isSpiralled = (profile: FamilyProfile): boolean =>
  profile.arrangements[0] === "Spiral";

const GOLDEN_RATIO = (1 + Math.sqrt(5)) / 2;
const MAX_SPIRAL_RING = 21;

// Inner rings shrink by the drawn factor. A radial family with a fixed order
// keeps each ring a multiple of that order so the symmetry survives. A
// spiralled family instead grows inward: 5, 8, 13, the way a rose packs.
function layerCounts(ctx: Context, outer: number, layers: number): number[] {
  const { profile, jitter, jit } = ctx;
  const factor = clamp(0.6, 0.8, 0.7 + jit(jitter.layerFactor, 0.1));
  const order = profile.symmetry === "Radial" ? profile.symmetryOrder : 0;
  const next = (previous: number): number => {
    if (isSpiralled(profile)) {
      return Math.min(MAX_SPIRAL_RING, Math.round(previous * GOLDEN_RATIO));
    }
    return order > 0
      ? Math.max(order, Math.round((previous * factor) / order) * order)
      : Math.max(3, Math.round(previous * factor));
  };
  return Array.from({ length: layers - 1 }).reduce<number[]>(
    counts => [...counts, next(at(counts, counts.length - 1, "counts"))],
    [outer],
  );
}

/** A spiralled bloom's outer ring recurves and each ring inward cups more; other families cup a little more per ring. */
const SPIRAL_OUTER_RECURVE = 0.3;
const SPIRAL_CUP_STEP = 0.4;
const CUP_STEP = 0.25;

function layerCurvature(
  profile: FamilyProfile,
  pose: { curvature: number },
  index: number,
): number {
  const curvature = isSpiralled(profile)
    ? pose.curvature - SPIRAL_OUTER_RECURVE + index * SPIRAL_CUP_STEP
    : pose.curvature + index * CUP_STEP;
  return round3(clamp(-1, 0.85, curvature));
}

function petalLayer(
  ctx: Context,
  index: number,
  count: number,
): PetalLayerJson {
  const { profile, answers, jitter, jit } = ctx;
  const draw = at(
    jitter.layers,
    Math.min(index, MAX_LAYERS - 1),
    "layer jitter",
  );
  const pose = POSE_VALUE[answers.pose];
  const outer = index === 0;
  const base = palette(
    outer ? answers.outer_base_color : answers.inner_base_color,
  );
  const tip = outer
    ? tipColor(answers.outer_base_color, answers.outer_tip_color)
    : tipColor(answers.inner_base_color, answers.inner_tip_color);
  const baseOffset = 180 / count;
  return {
    index,
    count,
    shape: outer ? answers.outer_shape : answers.inner_shape,
    arrangement: first(profile.arrangements, `${profile.key}.arrangements`),
    curvature: layerCurvature(profile, pose, index),
    curl: round3(Math.max(0, pose.curl - index * 0.2)),
    texture: answers.texture,
    color: gradient(base, tip, answers.gradient_direction, jit(draw.stop, 0.1)),
    opacity: OPACITY_VALUE[answers.opacity],
    vein_pattern: answers.vein_pattern,
    edge_style: answers.edge_style,
    width: round3(
      Math.max(0.2, WIDTH_VALUE[answers.width_class] - index * 0.1),
    ),
    length: round3(Math.max(0.5, 1.4 - index * 0.2)),
    angular_offset: outer
      ? 0
      : round3(baseOffset + jit(draw.offset, baseOffset * 0.2)),
    droop: DROOP_VALUE[answers.droop],
    thickness: round3(Math.max(0.1, 0.4 - index * 0.05)),
    pattern: {
      kind: answers.pattern_kind,
      color: palette(answers.pattern_color),
      scale: round3(clamp(0.1, 0.9, 0.5 + jit(draw.patternScale, 0.2))),
      density: round3(clamp(0.1, 0.9, 0.5 + jit(draw.patternDensity, 0.2))),
      extent: round3(clamp(0.2, 0.9, 0.5 + jit(draw.patternExtent, 0.2))),
    },
    fusion: {
      kind: outer ? answers.fusion_kind : "Free",
      depth: round3(clamp(0.2, 0.8, 0.5 + jit(draw.fusionDepth, 0.15))),
    },
  };
}

type Layers = readonly PetalLayerJson[];

const updateLast = (
  layers: Layers,
  update: (layer: PetalLayerJson) => PetalLayerJson,
): Layers =>
  layers.map((layer, index) =>
    index === layers.length - 1 ? update(layer) : layer,
  );

function labellumShape(ctx: Context, outer: PetalShape): PetalShape {
  if (ctx.answers.inner_shape !== outer) return ctx.answers.inner_shape;
  return (
    legalList(ctx.profile, ctx.strangeness, "innerShapes").find(
      shape => shape !== outer,
    ) ?? "Panduriform"
  );
}

function labellumPattern(ctx: Context): PatternKind {
  if (ctx.answers.pattern_kind !== "None") return ctx.answers.pattern_kind;
  return (
    legalList(ctx.profile, ctx.strangeness, "patterns").find(
      kind => kind !== "None",
    ) ?? "Spots"
  );
}

// Spec 4.5: Labellum gives the inner layer a different shape and a pattern,
// Corona forces the inner layer to Trumpet, Spur adds a Tube layer of count 1.
// Composite and Bell act through SKELETON_NARROWING on the answers instead.
const SPECIAL_LAYERS: Record<
  SpecialStructure,
  (layers: Layers, ctx: Context) => Layers
> = {
  None: layers => layers,
  Umbel: layers => layers,
  Composite: layers => layers,
  Bell: layers => layers,
  Labellum: (layers, ctx) => {
    const outer = first(layers, "layers").shape;
    return updateLast(layers, layer => ({
      ...layer,
      shape: labellumShape(ctx, outer),
      pattern: { ...layer.pattern, kind: labellumPattern(ctx) },
    }));
  },
  Corona: layers =>
    updateLast(layers, layer => ({
      ...layer,
      fusion: { ...layer.fusion, kind: "Trumpet" },
    })),
  Spur: (layers, ctx) => {
    const inner = at(layers, layers.length - 1, "layers");
    const spur = petalLayer(ctx, layers.length, 1);
    return [
      ...layers,
      {
        ...spur,
        shape: "Tubular",
        fusion: { kind: "Tube", depth: 0.9 },
        length: round3(inner.length * 0.8),
        width: round3(Math.max(0.2, inner.width * 0.4)),
      },
    ];
  },
};

function petalLayers(ctx: Context): Layers {
  const { profile, answers } = ctx;
  const outer = outerPetalCount(profile, answers.petal_count_class);
  const counts = layerCounts(ctx, outer, layerCount(ctx));
  const built = counts.map((count, index) => petalLayer(ctx, index, count));
  return SPECIAL_LAYERS[profile.special](built, ctx);
}

// ═══════════════════════════════════════════════════════════════════════════
// Center, sepals, stem, foliage, ornament
// ═══════════════════════════════════════════════════════════════════════════

type Structure = FlowerSpecJson["structure"];
type Reproductive = FlowerSpecJson["reproductive"];
type Ornamentation = FlowerSpecJson["ornamentation"];
type Foliage = FlowerSpecJson["foliage"];
type Aura = NonNullable<FlowerSpecJson["aura"]>;

function stamens(ctx: Context): StamenJson[] {
  const { profile, answers, jitter, jit } = ctx;
  const { fraction, height } = STAMEN_VALUE[answers.stamen_prominence];
  const [lo, hi] = profile.stamenRange;
  const count =
    fraction === 0 || hi === 0
      ? 0
      : clamp(1, MAX_STAMENS, Math.round(lerp(lo, hi, fraction)));
  return jitter.stamens.slice(0, count).map(u => ({
    filament_curve: 0.2,
    filament_color: palette(answers.filament_color),
    anther_shape: first(ANTHER_SHAPES, "ANTHER_SHAPES"),
    anther_color: palette(answers.anther_color),
    pollen_load: 0.5,
    height: round3(clamp(0.05, 1, height + jit(u, 0.1))),
    sway: 0.3,
  }));
}

// A composite head keeps a large disc; a fused corolla has no separate disc.
function receptacleSize(
  profile: FamilyProfile,
  drawn: number,
  fusedOuter: boolean,
): number {
  if (profile.disc) return Math.max(0.6, drawn);
  if (fusedOuter) return Math.min(0.3, drawn);
  return drawn;
}

function receptacle(ctx: Context, layers: Layers): Structure["receptacle"] {
  const { profile, answers, jitter } = ctx;
  const [lo, hi] = profile.receptacleSize;
  const fusedOuter = first(layers, "layers").fusion.kind !== "Free";
  return {
    shape: profile.disc ? "Flat" : "Convex",
    size: round3(
      receptacleSize(profile, lerp(lo, hi, jitter.receptacle), fusedOuter),
    ),
    color: palette(answers.receptacle_color),
  };
}

function sepalColor(answers: StageTwoAnswers): Rgba {
  const leaf = hexToRgba(LEAF_COLORS[answers.leaf_color]);
  const colors: Record<SepalColorName, Rgba> = {
    green: leaf,
    matching: palette(answers.outer_base_color),
    contrasting: tipColor(answers.outer_base_color, answers.outer_tip_color),
    dark: darken(leaf, 0.5),
  };
  return colors[answers.sepal_color];
}

function sepals(ctx: Context): Structure["sepals"] {
  const { profile, answers, jitter, jit } = ctx;
  const sepal: Structure["sepals"][number] = {
    shape: first(profile.sepalShapes, `${profile.key}.sepalShapes`),
    color: sepalColor(answers),
    reflex_angle: SEPAL_REFLEX_ANGLE[answers.sepal_reflex],
    texture: "Smooth",
    length: round3(clamp(0.1, 0.6, 0.3 + jit(jitter.sepalLength, 0.05))),
    persistent: true,
  };
  return Array.from({ length: profile.sepalCount }, () => sepal);
}

function buds(ctx: Context): BudJson[] {
  const { answers, jitter, jit } = ctx;
  return jitter.buds
    .slice(0, BUD_COUNT_VALUE[answers.bud_count_class])
    .map((bud, index) => ({
      position: round3(
        clamp(0.4, 0.95, 0.55 + index * 0.12 + jit(bud.position, 0.04)),
      ),
      side: index % 2 === 0 ? "Right" : "Left",
      size: round3(clamp(0.1, 0.6, 0.3 + jit(bud.size, 0.1))),
      openness: round3(
        clamp(0, 0.6, 0.15 + index * 0.1 + jit(bud.openness, 0.1)),
      ),
    }));
}

const STEM_BRANCHING: Record<InflorescenceKind, BranchPattern> = {
  Solitary: "None",
  Spike: "None",
  Raceme: "Alternate",
  Umbel: "Whorled",
  Corymb: "Alternate",
  Panicle: "Dichotomous",
  Spray: "Sympodial",
};

const STEM_CURVATURE: Record<StemStyle, number> = {
  Straight: 0,
  Arching: 0.4,
  Sinuous: 0.5,
  Zigzag: 0.3,
  Twining: 0.6,
  Succulent: 0.05,
  Woody: 0.1,
  Trailing: 0.8,
};

type Inflorescence = FlowerSpecJson["inflorescence"];

/** A cluster of heads stands on a stem this many times a solitary one's, sparse to dense. */
const CLUSTER_HEIGHT = [1.3, 1.6] as const;

/** Where the head count sits in its kind's range, 0 sparse to 1 dense. */
function clusterDensity(inflorescence: Inflorescence): number {
  const [lo, hi] = KIND_HEAD_RANGE[inflorescence.kind];
  return hi > lo ? clamp(0, 1, (inflorescence.head_count - lo) / (hi - lo)) : 0;
}

/** A multi-head stem is 1.3 to 1.6 times the solitary height, capped at the schema max. */
function clusterHeight(height: number, inflorescence: Inflorescence): number {
  if (inflorescence.kind === "Solitary") return height;
  return Math.min(
    1,
    height *
      lerp(CLUSTER_HEIGHT[0], CLUSTER_HEIGHT[1], clusterDensity(inflorescence)),
  );
}

function stem(ctx: Context, inflorescence: Inflorescence): Structure["stem"] {
  const { answers, jitter, jit } = ctx;
  const color = hexToRgba(STEM_COLORS[answers.stem_color]);
  const thorns: Pick<Structure["stem"], "thorns"> = answers.has_thorns
    ? {
        thorns: {
          density: 0.4,
          size: 0.15,
          color: darken(color, 0.7),
          shape: answers.thorn_shape,
          curve: 0.2,
        },
      }
    : {};
  const answeredHeight = clamp(
    0.2,
    1,
    STEM_HEIGHT_VALUE[answers.stem_height] + jit(jitter.stemHeight, 0.05),
  );
  return {
    height: round3(clusterHeight(answeredHeight, inflorescence)),
    thickness: STEM_THICKNESS_VALUE[answers.stem_thickness],
    curvature: STEM_CURVATURE[answers.stem_style],
    color,
    ...thorns,
    internode_length: 0.5,
    surface: answers.stem_surface,
    branching: STEM_BRANCHING[answers.inflorescence_kind],
    style: answers.stem_style,
  };
}

/**
 * Floret size class, 0 small to 1 large, before jitter: every floret of a
 * cluster is the same size class, a dense corymb small and a spray large.
 * Solitary has no florets to size.
 */
const HEAD_SCALE: Record<InflorescenceKind, number> = {
  Solitary: 0.6,
  Spike: 0.35,
  Raceme: 0.5,
  Umbel: 0.5,
  Corymb: 0.3,
  Panicle: 0.4,
  Spray: 0.85,
};

/** A head count in the class's share of the kind's range, the jitter picking the spot. */
function headCount(
  kind: InflorescenceKind,
  cls: HeadCountClass,
  draw: number,
): number {
  if (kind === "Solitary") return 1;
  const [lo, hi] = KIND_HEAD_RANGE[kind];
  const [from, to] = HEAD_COUNT_SHARE[cls];
  const low = lo + (hi - lo) * from;
  const high = lo + (hi - lo) * to;
  return Math.round(lerp(low, high, draw));
}

function inflorescence(ctx: Context): Inflorescence {
  const { answers, jitter, jit } = ctx;
  const kind = answers.inflorescence_kind;
  return {
    kind,
    head_count: headCount(kind, answers.head_count_class, jitter.headCount),
    head_scale: round3(
      clamp(0.2, 1, HEAD_SCALE[kind] + jit(jitter.headScale, 0.1)),
    ),
    spread: round3(clamp(0.1, 1, 0.5 + jit(jitter.spread, 0.2))),
  };
}

function leaves(ctx: Context): LeafJson[] {
  const { profile, answers, jitter, jit } = ctx;
  const count = LEAF_COUNT_VALUE[answers.leaf_count_class];
  const step = count > 1 ? 0.6 / (count - 1) : 0;
  const color = solid(hexToRgba(LEAF_COLORS[answers.leaf_color]));
  return jitter.leaves.slice(0, count).map((leaf, index) => ({
    shape: answers.leaf_shape,
    size: round3(clamp(0.2, 1, 0.55 - index * 0.04 + jit(leaf.size, 0.08))),
    color,
    vein_pattern: answers.leaf_vein,
    serration: answers.serration,
    arrangement: first(
      profile.leafArrangements,
      `${profile.key}.leafArrangements`,
    ),
    phyllotaxis_angle: 137.5,
    droop: LEAF_DROOP_VALUE[answers.leaf_droop],
    curl: 0.1,
    translucency: answers.leaf_translucency ? 0.7 : 0.2,
    position: round3(
      clamp(0.2, 0.9, 0.25 + step * index + jit(leaf.position, 0.04)),
    ),
    side: index % 2 === 0 ? "Left" : "Right",
    angle_offset: round3(
      (index % 2 === 0 ? 0.06 : -0.09) + jit(leaf.angle, 0.05),
    ),
    variegation: {
      kind: answers.leaf_variegation,
      color: palette(answers.variegation_color),
    },
  }));
}

// A composite involucre is a ring of small green scales; every other family
// shows its bracts as a colored ring under the head.
function bracts(ctx: Context, outerCount: number): Foliage["bracts"] {
  const { profile, answers } = ctx;
  if (!answers.bracts) return [];
  const composite = profile.special === "Composite";
  const bract: Foliage["bracts"][number] = {
    color: solid(
      composite
        ? hexToRgba(LEAF_COLORS[answers.leaf_color])
        : palette(answers.bract_color),
    ),
    size: composite ? 0.3 : 0.5,
    shape: "Lanceolate",
    showy: !composite,
    position: 0.95,
  };
  return Array.from({ length: clamp(3, 8, outerCount) }, () => bract);
}

const PARTICLE_GRAVITY: Record<ParticleKind, number> = {
  Pollen: 0.2,
  Firefly: 0,
  Stardust: -0.3,
  FallingPetals: 0.5,
  Spores: -0.1,
  Motes: 0,
  Embers: -0.6,
  Butterflies: 0,
  Snowflakes: 0.3,
  Sparkle: 0,
  Seeds: 0.4,
  Bubbles: -0.4,
  Lightning: 0,
  Raindrops: 0.9,
};

function particles(answers: StageTwoAnswers): Ornamentation["particles"] {
  const kind = answers.particle_kind;
  if (kind === NONE) return [];
  return [
    {
      kind,
      density: 20,
      color: palette(answers.particle_color),
      drift_speed: 0.3,
      lifetime: 3,
      emission_zone: "Whole",
      gravity: PARTICLE_GRAVITY[kind],
    },
  ];
}

function dewdrops(answers: StageTwoAnswers): Ornamentation["dewdrops"] {
  const count = DEWDROP_COUNT[answers.dewdrops];
  if (count === 0) return [];
  return [
    {
      size: count > 4 ? 0.04 : 0.05,
      count,
      refraction: 0.5,
      placement: "Random",
      surface_tension: 0.6,
    },
  ];
}

function ornamentation(answers: StageTwoAnswers): Ornamentation {
  const tip = tipColor(answers.outer_base_color, answers.outer_tip_color);
  const iridescence: Pick<Ornamentation, "iridescence"> = answers.iridescence
    ? {
        iridescence: {
          intensity: 0.6,
          hue_shift_range: 60,
          affected_parts: ["petals"],
        },
      }
    : {};
  const bioluminescence: Pick<Ornamentation, "bioluminescence"> =
    answers.bioluminescence
      ? {
          bioluminescence: {
            pattern: "Veins",
            color: tip,
            intensity: 0.7,
            trigger: "Night",
          },
        }
      : {};
  return {
    dewdrops: dewdrops(answers),
    particles: particles(answers),
    ...iridescence,
    ...bioluminescence,
  };
}

function aura(answers: StageTwoAnswers): Aura | undefined {
  const kind = answers.aura_kind;
  if (kind === NONE) return undefined;
  return {
    kind,
    color: palette(answers.aura_color),
    opacity: 0.25,
    radius: 0.45,
    animation_speed: 0.5,
  };
}

function reproductive(ctx: Context): Reproductive {
  const { profile, answers, jitter } = ctx;
  const anther = palette(answers.anther_color);
  const throat = palette(answers.pattern_color);
  const pollen: Pick<Reproductive, "pollen"> = answers.pollen_drift
    ? {
        pollen: {
          particle_count: 12 + Math.floor(jitter.pollenCount * 12),
          drift_speed: 0.3,
          color: anther,
          luminosity: answers.bioluminescence ? 0.7 : 0.2,
          dispersal: "Wind",
          trail: false,
        },
      }
    : {};
  const nectary: Pick<Reproductive, "nectary"> = answers.nectary_glow
    ? {
        nectary: {
          position: "Basal",
          color: throat,
          glow: { intensity: 0.6, color: throat, radius: 0.3 },
          drip_rate: 0.2,
        },
      }
    : {};
  return {
    pistil: {
      style: first(profile.pistilStyles, `${profile.key}.pistilStyles`),
      stigma_shape: answers.stigma_shape,
      color: palette(answers.pistil_color),
      height: profile.disc ? 0.15 : 0.35,
    },
    stamens: stamens(ctx),
    ...pollen,
    ...nectary,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Taxonomy and name
// ═══════════════════════════════════════════════════════════════════════════

const EPITHET_SUFFIXES = ["a", "um", "is", "ensis", "iflora", "oides"] as const;

function taxonomy(
  profile: FamilyProfile,
  noun: NameNoun,
  template: TemplateInfo | undefined,
  epithetDraw: number,
  commonName: string,
): FlowerSpecJson["taxonomy"] {
  return {
    family: profile.key,
    genus: template?.genus ?? profile.typicalGenus,
    species_name:
      template?.epithet ??
      `${noun.toLowerCase()}${pickUnit(EPITHET_SUFFIXES, epithetDraw, "EPITHET_SUFFIXES")}`,
    common_name: commonName,
    botanical_class: profile.botanicalClass,
  };
}

const speciesOf = (tax: FlowerSpecJson["taxonomy"]): string =>
  tax.species_name === "" ? tax.genus : `${tax.genus} ${tax.species_name}`;

// ═══════════════════════════════════════════════════════════════════════════
// Entry point
// ═══════════════════════════════════════════════════════════════════════════

export function assembleSpec(input: AssembleInput): FlowerSpecJson {
  const { profile, strangeness, stageOne, template } = input;
  const jitter = drawJitter(createRng(input.seed));
  const answers = resolveAnswers(
    profile,
    strangeness,
    input.answers,
    jitter.noun,
    template,
  );
  const amp = JITTER_AMPLITUDE[strangeness];
  const ctx: Context = {
    profile,
    strangeness,
    answers,
    jitter,
    jit: (unit, scale) => (unit * 2 - 1) * scale * amp,
  };
  const layers = petalLayers(ctx);
  const outerCount = first(layers, "layers").count;
  const name = template
    ? `${stageOne.mood} ${template.name}`
    : `${stageOne.mood} ${answers.name_noun}`;
  const tax = taxonomy(
    profile,
    answers.name_noun,
    template,
    jitter.epithet,
    name,
  );
  const foliageLeaves = leaves(ctx);
  const auraValue = aura(answers);
  const heads = inflorescence(ctx);

  const spec: FlowerSpecJson = {
    name,
    species: speciesOf(tax),
    taxonomy: tax,
    petals: {
      layers: [...layers],
      bloom_progress: 1,
      wilt_progress: 0,
      symmetry: profile.symmetry,
      symmetry_order: profile.symmetry === "Radial" ? outerCount : 0,
      divergence_angle: 137.5,
      stage: answers.life_stage,
    },
    reproductive: reproductive(ctx),
    structure: {
      stem: stem(ctx, heads),
      sepals: sepals(ctx),
      receptacle: receptacle(ctx, layers),
      buds: buds(ctx),
    },
    foliage: {
      leaves: foliageLeaves,
      bracts: bracts(ctx, outerCount),
      leaf_density: round3(foliageLeaves.length / MAX_LEAVES),
    },
    ornamentation: ornamentation(answers),
    ...(auraValue ? { aura: auraValue } : {}),
    inflorescence: heads,
  };
  return FlowerSpecSchema.parse(spec);
}
