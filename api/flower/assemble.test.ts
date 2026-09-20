import { describe, expect, test } from "bun:test";
import {
  FLOWER_FAMILIES,
  INFLORESCENCE_KINDS,
  isVariant,
  type InflorescenceKind,
} from "../../client/src/data/flower-enums.ts";
import { TEMPLATES } from "../../client/src/data/templates.ts";
import {
  AURA_CHOICES,
  BUD_COUNT_CLASSES,
  DEWDROP_CLASSES,
  DROOPS,
  GRADIENT_DIRECTIONS,
  HEAD_COUNT_CLASSES,
  KIND_HEAD_RANGE,
  LAYER_COUNTS,
  LEAF_COUNT_CLASSES,
  LEAF_DROOPS,
  MOOD_WORDS,
  NAME_NOUNS,
  NONE,
  OPACITIES,
  PARTICLE_CHOICES,
  PETAL_COUNT_CLASSES,
  POSES,
  PROFILE_LIST_FOR_ANSWER,
  SEPAL_REFLEXES,
  STAGE_TWO_IDS,
  STEM_HEIGHTS,
  STEM_THICKNESSES,
  WIDTH_CLASSES,
  assembleSpec,
  type HeadCountClass,
  type StageOneAnswers,
  type StageTwoAnswers,
} from "./assemble.ts";
import {
  FAMILIES,
  FULL_LISTS,
  LEAF_COLOR_NAMES,
  SEPAL_COLOR_NAMES,
  STAMEN_PROMINENCES,
  STEM_COLOR_NAMES,
  STRANGENESS,
  legalList,
  type FamilyProfile,
  type Strangeness,
} from "./families.ts";
import { first } from "./lists.ts";
import { FlowerSpecSchema } from "./specSchema.ts";
import {
  LIFE_STAGES,
  THORN_SHAPES,
  VARIEGATION_KINDS,
  VEIN_PATTERNS,
} from "../../client/src/data/flower-enums.ts";

const stageOne = (
  family: FamilyProfile["key"],
  strangeness: Strangeness,
): StageOneAnswers => ({
  family,
  template: NONE,
  strangeness,
  mood: "Wild",
});

const profiles = FLOWER_FAMILIES.map(key => FAMILIES[key]);
const cases = profiles.flatMap(profile =>
  STRANGENESS.map(strangeness => ({ profile, strangeness })),
);

const assemble = (
  profile: FamilyProfile,
  strangeness: Strangeness,
  answers: Partial<StageTwoAnswers>,
  seed = 7,
) =>
  assembleSpec({
    profile,
    strangeness,
    answers,
    stageOne: stageOne(profile.key, strangeness),
    seed,
  });

