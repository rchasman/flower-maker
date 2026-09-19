// Every enum in crates/flower-core/src/catalog.rs, one readonly array each.
// Variant strings match the Rust variant names in Rust declaration order.
// The zod spec mirror, the question builders, the renderer and the part editor
// import from here so TypeScript has one catalog to keep in step with Rust.

export const PETAL_SHAPES = [
  "Ovate",
  "Lanceolate",
  "Spatulate",
  "Oblong",
  "Orbicular",
  "Cordate",
  "Deltoid",
  "Falcate",
  "Ligulate",
  "Tubular",
  "Fimbriate",
  "Laciniate",
  "Runcinate",
  "Cuneate",
  "Acuminate",
  "Panduriform",
  "Unguiculate",
  "Flabellate",
  "Obovate",
  "Rhomboid",
  "Filiform",
  "Reniform",
  "Sagittate",
] as const;
export type PetalShape = (typeof PETAL_SHAPES)[number];

export const PETAL_ARRANGEMENTS = [
  "Radial",
  "Spiral",
  "Bilateral",
  "Imbricate",
  "Valvate",
  "Contorted",
  "Whorled",
  "Papilionaceous",
  "Cruciform",
  "Zygomorphic",
] as const;
export type PetalArrangement = (typeof PETAL_ARRANGEMENTS)[number];

export const SYMMETRIES = [
  "Radial",
  "Bilateral",
  "Asymmetric",
  "Spiral",
] as const;
export type Symmetry = (typeof SYMMETRIES)[number];

export const SURFACE_TEXTURES = [
  "Smooth",
  "Velvet",
  "Silk",
  "Papery",
  "Waxy",
  "Rough",
  "Hairy",
  "Glassy",
  "Crystalline",
  "Scaled",
  "Metallic",
  "Pearlescent",
  "Fuzzy",
  "Frosted",
  "Leathery",
  "Powdery",
] as const;
export type SurfaceTexture = (typeof SURFACE_TEXTURES)[number];

export const VEIN_PATTERNS = [
  "None",
  "Parallel",
  "Branching",
  "Palmate",
  "Reticulate",
  "Dichotomous",
  "Arcuate",
  "Pinnate",
  "Anastomosing",
] as const;
export type VeinPattern = (typeof VEIN_PATTERNS)[number];

export const EDGE_STYLES = [
  "Smooth",
  "Ruffled",
  "Fringed",
  "Serrated",
  "Rolled",
  "Undulate",
  "Crisped",
  "Lacerate",
  "Lobed",
  "Plicate",
  "Revolute",
  "Dentate",
  "Erose",
] as const;
export type EdgeStyle = (typeof EDGE_STYLES)[number];

export const PATTERN_KINDS = [
  "None",
  "Spots",
  "Speckle",
  "Stripes",
  "Flame",
  "ThroatBlotch",
  "Picotee",
  "Band",
] as const;
export type PatternKind = (typeof PATTERN_KINDS)[number];

export const FUSION_KINDS = [
  "Free",
  "Bell",
  "Trumpet",
  "Urn",
  "Funnel",
  "Tube",
] as const;
export type FusionKind = (typeof FUSION_KINDS)[number];

export const INFLORESCENCE_KINDS = [
  "Solitary",
  "Spike",
  "Raceme",
  "Umbel",
  "Corymb",
  "Panicle",
  "Spray",
] as const;
export type InflorescenceKind = (typeof INFLORESCENCE_KINDS)[number];

export const LIFE_STAGES = [
  "Bud",
  "Opening",
  "Bloom",
  "Fading",
  "SeedHead",
] as const;
export type LifeStage = (typeof LIFE_STAGES)[number];

export const SIDES = ["Left", "Right"] as const;
export type Side = (typeof SIDES)[number];

export const VARIEGATION_KINDS = [
  "None",
  "Edge",
  "Center",
  "Splash",
  "Stripe",
] as const;
export type VariegationKind = (typeof VARIEGATION_KINDS)[number];

export const PISTIL_STYLES = [
  "Simple",
  "Compound",
  "Split",
  "Gynobasic",
  "Capitate",
  "Branched",
  "Plumose",
] as const;
export type PistilStyle = (typeof PISTIL_STYLES)[number];

