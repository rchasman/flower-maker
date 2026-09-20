// zod mirror of crates/flower-core/src/catalog.rs for every field the
// assembler writes. Objects are strict so a misspelled field throws instead of
// silently falling back to a Rust default. Enum lists come from the shared
// catalog, never retyped here.
import { z } from "zod";
import {
  ANTHER_SHAPES,
  AURA_KINDS,
  BIO_PATTERNS,
  BIO_TRIGGERS,
  BOTANICAL_CLASSES,
  BRANCH_PATTERNS,
  DEWDROP_PLACEMENTS,
  DISPERSAL_PATTERNS,
  EDGE_STYLES,
  EMISSION_ZONES,
  FLOWER_FAMILIES,
  FUSION_KINDS,
  INFLORESCENCE_KINDS,
  LEAF_ARRANGEMENTS,
  LEAF_SHAPES,
  LIFE_STAGES,
  NECTARY_POSITIONS,
  PARTICLE_KINDS,
  PATTERN_KINDS,
  PETAL_ARRANGEMENTS,
  PETAL_SHAPES,
  PISTIL_STYLES,
  PULSE_TYPES,
  RECEPTACLE_SHAPES,
  SEPAL_SHAPES,
  SERRATIONS,
  SIDES,
  STEM_STYLES,
  STIGMA_SHAPES,
  SURFACE_TEXTURES,
  SYMMETRIES,
  THORN_SHAPES,
  VARIEGATION_KINDS,
  VEIN_PATTERNS,
} from "../../client/src/data/flower-enums.ts";

const unit = z.number().min(0).max(1);
const count = z.number().int().nonnegative();

const ColorSchema = z.object({ r: unit, g: unit, b: unit, a: unit }).strict();

const ColorStopSchema = z
  .object({ position: unit, color: ColorSchema })
  .strict();

const ColorGradientSchema = z
  .object({ stops: z.array(ColorStopSchema) })
  .strict();

const TaxonomySchema = z
  .object({
    family: z.enum(FLOWER_FAMILIES),
    genus: z.string(),
    species_name: z.string(),
    common_name: z.string(),
    botanical_class: z.enum(BOTANICAL_CLASSES),
  })
  .strict();

const InflorescenceSchema = z
  .object({
    kind: z.enum(INFLORESCENCE_KINDS),
    head_count: count,
    head_scale: unit,
    spread: unit,
  })
  .strict();

const PetalPatternSchema = z
  .object({
    kind: z.enum(PATTERN_KINDS),
    color: ColorSchema,
    scale: unit,
    density: unit,
    extent: unit,
  })
  .strict();

const FusionSchema = z
  .object({ kind: z.enum(FUSION_KINDS), depth: unit })
  .strict();

const PetalLayerSchema = z
  .object({
    index: count,
    count,
    shape: z.enum(PETAL_SHAPES),
    arrangement: z.enum(PETAL_ARRANGEMENTS),
    curvature: z.number().min(-1).max(1),
    curl: unit,
    texture: z.enum(SURFACE_TEXTURES),
    color: ColorGradientSchema,
    opacity: unit,
    vein_pattern: z.enum(VEIN_PATTERNS),
    edge_style: z.enum(EDGE_STYLES),
    width: z.number().min(0.1).max(3),
    length: z.number().min(0.1).max(5),
    angular_offset: z.number(),
    droop: unit,
    thickness: z.number().min(0.1).max(1),
    pattern: PetalPatternSchema,
    fusion: FusionSchema,
  })
  .strict();

const PetalSystemSchema = z
  .object({
    layers: z.array(PetalLayerSchema),
    bloom_progress: unit,
    wilt_progress: unit,
    symmetry: z.enum(SYMMETRIES),
    symmetry_order: count,
    divergence_angle: z.number(),
    stage: z.enum(LIFE_STAGES),
  })
  .strict();

const PulsePatternSchema = z
  .object({
    speed: z.number(),
    pattern: z.enum(PULSE_TYPES),
    min_intensity: unit,
  })
  .strict();

const GlowEffectSchema = z
  .object({
    intensity: unit,
    color: ColorSchema,
    radius: z.number(),
    pulse: PulsePatternSchema.optional(),
  })
  .strict();

const PistilSchema = z
  .object({
    style: z.enum(PISTIL_STYLES),
    stigma_shape: z.enum(STIGMA_SHAPES),
    color: ColorSchema,
    height: z.number(),
    glow: GlowEffectSchema.optional(),
  })
  .strict();

const StamenSchema = z
  .object({
    filament_curve: unit,
    filament_color: ColorSchema,
    anther_shape: z.enum(ANTHER_SHAPES),
    anther_color: ColorSchema,
    pollen_load: unit,
    height: z.number(),
    sway: unit,
  })
  .strict();

const PollenSystemSchema = z
  .object({
    particle_count: count,
    drift_speed: z.number(),
    color: ColorSchema,
    luminosity: unit,
    dispersal: z.enum(DISPERSAL_PATTERNS),
    trail: z.boolean(),
  })
  .strict();

const NectarySchema = z
  .object({
    position: z.enum(NECTARY_POSITIONS),
    color: ColorSchema,
    glow: GlowEffectSchema.optional(),
    drip_rate: z.number(),
  })
  .strict();