/** Every question answered with its first legal option. */
function firstOptionAnswers(
  profile: FamilyProfile,
  strangeness: Strangeness,
): StageTwoAnswers {
  return {
    outer_shape: first(legalList(profile, strangeness, "shapes"), "shapes"),
    inner_shape: first(
      legalList(profile, strangeness, "innerShapes"),
      "innerShapes",
    ),
    petal_count_class: PETAL_COUNT_CLASSES[0],
    layer_count: LAYER_COUNTS[0],
    pose: POSES[0],
    width_class: WIDTH_CLASSES[0],
    droop: DROOPS[0],
    edge_style: first(legalList(profile, strangeness, "edges"), "edges"),
    texture: first(legalList(profile, strangeness, "textures"), "textures"),
    vein_pattern: first(legalList(profile, strangeness, "veins"), "veins"),
    opacity: OPACITIES[0],
    outer_base_color: first(
      legalList(profile, strangeness, "colors"),
      "colors",
    ),
    outer_tip_color: first(legalList(profile, strangeness, "colors"), "colors"),
    inner_base_color: first(
      legalList(profile, strangeness, "colors"),
      "colors",
    ),
    inner_tip_color: first(legalList(profile, strangeness, "colors"), "colors"),
    gradient_direction: GRADIENT_DIRECTIONS[0],
    pattern_kind: first(
      legalList(profile, strangeness, "patterns"),
      "patterns",
    ),
    pattern_color: first(legalList(profile, strangeness, "colors"), "colors"),
    fusion_kind: first(legalList(profile, strangeness, "fusions"), "fusions"),
    inflorescence_kind: first(
      legalList(profile, strangeness, "inflorescences"),
      "inflorescences",
    ),
    head_count_class: HEAD_COUNT_CLASSES[0],
    life_stage: LIFE_STAGES[0],
    bud_count_class: BUD_COUNT_CLASSES[0],
    stamen_prominence: first(
      legalList(profile, strangeness, "stamenProminence"),
      "stamenProminence",
    ),
    filament_color: first(legalList(profile, strangeness, "colors"), "colors"),
    anther_color: first(legalList(profile, strangeness, "colors"), "colors"),
    stigma_shape: first(
      legalList(profile, strangeness, "stigmaShapes"),
      "stigmaShapes",
    ),
    pistil_color: first(legalList(profile, strangeness, "colors"), "colors"),
    receptacle_color: first(
      legalList(profile, strangeness, "colors"),
      "colors",
    ),
    pollen_drift: false,
    nectary_glow: false,
    sepal_color: SEPAL_COLOR_NAMES[0],
    sepal_reflex: SEPAL_REFLEXES[0],
    bracts: false,
    bract_color: first(legalList(profile, strangeness, "colors"), "colors"),
    stem_style: first(
      legalList(profile, strangeness, "stemStyles"),
      "stemStyles",
    ),
    stem_height: STEM_HEIGHTS[0],
    stem_thickness: STEM_THICKNESSES[0],
    stem_color: STEM_COLOR_NAMES[0],
    stem_surface: first(
      legalList(profile, strangeness, "textures"),
      "textures",
    ),
    has_thorns: false,
    thorn_shape: THORN_SHAPES[0],
    leaf_shape: first(
      legalList(profile, strangeness, "leafShapes"),
      "leafShapes",
    ),
    serration: first(
      legalList(profile, strangeness, "serrations"),
      "serrations",
    ),
    leaf_color: LEAF_COLOR_NAMES[0],
    leaf_variegation: VARIEGATION_KINDS[0],
    variegation_color: first(
      legalList(profile, strangeness, "colors"),
      "colors",
    ),
    leaf_count_class: LEAF_COUNT_CLASSES[0],
    leaf_droop: LEAF_DROOPS[0],
    leaf_vein: VEIN_PATTERNS[0],
    leaf_translucency: false,
    dewdrops: DEWDROP_CLASSES[0],
    aura_kind: AURA_CHOICES[0],
    aura_color: first(legalList(profile, strangeness, "colors"), "colors"),
    particle_kind: PARTICLE_CHOICES[0],
    particle_color: first(legalList(profile, strangeness, "colors"), "colors"),
    iridescence: false,
    bioluminescence: false,
    name_noun: NAME_NOUNS[0],
  };
}

