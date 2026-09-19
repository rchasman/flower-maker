import {
  choice,
  noul,
  type SystemOneResult,
  type TypeSafeClient,
} from "@typesafe-ai/sdk";
import { stringify as toYaml } from "yaml";
import {
  TEMPLATES,
  type TemplateInfo,
} from "../../client/src/data/templates.ts";

// Jev answers typed questions; it does not write text. Every field a FlowerSpec
// needs is therefore a selection from a closed set, and code assembles the spec.

const PALETTE = {
  crimson: "#dc2626",
  scarlet: "#ef4444",
  coral: "#fb7185",
  pink: "#ec4899",
  blush: "#fbcfe8",
  peach: "#fdba74",
  orange: "#f97316",
  gold: "#eab308",
  yellow: "#facc15",
  cream: "#fef3c7",
  white: "#f5f5f5",
  lavender: "#c4b5fd",
  violet: "#a855f7",
  indigo: "#6366f1",
  blue: "#3b82f6",
  sky: "#7dd3fc",
  teal: "#14b8a6",
  green: "#22c55e",
  lime: "#a3e635",
  burgundy: "#7f1d1d",
  brown: "#92400e",
  black: "#171717",
  silver: "#d4d4d8",
} as const;
type PaletteName = keyof typeof PALETTE;

const PALETTE_CRITERIA = Object.fromEntries(
  Object.keys(PALETTE).map(name => [name, null]),
) as Record<PaletteName, null>;

const PETAL_SHAPES = {
  Ovate: "egg shaped, broad base",
  Lanceolate: "long and narrow, pointed tip",
  Spatulate: "spoon shaped, wide rounded tip",
  Oblong: "long with parallel sides",
  Orbicular: "nearly circular",
  Cordate: "heart shaped",
  Deltoid: "triangular",
  Falcate: "sickle curved",
  Ligulate: "strap like ray petal, as on a daisy",
  Tubular: "rolled into a tube",
  Fimbriate: "fringed tip",
  Laciniate: "deeply slashed into narrow lobes",
  Runcinate: "saw toothed lobes pointing backward",
  Cuneate: "wedge shaped, narrow base",
  Acuminate: "tapering to a long sharp point",
  Panduriform: "fiddle shaped with a waist",
  Unguiculate: "clawed narrow base with a broad blade",
  Flabellate: "fan shaped",
  Obovate: "egg shaped, narrow base",
  Rhomboid: "diamond shaped",
  Filiform: "thread like",
  Reniform: "kidney shaped",
  Sagittate: "arrowhead shaped",
} as const;

const ARRANGEMENTS = {
  Radial: "evenly around the center",
  Spiral: "overlapping in a spiral, like a rose",
  Bilateral: "mirror symmetry, left and right",
  Imbricate: "overlapping like roof tiles",
  Valvate: "edges meeting without overlap",
  Contorted: "twisted, each petal overlapping the next on one side",
  Whorled: "rings of petals",
  Papilionaceous: "butterfly form, like a sweet pea",
  Cruciform: "four petals in a cross",
  Zygomorphic: "one plane of symmetry, like an orchid",
} as const;

const EDGE_STYLES = {
  Smooth: null,
  Ruffled: null,
  Fringed: null,
  Serrated: null,
  Rolled: null,
  Undulate: "wavy",
  Crisped: "tightly crinkled",
  Lacerate: "torn looking",
  Lobed: null,
  Plicate: "folded like a fan",
  Revolute: "rolled back at the margin",
  Dentate: "toothed",
  Erose: "irregularly gnawed",
} as const;

const TEXTURES = {
  Smooth: null,
  Velvet: null,
  Silk: null,
  Papery: null,
  Waxy: null,
  Rough: null,
  Hairy: null,
  Glassy: null,
  Crystalline: null,
  Scaled: null,
  Metallic: null,
  Pearlescent: null,
  Fuzzy: null,
  Frosted: null,
  Leathery: null,
  Powdery: null,
} as const;