const ReproductiveSystemSchema = z
  .object({
    pistil: PistilSchema.optional(),
    stamens: z.array(StamenSchema),
    pollen: PollenSystemSchema.optional(),
    nectary: NectarySchema.optional(),
  })
  .strict();

const BudSchema = z
  .object({
    position: unit,
    side: z.enum(SIDES),
    size: z.number(),
    openness: unit,
  })
  .strict();

const ThornSystemSchema = z
  .object({
    density: z.number(),
    size: z.number(),
    color: ColorSchema,
    shape: z.enum(THORN_SHAPES),
    curve: z.number(),
  })
  .strict();

const StemSchema = z
  .object({
    height: z.number(),
    thickness: z.number(),
    curvature: unit,
    color: ColorSchema,
    thorns: ThornSystemSchema.optional(),
    internode_length: z.number(),
    surface: z.enum(SURFACE_TEXTURES),
    branching: z.enum(BRANCH_PATTERNS),
    style: z.enum(STEM_STYLES),
  })
  .strict();

const SepalSchema = z
  .object({
    shape: z.enum(SEPAL_SHAPES),
    color: ColorSchema,
    reflex_angle: z.number().min(0).max(180),
    texture: z.enum(SURFACE_TEXTURES),
    length: z.number(),
    persistent: z.boolean(),
  })
  .strict();

const ReceptacleSchema = z
  .object({
    shape: z.enum(RECEPTACLE_SHAPES),
    size: z.number(),
    color: ColorSchema,
  })
  .strict();

const StructureSystemSchema = z
  .object({
    stem: StemSchema,
    sepals: z.array(SepalSchema),
    receptacle: ReceptacleSchema,
    buds: z.array(BudSchema),
  })
  .strict();

const VariegationSchema = z
  .object({ kind: z.enum(VARIEGATION_KINDS), color: ColorSchema })
  .strict();

const LeafSchema = z
  .object({
    shape: z.enum(LEAF_SHAPES),
    size: z.number(),
    color: ColorGradientSchema,
    vein_pattern: z.enum(VEIN_PATTERNS),
    serration: z.enum(SERRATIONS),
    arrangement: z.enum(LEAF_ARRANGEMENTS),
    phyllotaxis_angle: z.number(),
    droop: z.number(),
    curl: z.number(),
    translucency: unit,
    position: unit,
    side: z.enum(SIDES),
    angle_offset: z.number(),
    variegation: VariegationSchema,
  })
  .strict();

const BractSchema = z
  .object({
    color: ColorGradientSchema,
    size: z.number(),
    shape: z.enum(LEAF_SHAPES),
    showy: z.boolean(),
    position: unit,
  })
  .strict();

const FoliageSystemSchema = z
  .object({
    leaves: z.array(LeafSchema),
    bracts: z.array(BractSchema),
    leaf_density: unit,
  })
  .strict();

const DewdropSchema = z
  .object({
    size: z.number(),
    count,
    refraction: unit,
    placement: z.enum(DEWDROP_PLACEMENTS),
    surface_tension: unit,
  })
  .strict();

const ParticleEffectSchema = z
  .object({
    kind: z.enum(PARTICLE_KINDS),
    density: count,
    color: ColorSchema,
    drift_speed: z.number(),
    lifetime: z.number(),
    emission_zone: z.enum(EMISSION_ZONES),
    gravity: z.number().min(-1).max(1),
  })
  .strict();

const IridescenceSchema = z
  .object({
    intensity: unit,
    hue_shift_range: z.number(),
    affected_parts: z.array(z.string()),
  })
  .strict();

const BioluminescenceSchema = z
  .object({
    pattern: z.enum(BIO_PATTERNS),
    color: ColorSchema,
    intensity: unit,
    trigger: z.enum(BIO_TRIGGERS),
  })
  .strict();

const OrnamentationSystemSchema = z
  .object({
    dewdrops: z.array(DewdropSchema),
    glow: GlowEffectSchema.optional(),
    particles: z.array(ParticleEffectSchema),
    iridescence: IridescenceSchema.optional(),
    bioluminescence: BioluminescenceSchema.optional(),
  })
  .strict();

const AuraSchema = z
  .object({
    kind: z.enum(AURA_KINDS),
    color: ColorSchema,
    opacity: unit,
    radius: z.number(),
    animation_speed: z.number(),
  })
  .strict();

export const FlowerSpecSchema = z
  .object({
    name: z.string(),
    species: z.string(),
    taxonomy: TaxonomySchema,
    petals: PetalSystemSchema,
    reproductive: ReproductiveSystemSchema,
    structure: StructureSystemSchema,
    foliage: FoliageSystemSchema,
    ornamentation: OrnamentationSystemSchema,
    aura: AuraSchema.optional(),
    inflorescence: InflorescenceSchema,
  })
  .strict();

export type FlowerSpecJson = z.infer<typeof FlowerSpecSchema>;
export type PetalLayerJson = z.infer<typeof PetalLayerSchema>;
export type LeafJson = z.infer<typeof LeafSchema>;
export type StamenJson = z.infer<typeof StamenSchema>;
export type BudJson = z.infer<typeof BudSchema>;
export type ColorGradientJson = z.infer<typeof ColorGradientSchema>;