describe("assembleSpec across every profile and strangeness", () => {
  test("empty answers and first option answers both assemble and parse", () => {
    cases.map(({ profile, strangeness }) => {
      const label = `${profile.key} ${strangeness}`;
      const empty = assemble(profile, strangeness, {});
      const firsts = assemble(
        profile,
        strangeness,
        firstOptionAnswers(profile, strangeness),
      );
      expect(() => FlowerSpecSchema.parse(empty), label).not.toThrow();
      expect(() => FlowerSpecSchema.parse(firsts), label).not.toThrow();
      expect(empty.petals.layers.length, label).toBeGreaterThan(0);
    });
  });

  test("same seed gives the same spec, different seeds differ", () => {
    cases.map(({ profile, strangeness }) => {
      const label = `${profile.key} ${strangeness}`;
      expect(assemble(profile, strangeness, {}, 42), label).toEqual(
        assemble(profile, strangeness, {}, 42),
      );
      expect(assemble(profile, strangeness, {}, 42), label).not.toEqual(
        assemble(profile, strangeness, {}, 43),
      );
    });
  });

  test("skeleton rules hold", () => {
    cases.map(({ profile, strangeness }) => {
      const label = `${profile.key} ${strangeness}`;
      const spec = assemble(
        profile,
        strangeness,
        firstOptionAnswers(profile, strangeness),
      );
      const layers = spec.petals.layers;
      const outer = first(layers, label);
      const inner = layers[layers.length - 1] ?? outer;
      expect(profile.petalCounts, label).toContain(outer.count);
      const ceiling =
        strangeness === "invented"
          ? profile.layerRange[1] + 1
          : profile.layerRange[1];
      const extraSpurLayer = profile.special === "Spur" ? 1 : 0;
      expect(layers.length - extraSpurLayer, label).toBeGreaterThanOrEqual(
        Math.min(profile.layerRange[0], 2),
      );
      expect(layers.length - extraSpurLayer, label).toBeLessThanOrEqual(
        Math.max(ceiling, 2),
      );
      if (profile.disc) {
        expect(spec.structure.receptacle.size, label).toBeGreaterThanOrEqual(
          0.6,
        );
      }
      if (profile.special === "Bell") {
        expect(outer.fusion.kind, label).not.toBe("Free");
      }
      if (profile.special === "Corona") {
        expect(inner.fusion.kind, label).toBe("Trumpet");
      }
      if (profile.special === "Labellum") {
        expect(inner.shape, label).not.toBe(outer.shape);
        expect(inner.pattern.kind, label).not.toBe("None");
      }
      if (profile.special === "Composite") {
        expect(outer.shape, label).toBe("Ligulate");
      }
      if (profile.special === "Spur") {
        expect(inner.fusion.kind, label).toBe("Tube");
        expect(inner.count, label).toBe(1);
      }
      if (profile.symmetry === "Radial") {
        expect(spec.petals.symmetry_order, label).toBe(outer.count);
      } else {
        expect(spec.petals.symmetry_order, label).toBe(0);
      }
      expect(spec.petals.symmetry, label).toBe(profile.symmetry);
      expect(spec.taxonomy.family, label).toBe(profile.key);
      expect(spec.taxonomy.botanical_class, label).toBe(profile.botanicalClass);
      expect(spec.structure.sepals.length, label).toBe(profile.sepalCount);
    });
  });

  test("faithful keeps every list answer inside the family lists", () => {
    profiles.map(profile => {
      const spec = assemble(profile, "faithful", {});
      const outer = first(spec.petals.layers, profile.key);
      expect(profile.shapes, profile.key).toContain(outer.shape);
      expect(profile.edges, profile.key).toContain(outer.edge_style);
      expect(profile.textures, profile.key).toContain(outer.texture);
      expect(profile.inflorescences, profile.key).toContain(
        spec.inflorescence.kind,
      );
    });
  });
});

