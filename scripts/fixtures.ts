// Writes one assembled FlowerSpec per family as YAML into the Rust fixture
// directory. The Rust integration test parses every file, so this is the
// cross language contract check. Answers rotate through every enum by family
// index so each variant appears in at least one fixture.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stringify } from "yaml";
import {
  BOTANICAL_CLASSES,
  EDGE_STYLES,
  FLOWER_FAMILIES,
  FUSION_KINDS,
  INFLORESCENCE_KINDS,
  LEAF_SHAPES,
  LIFE_STAGES,
  PATTERN_KINDS,
  PETAL_SHAPES,
  SERRATIONS,
  STEM_STYLES,
  STIGMA_SHAPES,
  SURFACE_TEXTURES,
  SYMMETRIES,
  THORN_SHAPES,
  VARIEGATION_KINDS,
  VEIN_PATTERNS,
} from "../client/src/data/flower-enums.ts";
import {
  AURA_CHOICES,
  BUD_COUNT_CLASSES,
  DEWDROP_CLASSES,
  DROOPS,
  GRADIENT_DIRECTIONS,
  HEAD_COUNT_CLASSES,
  LAYER_COUNTS,
  LEAF_COUNT_CLASSES,
  LEAF_DROOPS,
  NAME_NOUNS,
  NONE,
  OPACITIES,
  PARTICLE_CHOICES,
  PETAL_COUNT_CLASSES,
  POSES,
  SEPAL_REFLEXES,
  STEM_HEIGHTS,
  STEM_THICKNESSES,
  WIDTH_CLASSES,
  assembleSpec,
  type StageTwoAnswers,
} from "../api/flower/assemble.ts";
import {
  FAMILIES,
  LEAF_COLOR_NAMES,
  PALETTE_NAMES,
  SEPAL_COLOR_NAMES,
  STAMEN_PROMINENCES,
  STEM_COLOR_NAMES,
} from "../api/flower/families.ts";
import { cycle } from "../api/flower/lists.ts";
import type { FlowerSpecJson } from "../api/flower/specSchema.ts";

export const FIXTURE_SEED = 12345;
export const FIXTURES_DIR = join(
  import.meta.dir,
  "../crates/flower-core/tests/fixtures",
);

const rotate = <T>(list: readonly T[], index: number): T =>
  cycle(list, index, "fixture option list");

export function fixtureAnswers(index: number): StageTwoAnswers {
  return {
    outer_shape: rotate(PETAL_SHAPES, index),
    inner_shape: rotate(PETAL_SHAPES, index + 7),
    petal_count_class: rotate(PETAL_COUNT_CLASSES, index),
    layer_count: rotate(LAYER_COUNTS, index),
    pose: rotate(POSES, index),
    width_class: rotate(WIDTH_CLASSES, index),
    droop: rotate(DROOPS, index),
    edge_style: rotate(EDGE_STYLES, index),
    texture: rotate(SURFACE_TEXTURES, index),
    vein_pattern: rotate(VEIN_PATTERNS, index),
    opacity: rotate(OPACITIES, index),
    outer_base_color: rotate(PALETTE_NAMES, index),
    outer_tip_color: rotate(PALETTE_NAMES, index + 5),
    inner_base_color: rotate(PALETTE_NAMES, index + 11),
    inner_tip_color: rotate(PALETTE_NAMES, index + 17),
    gradient_direction: rotate(GRADIENT_DIRECTIONS, index),
    pattern_kind: rotate(PATTERN_KINDS, index),
    pattern_color: rotate(PALETTE_NAMES, index + 23),
    fusion_kind: rotate(FUSION_KINDS, index),
    inflorescence_kind: rotate(INFLORESCENCE_KINDS, index),
    head_count_class: rotate(HEAD_COUNT_CLASSES, index),
    // offset by two so Asteraceae (index 2) lands on SeedHead and exercises the pappus
    life_stage: rotate(LIFE_STAGES, index + 2),
    bud_count_class: rotate(BUD_COUNT_CLASSES, index),
    stamen_prominence: rotate(STAMEN_PROMINENCES, index),
    filament_color: rotate(PALETTE_NAMES, index + 2),
    anther_color: rotate(PALETTE_NAMES, index + 9),
    stigma_shape: rotate(STIGMA_SHAPES, index),
    pistil_color: rotate(PALETTE_NAMES, index + 13),
    receptacle_color: rotate(PALETTE_NAMES, index + 19),
    pollen_drift: index % 2 === 0,
    nectary_glow: index % 3 === 0,
    sepal_color: rotate(SEPAL_COLOR_NAMES, index),
    sepal_reflex: rotate(SEPAL_REFLEXES, index),
    bracts: index % 2 === 1,
    bract_color: rotate(PALETTE_NAMES, index + 3),
    stem_style: rotate(STEM_STYLES, index),
    stem_height: rotate(STEM_HEIGHTS, index),
    stem_thickness: rotate(STEM_THICKNESSES, index),
    stem_color: rotate(STEM_COLOR_NAMES, index),
    stem_surface: rotate(SURFACE_TEXTURES, index + 4),
    has_thorns: index % 4 === 0,
    thorn_shape: rotate(THORN_SHAPES, index),
    leaf_shape: rotate(LEAF_SHAPES, index),
    serration: rotate(SERRATIONS, index),
    leaf_color: rotate(LEAF_COLOR_NAMES, index),
    leaf_variegation: rotate(VARIEGATION_KINDS, index),
    variegation_color: rotate(PALETTE_NAMES, index + 21),
    leaf_count_class: rotate(LEAF_COUNT_CLASSES, index),
    leaf_droop: rotate(LEAF_DROOPS, index),
    leaf_vein: rotate(VEIN_PATTERNS, index + 3),
    leaf_translucency: index % 2 === 1,
    dewdrops: rotate(DEWDROP_CLASSES, index),
    aura_kind: rotate(AURA_CHOICES, index),
    aura_color: rotate(PALETTE_NAMES, index + 8),
    particle_kind: rotate(PARTICLE_CHOICES, index),
    particle_color: rotate(PALETTE_NAMES, index + 14),
    iridescence: index % 3 === 1,
    bioluminescence: index % 3 === 2,
    name_noun: rotate(NAME_NOUNS, index),
  };
}