export const STIGMA_SHAPES = [
  "Capitate",
  "Plumose",
  "Fimbriate",
  "Clavate",
  "Discoid",
  "Lobed",
  "Stellate",
  "Bifid",
  "Trifid",
] as const;
export type StigmaShape = (typeof STIGMA_SHAPES)[number];

export const ANTHER_SHAPES = [
  "Versatile",
  "Basifixed",
  "Sagittate",
  "Didynamous",
  "Syngenesious",
  "Dorsifixed",
  "Poricidal",
  "Apiculate",
] as const;
export type AntherShape = (typeof ANTHER_SHAPES)[number];

export const DISPERSAL_PATTERNS = [
  "Gravity",
  "Wind",
  "Burst",
  "Spiral",
  "Chaotic",
  "Fountain",
  "Vortex",
  "Radiate",
] as const;
export type DispersalPattern = (typeof DISPERSAL_PATTERNS)[number];

export const NECTARY_POSITIONS = [
  "Basal",
  "Petaline",
  "Sepaline",
  "Receptacular",
  "Spurred",
  "Annular",
  "Discoid",
] as const;
export type NectaryPosition = (typeof NECTARY_POSITIONS)[number];

export const THORN_SHAPES = [
  "Straight",
  "Hooked",
  "Recurved",
  "Bulbous",
  "Barbed",
  "Acicular",
  "Stellate",
] as const;
export type ThornShape = (typeof THORN_SHAPES)[number];

export const BRANCH_PATTERNS = [
  "None",
  "Alternate",
  "Opposite",
  "Whorled",
  "Dichotomous",
  "Sympodial",
  "Monopodial",
] as const;
export type BranchPattern = (typeof BRANCH_PATTERNS)[number];

export const STEM_STYLES = [
  "Straight",
  "Arching",
  "Sinuous",
  "Zigzag",
  "Twining",
  "Succulent",
  "Woody",
  "Trailing",
] as const;
export type StemStyle = (typeof STEM_STYLES)[number];

export const SEPAL_SHAPES = [
  "Lanceolate",
  "Ovate",
  "Triangular",
  "Leaflike",
  "Petaloid",
  "Aristate",
  "Spatulate",
  "Tubular",
] as const;
export type SepalShape = (typeof SEPAL_SHAPES)[number];

export const RECEPTACLE_SHAPES = [
  "Flat",
  "Convex",
  "Concave",
  "Conical",
  "Urceolate",
  "Elongated",
  "Hemispheric",
] as const;
export type ReceptacleShape = (typeof RECEPTACLE_SHAPES)[number];

export const LEAF_SHAPES = [
  "Ovate",
  "Lanceolate",
  "Cordate",
  "Palmate",
  "Pinnate",
  "Linear",
  "Reniform",
  "Hastate",
  "Sagittate",
  "Peltate",
  "Acicular",
  "Obovate",
  "Elliptic",
  "Oblanceolate",
  "Deltoid",
  "Spatulate",
  "Orbicular",
  "Lyrate",
  "Cuneate",
  "Falcate",
  "Bipinnate",
] as const;
export type LeafShape = (typeof LEAF_SHAPES)[number];

export const LEAF_ARRANGEMENTS = [
  "Alternate",
  "Opposite",
  "Whorled",
  "Rosette",
  "Basal",
  "Distichous",
  "Decussate",
] as const;
export type LeafArrangement = (typeof LEAF_ARRANGEMENTS)[number];

export const SERRATIONS = [
  "None",
  "Fine",
  "Coarse",
  "Lobed",
  "Crenate",
  "Dentate",
  "Doubly",
  "Spinose",
  "Ciliate",
] as const;
export type Serration = (typeof SERRATIONS)[number];

export const DEWDROP_PLACEMENTS = [
  "Random",
  "PetalTip",
  "VeinJunction",
  "Edge",
  "Center",
  "Leaf",
  "Stem",
] as const;
export type DewdropPlacement = (typeof DEWDROP_PLACEMENTS)[number];

export const PULSE_TYPES = [
  "Sine",
  "Heartbeat",
  "Flicker",
  "Breathe",
  "Morse",
  "Wave",
  "Cascade",
  "Stochastic",
] as const;
export type PulseType = (typeof PULSE_TYPES)[number];

