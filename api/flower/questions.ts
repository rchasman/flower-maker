// The typed questions a model answers about the request. Stage one picks the
// family, template, strangeness and mood. Stage two asks only the degrees of
// freedom the family leaves open: every choice list is filtered by the profile
// and strangeness, and a list with one option is not asked at all because the
// assembler takes that value by default.
import type { Experimental_EvaluationQuestion as EvaluationQuestion } from "ai";
import { FLOWER_FAMILIES } from "../../client/src/data/flower-enums.ts";
import type { TemplateInfo } from "../../client/src/data/templates.ts";
import {
  BUD_COUNT_CLASS_DESCRIPTIONS,
  DEWDROP_CLASS_DESCRIPTIONS,
  DROOP_DESCRIPTIONS,
  GRADIENT_DIRECTION_DESCRIPTIONS,
  HEAD_COUNT_CLASS_DESCRIPTIONS,
  LAYER_COUNT_DESCRIPTIONS,
  LEAF_COUNT_CLASS_DESCRIPTIONS,
  LEAF_DROOP_DESCRIPTIONS,
  MOOD_WORDS,
  MOOD_WORD_DESCRIPTIONS,
  NAME_NOUN_DESCRIPTIONS,
  NONE,
  OPACITY_DESCRIPTIONS,
  PETAL_COUNT_CLASS_DESCRIPTIONS,
  POSE_DESCRIPTIONS,
  PROFILE_LIST_FOR_ANSWER,
  SEPAL_COLOR_DESCRIPTIONS,
  SEPAL_REFLEX_DESCRIPTIONS,
  STAGE_TWO_FIELDS,
  STAGE_TWO_IDS,
  STAMEN_PROMINENCE_DESCRIPTIONS,
  STEM_HEIGHT_DESCRIPTIONS,
  STEM_THICKNESS_DESCRIPTIONS,
  WIDTH_CLASS_DESCRIPTIONS,
  type StageTwoAnswers,
  type StageTwoId,
} from "./assemble.ts";
import {
  FAMILIES,
  STRANGENESS,
  STRANGENESS_DESCRIPTIONS,
  legalList,
  type FamilyProfile,
  type Strangeness,
} from "./families.ts";

export type Questions = Record<string, EvaluationQuestion>;

type Criteria = Readonly<Record<string, string | null>>;

const choice = (
  instructions: string,
  criteria: Criteria,
): EvaluationQuestion => ({ type: "choice", instructions, criteria });

const yesNo = (
  instructions: string,
  criteria: { true: string; false: string },
): EvaluationQuestion => ({ type: "boolean", instructions, criteria });

const criteriaFor = (
  options: readonly string[],
  descriptions: Criteria | undefined,
): Criteria =>
  Object.fromEntries(
    options.map(option => [option, descriptions?.[option] ?? null]),
  );

// ═══════════════════════════════════════════════════════════════════════════
// Stage one
// ═══════════════════════════════════════════════════════════════════════════

const FAMILY_CRITERIA: Criteria = Object.fromEntries(
  FLOWER_FAMILIES.map(key => {
    const profile = FAMILIES[key];
    return [
      key,
      `${profile.description}. Examples: ${profile.examples.join(", ")}`,
    ];
  }),
);

const templateCriteria = (templates: readonly TemplateInfo[]): Criteria => ({
  [NONE]: "no real cut flower is close; build from the family alone",
  ...Object.fromEntries(templates.map(t => [t.name, t.scientific])),
});

/**
 * Family and template are skipped when the request already names a template,
 * because the template decides both.
 */