export function buildFixtures(): ReadonlyArray<{
  fileName: string;
  spec: FlowerSpecJson;
}> {
  return FLOWER_FAMILIES.map((family, index) => ({
    fileName: `${family.toLowerCase()}.yaml`,
    spec: assembleSpec({
      profile: FAMILIES[family],
      strangeness: "invented",
      answers: fixtureAnswers(index),
      stageOne: {
        family,
        template: NONE,
        strangeness: "invented",
        mood: "Wild",
      },
      seed: FIXTURE_SEED,
    }),
  }));
}

type Coverage = {
  name: string;
  variants: readonly string[];
  seen: Set<string>;
};

// Asymmetric is the one Symmetry variant no family profile carries and no
// question can set, so it has no fixture. Every other listed variant must.
const UNREACHABLE = new Set(["Symmetry.Asymmetric"]);

export function coverageGaps(specs: readonly FlowerSpecJson[]): string[] {
  const coverage: Coverage[] = [
    {
      // the renderer draws a pappus only on a disc family's seed head
      name: "DiscFamilyLifeStage",
      variants: ["SeedHead"],
      seen: new Set(
        specs
          .filter(s => FAMILIES[s.taxonomy.family].disc)
          .map(s => s.petals.stage),
      ),
    },
    {
      name: "PatternKind",
      variants: PATTERN_KINDS,
      seen: new Set(
        specs.flatMap(s => s.petals.layers.map(l => l.pattern.kind)),
      ),
    },
    {
      name: "FusionKind",
      variants: FUSION_KINDS,
      seen: new Set(
        specs.flatMap(s => s.petals.layers.map(l => l.fusion.kind)),
      ),
    },
    {
      name: "InflorescenceKind",
      variants: INFLORESCENCE_KINDS,
      seen: new Set(specs.map(s => s.inflorescence.kind)),
    },
    {
      name: "LifeStage",
      variants: LIFE_STAGES,
      seen: new Set(specs.map(s => s.petals.stage)),
    },
    {
      name: "VariegationKind",
      variants: VARIEGATION_KINDS,
      seen: new Set(
        specs.flatMap(s => s.foliage.leaves.map(l => l.variegation.kind)),
      ),
    },
    {
      name: "Symmetry",
      variants: SYMMETRIES,
      seen: new Set(specs.map(s => s.petals.symmetry)),
    },
    {
      name: "BotanicalClass",
      variants: BOTANICAL_CLASSES,
      seen: new Set(specs.map(s => s.taxonomy.botanical_class)),
    },
  ];
  return coverage.flatMap(({ name, variants, seen }) =>
    variants
      .filter(variant => !seen.has(variant))
      .map(variant => `${name}.${variant}`)
      .filter(gap => !UNREACHABLE.has(gap)),
  );
}

if (import.meta.main) {
  const fixtures = buildFixtures();
  const gaps = coverageGaps(fixtures.map(f => f.spec));
  if (gaps.length > 0) {
    throw new Error(`fixtures never reach: ${gaps.join(", ")}`);
  }
  mkdirSync(FIXTURES_DIR, { recursive: true });
  fixtures.map(({ fileName, spec }) =>
    writeFileSync(join(FIXTURES_DIR, fileName), stringify(spec)),
  );
  console.log(`Wrote ${fixtures.length} fixtures to ${FIXTURES_DIR}`);
}