describe("answers", () => {
  const rose = FAMILIES.Rosaceae;

  test("an illegal answer under faithful falls back to the family default", () => {
    const foreign = FULL_LISTS.shapes.find(
      shape => !rose.shapes.includes(shape),
    );
    if (foreign === undefined) throw new Error("rose has every shape");
    const spec = assemble(rose, "faithful", { outer_shape: foreign });
    expect(first(spec.petals.layers, "layers").shape).toBe(
      first(rose.shapes, "shapes"),
    );
    const invented = assemble(rose, "invented", { outer_shape: foreign });
    expect(first(invented.petals.layers, "layers").shape).toBe(foreign);
  });

  test("the skeleton narrows the open lists: composite outer rings stay Ligulate, bells never Free", () => {
    const daisy = assemble(FAMILIES.Asteraceae, "invented", {
      outer_shape: "Ovate",
    });
    expect(first(daisy.petals.layers, "layers").shape).toBe("Ligulate");
    const heather = assemble(FAMILIES.Ericaceae, "invented", {
      fusion_kind: "Free",
    });
    expect(first(heather.petals.layers, "layers").fusion.kind).toBe("Bell");
    const urn = assemble(FAMILIES.Ericaceae, "invented", {
      fusion_kind: "Urn",
    });
    expect(first(urn.petals.layers, "layers").fusion.kind).toBe("Urn");
  });

  test("an answer changes only the parts it names", () => {
    const plain = assemble(rose, "stylized", {});
    const spotted = assemble(rose, "stylized", { pattern_kind: "Spots" });
    spotted.petals.layers.map(layer =>
      expect(layer.pattern.kind).toBe("Spots"),
    );
    expect(spotted.structure).toEqual(plain.structure);
    expect(spotted.foliage).toEqual(plain.foliage);
    expect(spotted.reproductive).toEqual(plain.reproductive);
    expect(spotted.name).toBe(plain.name);
  });

  test("petal count class snaps to the nearest legal count", () => {
    const aster = FAMILIES.Asteraceae;
    expect(
      first(
        assemble(aster, "faithful", { petal_count_class: "few" }).petals.layers,
        "l",
      ).count,
    ).toBe(8);
    expect(
      first(
        assemble(aster, "faithful", { petal_count_class: "dense" }).petals
          .layers,
        "l",
      ).count,
    ).toBe(34);
    expect(
      first(
        assemble(FAMILIES.Iridaceae, "invented", { petal_count_class: "dense" })
          .petals.layers,
        "l",
      ).count,
    ).toBe(3);
  });

  test("layer count is clamped to the range, invented may add one ring", () => {
    expect(
      assemble(FAMILIES.Ericaceae, "faithful", { layer_count: "triple" }).petals
        .layers.length,
    ).toBe(1);
    expect(
      assemble(FAMILIES.Ericaceae, "invented", { layer_count: "triple" }).petals
        .layers.length,
    ).toBe(2);
    const lily = assemble(FAMILIES.Liliaceae, "faithful", {
      layer_count: "double",
    });
    expect(lily.petals.layers.map(l => l.count)).toEqual([6, 3]);
    const rose = assemble(FAMILIES.Rosaceae, "faithful", {
      layer_count: "triple",
      petal_count_class: "many",
    });
    expect(rose.petals.layers.map(l => l.count)).toEqual([5, 8, 13]);
  });

  test("a spiralled bloom recurves its outer ring and cups each ring inward more", () => {
    const rose = assemble(FAMILIES.Rosaceae, "faithful", {
      layer_count: "triple",
      pose: "open",
    });
    const curvatures = rose.petals.layers.map(l => l.curvature);
    expect(curvatures[0]!).toBeLessThan(0);
    expect(curvatures[2]!).toBeGreaterThan(0.4);
    expect(curvatures.every((c, i) => i === 0 || c > curvatures[i - 1]!)).toBe(
      true,
    );
    const lily = assemble(FAMILIES.Liliaceae, "faithful", { pose: "open" });
    expect(first(lily.petals.layers, "layers").curvature).toBe(0);
  });

  test("booleans switch optional structures on", () => {
    const off = assemble(rose, "stylized", {});
    const on = assemble(rose, "stylized", {
      pollen_drift: true,
      nectary_glow: true,
      iridescence: true,
      bioluminescence: true,
      has_thorns: true,
      bracts: true,
      aura_kind: "Mist",
      particle_kind: "Firefly",
      dewdrops: "many",
      bud_count_class: "several",
    });
    expect(off.reproductive.pollen).toBeUndefined();
    expect(off.aura).toBeUndefined();
    expect(on.reproductive.pollen?.particle_count).toBeGreaterThan(0);
    expect(on.reproductive.nectary?.glow?.intensity).toBeGreaterThan(0);
    expect(on.ornamentation.iridescence?.affected_parts).toEqual(["petals"]);
    expect(on.ornamentation.bioluminescence?.trigger).toBe("Night");
    expect(on.structure.stem.thorns?.shape).toBe(THORN_SHAPES[0]);
    expect(on.foliage.bracts.length).toBeGreaterThan(0);
    expect(on.aura?.kind).toBe("Mist");
    expect(on.ornamentation.particles.map(p => p.kind)).toEqual(["Firefly"]);
    expect(first(on.ornamentation.dewdrops, "dew").count).toBe(12);
    expect(on.structure.buds.length).toBe(3);
    expect(on.structure.buds.map(b => b.side)).toEqual([
      "Right",
      "Left",
      "Right",
    ]);
  });

  test("a template names the flower, its genus and its inflorescence", () => {
    const delphinium = TEMPLATES.find(t => t.name === "Delphinium");
    if (delphinium === undefined) throw new Error("no Delphinium template");
    const spec = assembleSpec({
      profile: FAMILIES[delphinium.family],
      strangeness: "faithful",
      answers: {},
      stageOne: {
        family: delphinium.family,
        template: delphinium.name,
        strangeness: "faithful",
        mood: "Storm",
      },
      seed: 1,
      template: delphinium,
    });
    expect(spec.name).toBe("Storm Delphinium");
    expect(spec.taxonomy.common_name).toBe("Storm Delphinium");
    expect(spec.taxonomy.genus).toBe(delphinium.genus);
    expect(spec.taxonomy.species_name).toBe(delphinium.epithet);
    expect(spec.species).toBe("Delphinium elatum");
    expect(spec.inflorescence.kind).toBe(
      delphinium.inflorescence ?? "Solitary",
    );
    expect(spec.inflorescence.head_count).toBeGreaterThan(1);
  });

  const withTemplate = (name: string) => {
    const template = TEMPLATES.find(t => t.name === name);
    if (template === undefined) throw new Error(`no ${name} template`);
    return assembleSpec({
      profile: FAMILIES[template.family],
      strangeness: "faithful",
      answers: {},
      stageOne: {
        family: template.family,
        template: template.name,
        strangeness: "faithful",
        mood: "Solar",
      },
      seed: 1,
      template,
    });
  };

  test("a hybrid genus keeps its name, not the hybrid marker", () => {
    const spec = withTemplate("Solidaster");
    expect(spec.taxonomy.genus).toBe("Solidaster");
    expect(spec.taxonomy.species_name).toBe("luteus");
    expect(spec.species).toBe("Solidaster luteus");
  });

  test("a template with no single species is named by its genus alone", () => {
    const spec = withTemplate("Spray Rose");
    expect(spec.taxonomy.genus).toBe("Rosa");
    expect(spec.taxonomy.species_name).toBe("");
    expect(spec.species).toBe("Rosa");
  });

  test("without a template the name is mood plus noun and the epithet is invented", () => {
    const spec = assemble(FAMILIES.Invented, "invented", {
      name_noun: "Lantern",
    });
    expect(spec.name).toBe("Wild Lantern");
    expect(spec.taxonomy.genus).toBe(FAMILIES.Invented.typicalGenus);
    expect(spec.taxonomy.species_name.startsWith("lantern")).toBe(true);
    expect(spec.species).toBe(
      `${spec.taxonomy.genus} ${spec.taxonomy.species_name}`,
    );
  });

  test("sepal color words resolve against the petal and leaf colors", () => {
    const matching = assemble(rose, "faithful", {
      sepal_color: "matching",
      outer_base_color: rose.colors[0],
    });
    const outer = first(matching.petals.layers, "layers");
    expect(first(matching.structure.sepals, "sepals").color).toEqual(
      first(outer.color.stops, "stops").color,
    );
  });
});