const VEIN_PATTERNS = {
  None: null,
  Parallel: null,
  Branching: null,
  Palmate: null,
  Reticulate: "net like",
  Dichotomous: "forking in pairs",
  Arcuate: "curving toward the tip",
  Pinnate: "feather like",
  Anastomosing: "veins rejoining",
} as const;

const LEAF_SHAPES = {
  Ovate: null,
  Lanceolate: null,
  Cordate: "heart shaped",
  Palmate: "hand shaped",
  Pinnate: "feather like leaflets",
  Linear: "grass like",
  Reniform: "kidney shaped",
  Sagittate: "arrowhead",
  Peltate: "stalk attached to the center",
  Acicular: "needle like",
  Hastate: "spear shaped with flaring lobes",
  Obovate: null,
  Elliptic: null,
  Oblanceolate: null,
  Deltoid: "triangular",
  Spatulate: null,
  Orbicular: "round",
  Lyrate: "lyre shaped",
  Cuneate: "wedge shaped",
  Falcate: "sickle shaped",
  Bipinnate: "fern like, twice divided",
} as const;

const SERRATIONS = {
  None: null,
  Fine: null,
  Coarse: null,
  Lobed: null,
  Crenate: "rounded teeth",
  Dentate: "sharp teeth",
  Doubly: "teeth on teeth",
  Spinose: "spiny",
  Ciliate: "hair fringed",
} as const;

const STEM_STYLES = {
  Straight: null,
  Arching: "graceful curve",
  Sinuous: "S bend",
  Zigzag: "angular joints",
  Twining: "climber",
  Succulent: "thick and fleshy",
  Woody: "tree like base",
  Trailing: "hanging down",
} as const;

const AURA_KINDS = {
  none: "no glow or halo around the flower",
  Mist: null,
  Sparkle: null,
  Ethereal: null,
  Prismatic: null,
  Shadow: null,
  Flame: null,
  Frost: null,
  Electric: null,
  Aurora: null,
  Nebula: null,
  Crystal: null,
  Moonlight: null,
  Solar: null,
  Void: null,
  Rainbow: null,
  Storm: null,
} as const;

const NAME_WORDS = {
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
} as const;

const PETAL_COUNTS = {
  three_or_four: "3 or 4 petals, like a trillium or a mustard flower",
  five_or_six: "5 or 6 petals, like a wild rose, a lily or a tulip",
  eight_to_thirteen: "8 to 13 petals, like a cosmos or a single dahlia",
  fifteen_to_twenty: "15 to 21 petals, like a daisy or a gerbera",
  thirty_or_more:
    "30 or more petals, like a sunflower, a carnation or a pompon",
} as const;
const PETAL_COUNT_VALUE: Record<keyof typeof PETAL_COUNTS, number> = {
  three_or_four: 4,
  five_or_six: 5,
  eight_to_thirteen: 10,
  fifteen_to_twenty: 21,
  thirty_or_more: 34,
};

const LAYER_COUNTS = {
  single: "one ring of petals",
  double: "two rings of petals",
  triple: "three or more rings, dense like a rose or a peony",
} as const;
const LAYER_COUNT_VALUE: Record<keyof typeof LAYER_COUNTS, number> = {
  single: 1,
  double: 2,
  triple: 3,
};

const PETAL_POSES = {
  recurved: "petals bend backward and away from the center",
  open: "petals lie flat and open",
  cupped: "petals curve gently inward, bowl shaped",
  tight: "petals curve strongly inward, a closed bud like form",
} as const;
const POSE_CURVATURE: Record<
  keyof typeof PETAL_POSES,
  { curvature: number; curl: number }
> = {
  recurved: { curvature: -0.3, curl: 0.5 },
  open: { curvature: 0.0, curl: 0.1 },
  cupped: { curvature: 0.3, curl: 0.1 },
  tight: { curvature: 0.7, curl: 0.0 },
};