export const PARTICLE_KINDS = [
  "Pollen",
  "Firefly",
  "Stardust",
  "FallingPetals",
  "Spores",
  "Motes",
  "Embers",
  "Butterflies",
  "Snowflakes",
  "Sparkle",
  "Seeds",
  "Bubbles",
  "Lightning",
  "Raindrops",
] as const;
export type ParticleKind = (typeof PARTICLE_KINDS)[number];

export const EMISSION_ZONES = [
  "Center",
  "PetalEdge",
  "Whole",
  "Above",
  "Roots",
  "Stem",
  "Leaves",
  "Spiral",
] as const;
export type EmissionZone = (typeof EMISSION_ZONES)[number];

export const BIO_PATTERNS = [
  "Veins",
  "Spots",
  "Edges",
  "Whole",
  "Pulse",
  "Fractal",
  "Rings",
  "Stripes",
  "Constellation",
] as const;
export type BioPattern = (typeof BIO_PATTERNS)[number];

export const BIO_TRIGGERS = [
  "Always",
  "Night",
  "Touch",
  "Proximity",
  "Wind",
  "Rain",
  "Music",
  "Moonlight",
] as const;
export type BioTrigger = (typeof BIO_TRIGGERS)[number];

export const ROOT_PATTERNS = [
  "Taproot",
  "Fibrous",
  "Aerial",
  "Rhizome",
  "Tuberous",
  "Adventitious",
  "Pneumatophore",
  "Haustorial",
  "Prop",
] as const;
export type RootPattern = (typeof ROOT_PATTERNS)[number];

export const LIGHT_PREFERENCES = [
  "FullSun",
  "PartialShade",
  "FullShade",
  "Nocturnal",
  "Dappled",
  "Dawn",
  "Twilight",
] as const;
export type LightPreference = (typeof LIGHT_PREFERENCES)[number];

export const WIND_RESPONSES = [
  "Rigid",
  "Gentle",
  "Dramatic",
  "Dancing",
  "Swirling",
  "Trembling",
] as const;
export type WindResponse = (typeof WIND_RESPONSES)[number];

export const FRAGRANCE_PROFILES = [
  "Sweet",
  "Spicy",
  "Earthy",
  "Citrus",
  "Floral",
  "Musky",
  "Ethereal",
  "Woody",
  "Aquatic",
  "Green",
  "Powdery",
  "Medicinal",
] as const;
export type FragranceProfile = (typeof FRAGRANCE_PROFILES)[number];

export const AURA_KINDS = [
  "Mist",
  "Sparkle",
  "Ethereal",
  "Prismatic",
  "Shadow",
  "Flame",
  "Frost",
  "Electric",
  "Aurora",
  "Nebula",
  "Crystal",
  "Moonlight",
  "Solar",
  "Void",
  "Rainbow",
  "Storm",
] as const;
export type AuraKind = (typeof AURA_KINDS)[number];

export const BOTANICAL_CLASSES = [
  "Dicot",
  "Monocot",
  "Magnoliid",
  "Basal",
] as const;
export type BotanicalClass = (typeof BOTANICAL_CLASSES)[number];

export const FLOWER_FAMILIES = [
  "Invented",
  "Rosaceae",
  "Asteraceae",
  "Fabaceae",
  "Lamiaceae",
  "Ranunculaceae",
  "Solanaceae",
  "Brassicaceae",
  "Malvaceae",
  "Caryophyllaceae",
  "Ericaceae",
  "Papaveraceae",
  "Violaceae",
  "Primulaceae",
  "Geraniaceae",
  "Boraginaceae",
  "Convolvulaceae",
  "Apiaceae",
  "Caprifoliaceae",
  "Hydrangeaceae",
  "Magnoliaceae",
  "Paeoniaceae",
  "Plumbaginaceae",
  "Hypericaceae",
  "Myrtaceae",
  "Plantaginaceae",
  "Gentianaceae",
  "Campanulaceae",
  "Nymphaeaceae",
  "Passifloraceae",
  "Proteaceae",
  "Cactaceae",
  "Orchidaceae",
  "Liliaceae",
  "Iridaceae",
  "Amaryllidaceae",
  "Asparagaceae",
  "Alstroemeriaceae",
] as const;
export type FlowerFamily = (typeof FLOWER_FAMILIES)[number];

export function isVariant<T extends readonly string[]>(
  list: T,
  value: unknown,
): value is T[number] {
  return typeof value === "string" && list.includes(value);
}