export function stageOneQuestions(
  templates: readonly TemplateInfo[],
  template?: TemplateInfo,
): Questions {
  const lineage: Questions = template
    ? {}
    : {
        family: choice(
          "Which botanical family does the flower described in `request` belong to? Pick Invented when no real family fits.",
          FAMILY_CRITERIA,
        ),
        template: choice(
          "Which real cut flower is the closest starting point for the flower described in `request`, or none?",
          templateCriteria(templates),
        ),
      };
  return {
    ...lineage,
    strangeness: choice(
      "How far from a real plant is the flower described in `request`?",
      criteriaFor(STRANGENESS, STRANGENESS_DESCRIPTIONS),
    ),
    mood: choice(
      "Which single word best fits the mood and color of the flower described in `request`? It becomes the first word of the flower's name.",
      criteriaFor(MOOD_WORDS, MOOD_WORD_DESCRIPTIONS),
    ),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Stage two
// ═══════════════════════════════════════════════════════════════════════════

type BooleanId = {
  [K in StageTwoId]: StageTwoAnswers[K] extends boolean ? K : never;
}[StageTwoId];
type ChoiceId = Exclude<StageTwoId, BooleanId>;

const isBooleanId = (id: StageTwoId): id is BooleanId =>
  STAGE_TWO_FIELDS[id].type === "boolean";

type ChoiceText = { instructions: string; descriptions?: Criteria };

const CHOICE_TEXT: Record<ChoiceId, ChoiceText> = {
  outer_shape: {
    instructions:
      "Which shape do the outer petals of the flower described in `request` have?",
  },
  inner_shape: {
    instructions:
      "Which shape do the inner petals of the flower described in `request` have?",
  },
  petal_count_class: {
    instructions:
      "How many petals are in the outer ring of the flower described in `request`?",
    descriptions: PETAL_COUNT_CLASS_DESCRIPTIONS,
  },
  layer_count: {
    instructions:
      "How many rings of petals does the flower described in `request` have?",
    descriptions: LAYER_COUNT_DESCRIPTIONS,
  },
  pose: {
    instructions:
      "How do the petals curve on the flower described in `request`?",
    descriptions: POSE_DESCRIPTIONS,
  },
  width_class: {
    instructions:
      "How wide are the petals of the flower described in `request`?",
    descriptions: WIDTH_CLASS_DESCRIPTIONS,
  },
  droop: {
    instructions:
      "How are the petals held on the flower described in `request`?",
    descriptions: DROOP_DESCRIPTIONS,
  },
  edge_style: {
    instructions:
      "What is the edge of each petal like on the flower described in `request`?",
  },
  texture: {
    instructions:
      "What is the surface texture of the petals on the flower described in `request`?",
  },
  vein_pattern: {
    instructions:
      "What vein pattern do the petals show on the flower described in `request`?",
  },
  opacity: {
    instructions:
      "How much light passes through the petals of the flower described in `request`?",
    descriptions: OPACITY_DESCRIPTIONS,
  },
  outer_base_color: {
    instructions:
      "What color are the outer petals at their base on the flower described in `request`?",
  },
  outer_tip_color: {
    instructions:
      "What color are the outer petals at their tips on the flower described in `request`?",
  },
  inner_base_color: {
    instructions:
      "What color are the inner petals at their base on the flower described in `request`?",
  },
  inner_tip_color: {
    instructions:
      "What color are the inner petals at their tips on the flower described in `request`?",
  },
  gradient_direction: {
    instructions:
      "How do the two petal colors blend on the flower described in `request`?",
    descriptions: GRADIENT_DIRECTION_DESCRIPTIONS,
  },
  pattern_kind: {
    instructions:
      "What markings do the petals carry on the flower described in `request`?",
  },
  pattern_color: {
    instructions:
      "What color are the petal markings on the flower described in `request`?",
  },
  fusion_kind: {
    instructions:
      "Are the petals of the flower described in `request` fused into one corolla, and into which form?",
  },
  inflorescence_kind: {
    instructions:
      "How are the flower heads arranged on the stem of the flower described in `request`?",
  },
  head_count_class: {
    instructions:
      "How many flower heads does one stem of the flower described in `request` carry?",
    descriptions: HEAD_COUNT_CLASS_DESCRIPTIONS,
  },
  life_stage: {
    instructions:
      "At what stage of its life is the flower described in `request`?",
  },
  bud_count_class: {
    instructions:
      "How many side buds does the stem of the flower described in `request` carry?",
    descriptions: BUD_COUNT_CLASS_DESCRIPTIONS,
  },
  stamen_prominence: {
    instructions:
      "How prominent are the stamens on the flower described in `request`?",
    descriptions: STAMEN_PROMINENCE_DESCRIPTIONS,
  },
  filament_color: {
    instructions:
      "What color are the stamen filaments on the flower described in `request`?",
  },
  anther_color: {
    instructions:
      "What color are the anthers on the flower described in `request`?",
  },
  stigma_shape: {
    instructions:
      "What shape is the stigma at the center of the flower described in `request`?",
  },
  pistil_color: {
    instructions:
      "What color is the pistil of the flower described in `request`?",
  },
  receptacle_color: {
    instructions:
      "What color is the central disc or receptacle of the flower described in `request`?",
  },
  sepal_color: {
    instructions:
      "What color are the sepals under the flower described in `request`?",
    descriptions: SEPAL_COLOR_DESCRIPTIONS,
  },
  sepal_reflex: {
    instructions:
      "How are the sepals held under the flower described in `request`?",
    descriptions: SEPAL_REFLEX_DESCRIPTIONS,
  },
  bract_color: {
    instructions:
      "What color are the bracts under the head of the flower described in `request`?",
  },
  stem_style: {
    instructions:
      "What is the growth habit of the stem of the flower described in `request`?",
  },
  stem_height: {
    instructions: "How tall is the stem of the flower described in `request`?",
    descriptions: STEM_HEIGHT_DESCRIPTIONS,
  },
  stem_thickness: {
    instructions: "How thick is the stem of the flower described in `request`?",
    descriptions: STEM_THICKNESS_DESCRIPTIONS,
  },
  stem_color: {
    instructions:
      "What color is the stem of the flower described in `request`?",
  },
  stem_surface: {
    instructions:
      "What is the surface of the stem like on the flower described in `request`?",
  },
  thorn_shape: {
    instructions:
      "What shape are the thorns on the stem of the flower described in `request`?",
  },
  leaf_shape: {
    instructions:
      "What leaf shape does the flower described in `request` have?",
  },
  serration: {
    instructions:
      "What is the leaf margin like on the flower described in `request`?",
  },
  leaf_color: {
    instructions:
      "What color are the leaves of the flower described in `request`?",
  },
  leaf_variegation: {
    instructions:
      "Do the leaves of the flower described in `request` carry a second color, and where?",
  },
  variegation_color: {
    instructions:
      "What is the second leaf color on the flower described in `request`?",
  },
  leaf_count_class: {
    instructions:
      "How many leaves does the stem of the flower described in `request` carry?",
    descriptions: LEAF_COUNT_CLASS_DESCRIPTIONS,
  },
  leaf_droop: {
    instructions:
      "How are the leaves held on the flower described in `request`?",
    descriptions: LEAF_DROOP_DESCRIPTIONS,
  },
  leaf_vein: {
    instructions:
      "What vein pattern do the leaves show on the flower described in `request`?",
  },
  dewdrops: {
    instructions:
      "Does `request` describe water droplets, dew, rain or wetness on the flower, and how much?",
    descriptions: DEWDROP_CLASS_DESCRIPTIONS,
  },
  aura_kind: {
    instructions:
      "Does `request` describe a glow, halo or magical atmosphere around the flower, and if so which kind? Pick none for an ordinary flower.",
  },
  aura_color: {
    instructions:
      "If the flower described in `request` has a glow or halo, what color is it?",
  },
  particle_kind: {
    instructions:
      "Does `request` describe particles drifting around the flower, and if so which kind? Pick none for an ordinary flower.",
  },
  particle_color: {
    instructions:
      "If particles drift around the flower described in `request`, what color are they?",
  },
  name_noun: {
    instructions:
      "Which noun best names the form of the flower described in `request`? It becomes the last word of the flower's name.",
    descriptions: NAME_NOUN_DESCRIPTIONS,
  },
};

const BOOLEAN_TEXT: Record<
  BooleanId,
  { instructions: string; true: string; false: string }
> = {
  pollen_drift: {
    instructions:
      "Does `request` describe pollen drifting from the flower's anthers?",
    true: "pollen, dust or spores are mentioned or the flower is described as shedding",
    false: "no loose pollen is mentioned or implied",
  },
  nectary_glow: {
    instructions:
      "Does the throat of the flower described in `request` glow or hold visible nectar?",
    true: "a glowing throat, nectar or a lit center is mentioned",
    false: "nothing about the throat or nectar is mentioned",
  },
  bracts: {
    instructions:
      "Does the flower described in `request` carry showy bracts under its head?",
    true: "colored leaf like bracts under the head are mentioned, or the plant is a poinsettia, bougainvillea or protea type",
    false: "no bracts are mentioned or implied",
  },
  has_thorns: {
    instructions:
      "Does the flower described in `request` have thorns on its stem?",
    true: "the request names thorns, spines or prickles, or the flower is a rose or a bramble",
    false: "no thorns are mentioned or implied",
  },
  leaf_translucency: {
    instructions:
      "Are the leaves of the flower described in `request` translucent or see through?",
    true: "the leaves are described as glassy, thin, translucent or lit from within",
    false: "the leaves are ordinary opaque leaves",
  },
  iridescence: {
    instructions:
      "Do the petals of the flower described in `request` shimmer with shifting rainbow color?",
    true: "iridescent, opal, oil slick, holographic or shifting color is mentioned",
    false: "the petal colors are steady",
  },
  bioluminescence: {
    instructions:
      "Does the flower described in `request` produce its own light from within its tissues?",
    true: "bioluminescence, glowing veins or a flower lit from inside is mentioned",
    false: "the flower is lit only from outside",
  },
};

function choiceOptions(
  id: ChoiceId,
  profile: FamilyProfile,
  strangeness: Strangeness,
  hint: string | undefined,
): readonly string[] {
  const listName = PROFILE_LIST_FOR_ANSWER[id];
  const legal =
    listName === undefined
      ? STAGE_TWO_FIELDS[id].options
      : legalList(profile, strangeness, listName);
  return hint === undefined
    ? legal
    : [hint, ...legal.filter(option => option !== hint)];
}

/**
 * A template's inflorescence hint is listed first so it is the model's
 * default reading, and the assembler falls back to it when unanswered.
 */
export function stageTwoQuestions(
  profile: FamilyProfile,
  strangeness: Strangeness,
  template?: TemplateInfo,
): Questions {
  return Object.fromEntries(
    STAGE_TWO_IDS.flatMap((id): [string, EvaluationQuestion][] => {
      if (isBooleanId(id)) {
        const text = BOOLEAN_TEXT[id];
        return [
          [
            id,
            yesNo(text.instructions, { true: text.true, false: text.false }),
          ],
        ];
      }
      const hint =
        id === "inflorescence_kind" ? template?.inflorescence : undefined;
      const options = choiceOptions(id, profile, strangeness, hint);
      if (options.length < 2) return [];
      const text = CHOICE_TEXT[id];
      return [
        [
          id,
          choice(text.instructions, criteriaFor(options, text.descriptions)),
        ],
      ];
    }),
  );
}