const STEM_HEIGHTS = {
  short: "low, compact, ground hugging",
  medium: "a typical cut flower stem",
  tall: "very tall, towering",
} as const;
const STEM_HEIGHT_VALUE: Record<
  keyof typeof STEM_HEIGHTS,
  { height: number; leafCount: number }
> = {
  short: { height: 0.4, leafCount: 2 },
  medium: { height: 0.6, leafCount: 3 },
  tall: { height: 0.85, leafCount: 4 },
};

const RECEPTACLES = {
  hidden: "no visible central disc, petals meet at the middle",
  small: "a small central boss or button",
  large_disc: "a large flat central disc, like a daisy or a sunflower",
} as const;
const RECEPTACLE_VALUE: Record<
  keyof typeof RECEPTACLES,
  { shape: string; size: number }
> = {
  hidden: { shape: "Flat", size: 0.2 },
  small: { shape: "Convex", size: 0.4 },
  large_disc: { shape: "Flat", size: 0.8 },
};

const STAMEN_PROMINENCE = {
  hidden: "stamens not visible",
  modest: "a few short stamens at the center",
  prominent: "long showy stamens, like a lily or a hibiscus",
} as const;
const STAMEN_VALUE: Record<
  keyof typeof STAMEN_PROMINENCE,
  { count: number; height: number }
> = {
  hidden: { count: 0, height: 0 },
  modest: { count: 5, height: 0.3 },
  prominent: { count: 6, height: 0.65 },
};

const TEMPLATE_CRITERIA = Object.fromEntries(
  TEMPLATES.map(t => [t.name, t.scientific]),
);

const SAME_AS_PRIMARY = "same_as_primary";

export const FLOWER_QUESTIONS = {
  template: choice(
    "Which real flower in the list is the closest botanical starting point for the flower described in `request`?",
    TEMPLATE_CRITERIA,
  ),
  name_word: choice(
    "Which single word best fits the mood and colour of the flower described in `request`? It becomes the first word of the flower's name.",
    NAME_WORDS,
  ),
  petal_shape: choice(
    "Which petal shape fits the flower described in `request`?",
    PETAL_SHAPES,
  ),
  arrangement: choice(
    "How are the petals arranged on the flower described in `request`?",
    ARRANGEMENTS,
  ),
  edge_style: choice(
    "What is the edge of each petal like on the flower described in `request`?",
    EDGE_STYLES,
  ),
  texture: choice(
    "What is the surface texture of the petals on the flower described in `request`?",
    TEXTURES,
  ),
  vein_pattern: choice(
    "What vein pattern do the petals show on the flower described in `request`?",
    VEIN_PATTERNS,
  ),
  petal_count: choice(
    "How many petals are in one ring of the flower described in `request`?",
    PETAL_COUNTS,
  ),
  layer_count: choice(
    "How many rings of petals does the flower described in `request` have?",
    LAYER_COUNTS,
  ),
  petal_pose: choice(
    "How do the petals curve on the flower described in `request`?",
    PETAL_POSES,
  ),
  primary_color: choice(
    "What is the main petal colour of the flower described in `request`?",
    PALETTE_CRITERIA,
  ),
  secondary_color: choice(
    "What colour do the petals shade into toward their tips on the flower described in `request`? Pick same_as_primary when the petals are one flat colour.",
    {
      ...PALETTE_CRITERIA,
      [SAME_AS_PRIMARY]: "the petals are a single colour",
    },
  ),
  center_color: choice(
    "What colour is the centre (pistil and anthers) of the flower described in `request`?",
    PALETTE_CRITERIA,
  ),
  stem_style: choice(
    "What is the growth habit of the stem of the flower described in `request`?",
    STEM_STYLES,
  ),
  stem_height: choice(
    "How tall is the stem of the flower described in `request`?",
    STEM_HEIGHTS,
  ),
  leaf_shape: choice(
    "What leaf shape does the flower described in `request` have?",
    LEAF_SHAPES,
  ),
  serration: choice(
    "What is the leaf margin like on the flower described in `request`?",
    SERRATIONS,
  ),
  receptacle: choice(
    "What does the centre of the bloom look like on the flower described in `request`?",
    RECEPTACLES,
  ),
  stamens: choice(
    "How prominent are the stamens on the flower described in `request`?",
    STAMEN_PROMINENCE,
  ),
  aura: choice(
    "Does `request` describe a glow, halo or magical atmosphere around the flower, and if so which kind? Pick none for an ordinary flower.",
    AURA_KINDS,
  ),
  aura_color: choice(
    "If the flower described in `request` has a glow or halo, what colour is it?",
    PALETTE_CRITERIA,
  ),
  has_thorns: noul(
    "Does the flower described in `request` have thorns on its stem?",
    {
      true: "the request names thorns, spines or prickles, or the flower is a rose or a bramble",
      false: "no thorns are mentioned or implied",
    },
  ),
  has_dewdrops: noul(
    "Does `request` describe water droplets, dew, rain or wetness on the flower?",
  ),
};