describe("multi-head stems", () => {
  const rose = FAMILIES.Rosaceae;
  const heads = (kind: InflorescenceKind, head_count_class: HeadCountClass) =>
    assemble(rose, "invented", {
      inflorescence_kind: kind,
      head_count_class,
      stem_height: "short",
    });
  const CLUSTER_KINDS = INFLORESCENCE_KINDS.filter(kind => kind !== "Solitary");

  test("every cluster kind draws its head count from its own range, few to many", () => {
    for (const kind of CLUSTER_KINDS) {
      const [lo, hi] = KIND_HEAD_RANGE[kind];
      const few = heads(kind, "few").inflorescence.head_count;
      const many = heads(kind, "many").inflorescence.head_count;
      expect(few).toBeGreaterThanOrEqual(lo);
      expect(many).toBeLessThanOrEqual(hi);
      expect(few).toBeLessThan(many);
    }
    expect(heads("Solitary", "many").inflorescence.head_count).toBe(1);
  });

  test("the kind ranges match what the renderer lays out", () => {
    expect(KIND_HEAD_RANGE.Spike).toEqual([12, 20]);
    expect(KIND_HEAD_RANGE.Raceme).toEqual([6, 10]);
    expect(KIND_HEAD_RANGE.Umbel).toEqual([7, 12]);
    expect(KIND_HEAD_RANGE.Corymb).toEqual([12, 24]);
    expect(KIND_HEAD_RANGE.Panicle).toEqual([6, 12]);
    expect(KIND_HEAD_RANGE.Spray).toEqual([3, 5]);
  });

  test("every cluster stands on a stem 1.3 to 1.6 times the solitary height", () => {
    const solitary = heads("Solitary", "single").structure.stem.height;
    for (const kind of CLUSTER_KINDS) {
      for (const cls of ["few", "many"] as const) {
        const ratio = heads(kind, cls).structure.stem.height / solitary;
        expect(ratio).toBeGreaterThanOrEqual(1.3 - 1e-3);
        expect(ratio).toBeLessThanOrEqual(1.6 + 1e-3);
      }
      expect(heads(kind, "many").structure.stem.height).toBeGreaterThan(
        heads(kind, "few").structure.stem.height,
      );
    }
  });

  test("the stem height never leaves the schema range", () => {
    const tall = assemble(rose, "invented", {
      inflorescence_kind: "Spike",
      head_count_class: "many",
      stem_height: "tall",
    });
    expect(tall.structure.stem.height).toBeLessThanOrEqual(1);
  });

  test("head_scale is the floret size class of the kind, jitter aside", () => {
    const scale = (kind: InflorescenceKind) =>
      heads(kind, "several").inflorescence.head_scale;
    const base: Record<InflorescenceKind, number> = {
      Solitary: 0.6,
      Spike: 0.35,
      Raceme: 0.5,
      Umbel: 0.5,
      Corymb: 0.3,
      Panicle: 0.4,
      Spray: 0.85,
    };
    const jitter = scale("Umbel") - base.Umbel;
    INFLORESCENCE_KINDS.map(kind =>
      expect(scale(kind)).toBeCloseTo(base[kind] + jitter, 3),
    );
  });

  test("a template's inflorescence overrides the model's answer", () => {
    const hydrangea = TEMPLATES.find(t => t.name === "Hydrangea");
    if (hydrangea === undefined) throw new Error("no Hydrangea template");
    const spec = assembleSpec({
      profile: FAMILIES[hydrangea.family],
      strangeness: "faithful",
      answers: { inflorescence_kind: "Solitary", head_count_class: "single" },
      stageOne: {
        family: hydrangea.family,
        template: hydrangea.name,
        strangeness: "faithful",
        mood: "Storm",
      },
      seed: 1,
      template: hydrangea,
    });
    expect(spec.inflorescence.kind).toBe("Corymb");
    expect(spec.inflorescence.head_count).toBeGreaterThanOrEqual(12);
  });
});

describe("question vocabulary", () => {
  test("every answer id is listed once and every profile list mapping is real", () => {
    expect(new Set(STAGE_TWO_IDS).size).toBe(STAGE_TWO_IDS.length);
    Object.values(PROFILE_LIST_FOR_ANSWER).map(listName =>
      expect(listName in FULL_LISTS, listName).toBe(true),
    );
    expect(MOOD_WORDS.length).toBe(14);
    expect(NAME_NOUNS.length).toBeGreaterThanOrEqual(30);
    expect(isVariant(STAMEN_PROMINENCES, "brush")).toBe(true);
  });
});