export type FlowerAnswers = SystemOneResult<typeof FLOWER_QUESTIONS>["answers"];

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

function hexToRgba(hex: string): Rgba {
  const value = parseInt(hex.slice(1), 16);
  return {
    r: Math.round((((value >> 16) & 0xff) / 255) * 1000) / 1000,
    g: Math.round((((value >> 8) & 0xff) / 255) * 1000) / 1000,
    b: Math.round(((value & 0xff) / 255) * 1000) / 1000,
    a: 1.0,
  };
}

function darken(color: Rgba, factor: number): Rgba {
  return {
    r: Math.round(color.r * factor * 1000) / 1000,
    g: Math.round(color.g * factor * 1000) / 1000,
    b: Math.round(color.b * factor * 1000) / 1000,
    a: 1.0,
  };
}

const LEAF_GREEN = hexToRgba("#166534");
const STEM_GREEN = hexToRgba("#15803d");

function petalLayers(answers: FlowerAnswers) {
  const layerCount = LAYER_COUNT_VALUE[answers.layer_count.choice];
  const outerCount = PETAL_COUNT_VALUE[answers.petal_count.choice];
  const pose = POSE_CURVATURE[answers.petal_pose.choice];
  const primary = hexToRgba(PALETTE[answers.primary_color.choice]);
  const secondaryChoice = answers.secondary_color.choice;
  const secondary =
    secondaryChoice === SAME_AS_PRIMARY
      ? darken(primary, 0.8)
      : hexToRgba(PALETTE[secondaryChoice]);
  const arrangement =
    layerCount > 1 && answers.arrangement.choice === "Radial"
      ? "Spiral"
      : answers.arrangement.choice;

  return Array.from({ length: layerCount }, (_, index) => {
    const count = Math.max(3, Math.round(outerCount * Math.pow(0.7, index)));
    const inwardStep = index * 0.3;
    return {
      index,
      count,
      shape: answers.petal_shape.choice,
      arrangement,
      curvature: Math.min(0.8, pose.curvature + inwardStep),
      curl: Math.max(0, pose.curl - index * 0.2),
      texture: answers.texture.choice,
      color: {
        stops: [
          {
            position: 0.0,
            color: index === 0 ? primary : darken(primary, 1 - index * 0.08),
          },
          { position: 1.0, color: secondary },
        ],
      },
      opacity: 1.0,
      vein_pattern: answers.vein_pattern.choice,
      edge_style: answers.edge_style.choice,
      width: Math.round((1.1 - index * 0.15) * 100) / 100,
      length: Math.round((1.5 - index * 0.2) * 100) / 100,
      angular_offset: index === 0 ? 0.0 : Math.round((180 / count) * 100) / 100,
      droop: 0.1 + index * 0.05,
      thickness: 0.4 - index * 0.05,
    };
  });
}

function leaves(count: number) {
  const span = 0.55;
  return Array.from({ length: count }, (_, i) => ({
    position:
      Math.round((0.28 + (span / Math.max(1, count - 1)) * i) * 100) / 100,
    side: i % 2 === 0 ? "left" : "right",
    size: Math.round((0.55 - i * 0.05) * 100) / 100,
    angle_offset:
      Math.round(((i % 2 === 0 ? 0.06 : -0.09) + i * 0.02) * 100) / 100,
  }));
}

function stamens(answers: FlowerAnswers, centerColor: Rgba) {
  const { count, height } = STAMEN_VALUE[answers.stamens.choice];
  return Array.from({ length: count }, (_, i) => ({
    filament_curve: 0.2,
    filament_color: hexToRgba(PALETTE.cream),
    anther_shape: "Versatile",
    anther_color: centerColor,
    pollen_load: 0.5,
    height: Math.round((height + (i % 2) * 0.05) * 100) / 100,
    sway: 0.3,
  }));
}

export function assembleSpec(
  answers: FlowerAnswers,
  template: TemplateInfo,
): Record<string, unknown> {
  const stem = STEM_HEIGHT_VALUE[answers.stem_height.choice];
  const receptacle = RECEPTACLE_VALUE[answers.receptacle.choice];
  const centerColor = hexToRgba(PALETTE[answers.center_color.choice]);
  const auraKind = answers.aura.choice;

  return {
    name: `${answers.name_word.choice} ${template.name}`,
    species: template.scientific,
    structure: {
      stem: {
        height: stem.height,
        thickness: 0.3,
        curvature: 0.1,
        style: answers.stem_style.choice,
        color: STEM_GREEN,
        ...(answers.has_thorns.noul > 0.5
          ? {
              thorns: {
                density: 0.4,
                size: 0.15,
                color: darken(STEM_GREEN, 0.7),
              },
            }
          : {}),
      },
      sepals: [
        {
          shape: "Lanceolate",
          color: LEAF_GREEN,
          reflex_angle: 90.0,
          length: 0.3,
          persistent: true,
        },
      ],
      receptacle: {
        shape: receptacle.shape,
        size: receptacle.size,
        color: LEAF_GREEN,
      },
    },
    foliage: {
      leaf_shape: answers.leaf_shape.choice,
      leaf_color: LEAF_GREEN,
      serration: answers.serration.choice,
      droop: 0.15,
      leaves: leaves(stem.leafCount),
    },
    petals: {
      layers: petalLayers(answers),
      bloom_progress: 1.0,
      wilt_progress: 0.0,
    },
    reproductive: {
      pistil: {
        style: "Simple",
        stigma_shape: "Capitate",
        color: centerColor,
        height: 0.3,
      },
      stamens: stamens(answers, centerColor),
    },
    ...(answers.has_dewdrops.noul > 0.5
      ? {
          ornamentation: {
            dewdrops: [
              {
                size: 0.05,
                count: 4,
                refraction: 0.5,
                placement: "Random",
                surface_tension: 0.6,
              },
            ],
          },
        }
      : {}),
    ...(auraKind === "none"
      ? {}
      : {
          aura: {
            kind: auraKind,
            color: hexToRgba(PALETTE[answers.aura_color.choice]),
            opacity: 0.25,
            radius: 0.45,
            animation_speed: 0.5,
          },
        }),
  };
}

export interface JevGenerateInput {
  prompt: string;
  templateName?: string;
  model: string;
}

export async function generateSpecYamlWithJev(
  client: TypeSafeClient,
  input: JevGenerateInput,
): Promise<string> {
  const result = await client.systemOne({
    model: input.model,
    state: { request: input.prompt },
    questions: FLOWER_QUESTIONS,
  });
  const requested = TEMPLATES.find(t => t.name === input.templateName);
  const template =
    requested ?? TEMPLATES.find(t => t.name === result.answers.template.choice);
  if (!template)
    throw new Error(
      `Jev chose an unknown template: ${result.answers.template.choice}`,
    );
  return toYaml(assembleSpec(result.answers, template));
}
