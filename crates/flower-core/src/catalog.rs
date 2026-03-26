use serde::{Deserialize, Serialize};

// ═══════════════════════════════════════════════════════════════════════════
// BOTANICAL TAXONOMY
// ═══════════════════════════════════════════════════════════════════════════

/// Botanical classification
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Taxonomy {
    pub family: FlowerFamily,
    pub genus: String,
    pub species_name: String,      // specific epithet
    pub common_name: String,
    pub botanical_class: BotanicalClass,
}

impl Default for Taxonomy {
    fn default() -> Self {
        Self {
            family: FlowerFamily::default(),
            genus: String::new(),
            species_name: String::new(),
            common_name: String::new(),
            botanical_class: BotanicalClass::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub enum BotanicalClass {
    #[default]
    Dicot,       // most flowering plants — 4-5 merous
    Monocot,     // lilies, orchids, grasses — 3 merous
    Magnoliid,   // magnolias, water lilies — spiral parts
    Basal,       // primitive angiosperms
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub enum FlowerFamily {
    #[default]
    Unknown,
    // Dicots
    Rosaceae,        // roses, cherries, apples — 5 petals, many stamens
    Asteraceae,      // daisies, sunflowers — composite heads (ray + disc)
    Fabaceae,        // peas, beans — papilionaceous, bilateral
    Lamiaceae,       // mints, lavender — bilateral, tubular
    Ranunculaceae,   // buttercups, anemones — variable parts, many stamens
    Solanaceae,      // nightshades, petunias — 5-merous, fused
    Brassicaceae,    // mustards — 4 petals cruciform
    Malvaceae,       // hibiscus, hollyhock — 5 petals, column of stamens
    Caryophyllaceae, // carnations, pinks — 5 notched petals
    Ericaceae,       // heathers, rhododendrons — bell/urn shaped
    Papaveraceae,    // poppies — 4 petals, papery
    Violaceae,       // violets — bilateral, spurred
    Primulaceae,     // primroses — 5 petals, central eye
    Geraniaceae,     // geraniums — 5 petals, radial
    Boraginaceae,    // forget-me-nots — 5 petals, coiled cyme
    Convolvulaceae,  // morning glories — funnel/trumpet shaped
    Apiaceae,        // umbels (Queen Anne's lace) — tiny flowers in clusters
    Caprifoliaceae,  // honeysuckles — tubular, bilateral
    Hydrangeaceae,   // hydrangeas — 4-5 petal clusters
    Magnoliaceae,    // magnolias — many tepals, spiral
    // Monocots
    Orchidaceae,     // orchids — bilateral, labellum, 3+3 tepals
    Liliaceae,       // lilies — 6 tepals, 2 whorls, radial
    Iridaceae,       // iris, crocus — 3+3, often bearded
    Amaryllidaceae,  // amaryllis, daffodils — 6 tepals, corona
    Asparagaceae,    // hyacinths, agave — 6 tepals, bell-shaped
}

// ═══════════════════════════════════════════════════════════════════════════
// Complete Flower Spec — the top-level structure AI generates
// ═══════════════════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct FlowerSpec {
    pub name: String,
    pub species: String,          // kept for backward compat
    pub taxonomy: Taxonomy,       // structured botanical classification
    pub petals: PetalSystem,
    pub reproductive: ReproductiveSystem,
    pub structure: StructureSystem,
    pub foliage: FoliageSystem,
    pub ornamentation: OrnamentationSystem,
    pub roots: RootSystem,
    pub aura: Option<Aura>,
    pub personality: FlowerPersonality,
}

impl Default for FlowerSpec {
    fn default() -> Self {
        Self {
            name: String::new(),
            species: String::new(),
            taxonomy: Taxonomy::default(),
            petals: PetalSystem::default(),
            reproductive: ReproductiveSystem::default(),
            structure: StructureSystem::default(),
            foliage: FoliageSystem::default(),
            ornamentation: OrnamentationSystem::default(),
            roots: RootSystem::default(),
            aura: None,
            personality: FlowerPersonality::default(),
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// PETAL SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct PetalSystem {
    pub layers: Vec<PetalLayer>,
    pub bloom_progress: f64,        // 0.0 = bud, 1.0 = full bloom
    pub wilt_progress: f64,         // 0.0 = fresh, 1.0 = wilted
    pub symmetry: Symmetry,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct PetalLayer {
    pub index: u32,
    pub count: u32,                  // petals in this ring
    pub shape: PetalShape,
    pub arrangement: PetalArrangement,
    pub curvature: f64,              // -1.0 (recurved) to 1.0 (cupped)
    pub curl: f64,                   // 0.0 (flat) to 1.0 (fully curled)
    pub texture: SurfaceTexture,
    pub color: ColorGradient,
    pub opacity: f64,                // 0.0-1.0
    pub vein_pattern: VeinPattern,
    pub edge_style: EdgeStyle,
    pub width: f64,                  // relative 0.1-3.0
    pub length: f64,                 // relative 0.1-5.0
    pub angular_offset: f64,         // degrees offset from previous layer
    pub droop: f64,                  // 0.0 (upright) to 1.0 (hanging)
    pub thickness: f64,              // 0.1-1.0
}

impl Default for PetalLayer {
    fn default() -> Self {
        Self {
            index: 0,
            count: 0,
            shape: PetalShape::default(),
            arrangement: PetalArrangement::default(),
            curvature: 0.0,
            curl: 0.0,
            texture: SurfaceTexture::default(),
            color: ColorGradient::default(),
            opacity: 0.5,
            vein_pattern: VeinPattern::default(),
            edge_style: EdgeStyle::default(),
            width: 0.5,
            length: 0.5,
            angular_offset: 0.0,
            droop: 0.0,
            thickness: 0.5,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub enum PetalShape {
    #[default]
    Ovate, Lanceolate, Spatulate, Oblong, Orbicular,
    Cordate, Deltoid, Falcate, Ligulate, Tubular,
    Fimbriate, Laciniate, Runcinate,
    // v2 additions
    Cuneate,       // wedge-shaped, widest at tip
    Acuminate,     // long-tapered pointed tip
    Panduriform,   // fiddle/violin shaped, pinched middle
    Unguiculate,   // narrow claw base, wide blade
    Flabellate,    // fan-shaped, very wide outer edge
    Obovate,       // reverse egg, widest at 65%
    Rhomboid,      // diamond-shaped
    Filiform,      // thread-like, extremely narrow
    Reniform,      // kidney-shaped, wider than tall
    Sagittate,     // arrow-shaped with backward barbs
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub enum PetalArrangement {
    #[default]
    Radial, Spiral, Bilateral, Imbricate, Valvate, Contorted, Whorled,
    Papilionaceous, // butterfly-like (pea family)
    Cruciform,      // cross-shaped (4 petals at 90°)
    Zygomorphic,    // irregular, one plane of symmetry
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Symmetry {
    Radial { order: u32 },
    Bilateral,
    Asymmetric,
    Spiral { divergence_angle: f64 },
}

impl Default for Symmetry {
    fn default() -> Self {
        Self::Radial { order: 0 }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// REPRODUCTIVE SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct ReproductiveSystem {
    pub pistil: Option<Pistil>,
    pub stamens: Vec<Stamen>,
    pub pollen: Option<PollenSystem>,
    pub nectary: Option<Nectary>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Pistil {
    pub style: PistilStyle,
    pub stigma_shape: StigmaShape,
    pub color: Color,
    pub height: f64,
    pub glow: Option<GlowEffect>,
}

impl Default for Pistil {
    fn default() -> Self {
        Self {
            style: PistilStyle::default(),
            stigma_shape: StigmaShape::default(),
            color: Color::default(),
            height: 0.5,
            glow: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub enum PistilStyle {
    #[default]
    Simple, Compound, Split, Gynobasic, Capitate,
    Branched, Plumose,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub enum StigmaShape {
    #[default]
    Capitate, Plumose, Fimbriate, Clavate, Discoid, Lobed,
    Stellate, Bifid, Trifid,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Stamen {
    pub filament_curve: f64,     // 0.0-1.0
    pub filament_color: Color,
    pub anther_shape: AntherShape,
    pub anther_color: Color,
    pub pollen_load: f64,        // 0.0-1.0
    pub height: f64,
    pub sway: f64,               // 0.0-1.0 wind responsiveness
}

impl Default for Stamen {
    fn default() -> Self {
        Self {
            filament_curve: 0.5,
            filament_color: Color::default(),
            anther_shape: AntherShape::default(),
            anther_color: Color::default(),
            pollen_load: 0.5,
            height: 0.5,
            sway: 0.5,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub enum AntherShape {
    #[default]
    Versatile, Basifixed, Sagittate, Didynamous, Syngenesious,
    Dorsifixed, Poricidal, Apiculate,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct PollenSystem {
    pub particle_count: u32,
    pub drift_speed: f64,
    pub color: Color,
    pub luminosity: f64,         // 0.0-1.0 (bioluminescent pollen)
    pub dispersal: DispersalPattern,
    pub trail: bool,
}

impl Default for PollenSystem {
    fn default() -> Self {
        Self {
            particle_count: 0,
            drift_speed: 0.5,
            color: Color::default(),
            luminosity: 0.5,
            dispersal: DispersalPattern::default(),
            trail: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub enum DispersalPattern {
    #[default]
    Gravity, Wind, Burst, Spiral, Chaotic,
    Fountain, Vortex, Radiate,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Nectary {
    pub position: NectaryPosition,
    pub color: Color,
    pub glow: Option<GlowEffect>,
    pub drip_rate: f64,          // visual drip animation speed
}

impl Default for Nectary {
    fn default() -> Self {
        Self {
            position: NectaryPosition::default(),
            color: Color::default(),
            glow: None,
            drip_rate: 0.5,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub enum NectaryPosition {
    #[default]
    Basal, Petaline, Sepaline, Receptacular,
    Spurred, Annular, Discoid,
}

// ═══════════════════════════════════════════════════════════════════════════
// STRUCTURE SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct StructureSystem {
    pub stem: Stem,
    pub sepals: Vec<Sepal>,
    pub receptacle: Receptacle,
    pub peduncle: Peduncle,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Stem {
    pub height: f64,
    pub thickness: f64,
    pub curvature: f64,          // 0.0 straight, 1.0 arched
    pub color: Color,
    pub thorns: Option<ThornSystem>,
    pub internode_length: f64,
    pub surface: SurfaceTexture,
    pub branching: BranchPattern,
    pub style: StemStyle,
}

impl Default for Stem {
    fn default() -> Self {
        Self {
            height: 0.5,
            thickness: 0.3,
            curvature: 0.0,
            color: Color::default(),
            thorns: None,
            internode_length: 0.5,
            surface: SurfaceTexture::default(),
            branching: BranchPattern::default(),
            style: StemStyle::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct ThornSystem {
    pub density: f64,            // thorns per unit
    pub size: f64,
    pub color: Color,
    pub shape: ThornShape,
    pub curve: f64,
}

impl Default for ThornSystem {
    fn default() -> Self {
        Self {
            density: 0.5,
            size: 0.5,
            color: Color::default(),
            shape: ThornShape::default(),
            curve: 0.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub enum ThornShape {
    #[default]
    Straight, Hooked, Recurved, Bulbous, Barbed,
    Acicular, Stellate,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub enum BranchPattern {
    #[default]
    None, Alternate, Opposite, Whorled, Dichotomous,
    Sympodial, Monopodial,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub enum StemStyle {
    #[default]
    Straight,    // no curvature override
    Arching,     // graceful single arc
    Sinuous,     // S-curve, two inflection points
    Zigzag,      // angular bends (sympodial growth)
    Twining,     // helical spiral suggestion
    Succulent,   // thick, fleshy, minimal taper
    Woody,       // dark, thick at base, rough
    Trailing,    // droops downward
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Sepal {
    pub shape: SepalShape,
    pub color: Color,
    pub reflex_angle: f64,       // 0=closed, 180=fully reflexed
    pub texture: SurfaceTexture,
    pub length: f64,
    pub persistent: bool,        // stays after bloom
}

impl Default for Sepal {
    fn default() -> Self {
        Self {
            shape: SepalShape::default(),
            color: Color::default(),
            reflex_angle: 0.0,
            texture: SurfaceTexture::default(),
            length: 0.5,
            persistent: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub enum SepalShape {
    #[default]
    Lanceolate, Ovate, Triangular, Leaflike, Petaloid,
    Aristate, Spatulate, Tubular,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Receptacle {
    pub shape: ReceptacleShape,
    pub size: f64,
    pub color: Color,
}

impl Default for Receptacle {
    fn default() -> Self {
        Self {
            shape: ReceptacleShape::default(),
            size: 0.5,
            color: Color::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub enum ReceptacleShape {
    #[default]
    Flat, Convex, Concave, Conical, Urceolate,
    Elongated, Hemispheric,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Peduncle {
    pub length: f64,
    pub angle: f64,              // degrees from vertical
    pub flexibility: f64,        // wind responsiveness
    pub color: Color,
}

impl Default for Peduncle {
    fn default() -> Self {
        Self {
            length: 0.5,
            angle: 0.0,
            flexibility: 0.5,
            color: Color::default(),
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// FOLIAGE SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct FoliageSystem {
    pub leaves: Vec<Leaf>,
    pub bracts: Vec<Bract>,
    pub leaf_density: f64,       // 0.0-1.0
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Leaf {
    pub shape: LeafShape,
    pub size: f64,
    pub color: ColorGradient,
    pub vein_pattern: VeinPattern,
    pub serration: Serration,
    pub arrangement: LeafArrangement,
    pub phyllotaxis_angle: f64,  // golden angle ~137.5° for fibonacci
    pub droop: f64,
    pub curl: f64,
    pub translucency: f64,       // 0.0-1.0 light through leaf
}

impl Default for Leaf {
    fn default() -> Self {
        Self {
            shape: LeafShape::default(),
            size: 0.5,
            color: ColorGradient::default(),
            vein_pattern: VeinPattern::default(),
            serration: Serration::default(),
            arrangement: LeafArrangement::default(),
            phyllotaxis_angle: 137.5,
            droop: 0.0,
            curl: 0.0,
            translucency: 0.5,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub enum LeafShape {
    #[default]
    Ovate, Lanceolate, Cordate, Palmate, Pinnate, Linear,
    Reniform, Hastate, Sagittate, Peltate, Acicular,
    // v2 additions
    Obovate,       // reverse egg, widest near tip
    Elliptic,      // evenly oval
    Oblanceolate,  // reverse lance
    Deltoid,       // triangular
    Spatulate,     // spoon-shaped
    Orbicular,     // round
    Lyrate,        // lyre-shaped, large terminal lobe
    Cuneate,       // wedge-shaped
    Falcate,       // sickle-shaped
    Bipinnate,     // doubly feathered, fern-like
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub enum LeafArrangement {
    #[default]
    Alternate, Opposite, Whorled, Rosette, Basal,
    Distichous, Decussate,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub enum Serration {
    #[default]
    None, Fine, Coarse, Lobed, Crenate, Dentate, Doubly,
    Spinose, Ciliate,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Bract {
    pub color: ColorGradient,
    pub size: f64,
    pub shape: LeafShape,
    pub showy: bool,             // is this a "petal-like" bract (like poinsettia)
    pub position: f64,           // 0.0=base, 1.0=flower head
}

impl Default for Bract {
    fn default() -> Self {
        Self {
            color: ColorGradient::default(),
            size: 0.5,
            shape: LeafShape::default(),
            showy: false,
            position: 0.0,
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// ORNAMENTATION SYSTEM — the magic layer
// ═══════════════════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct OrnamentationSystem {
    pub dewdrops: Vec<Dewdrop>,
    pub glow: Option<GlowEffect>,
    pub particles: Vec<ParticleEffect>,
    pub iridescence: Option<Iridescence>,
    pub bioluminescence: Option<Bioluminescence>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Dewdrop {
    pub size: f64,
    pub count: u32,
    pub refraction: f64,         // 0.0-1.0 rainbow effect
    pub placement: DewdropPlacement,
    pub surface_tension: f64,    // affects shape: 0=flat, 1=spherical
}

impl Default for Dewdrop {
    fn default() -> Self {
        Self {
            size: 0.5,
            count: 0,
            refraction: 0.5,
            placement: DewdropPlacement::default(),
            surface_tension: 0.5,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub enum DewdropPlacement {
    #[default]
    Random, PetalTip, VeinJunction, Edge, Center,
    Leaf, Stem,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct GlowEffect {
    pub intensity: f64,          // 0.0-1.0
    pub color: Color,
    pub radius: f64,
    pub pulse: Option<PulsePattern>,
}

impl Default for GlowEffect {
    fn default() -> Self {
        Self {
            intensity: 0.5,
            color: Color::default(),
            radius: 0.5,
            pulse: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct PulsePattern {
    pub speed: f64,              // Hz
    pub pattern: PulseType,
    pub min_intensity: f64,
}

impl Default for PulsePattern {
    fn default() -> Self {
        Self {
            speed: 0.5,
            pattern: PulseType::default(),
            min_intensity: 0.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub enum PulseType {
    #[default]
    Sine, Heartbeat, Flicker, Breathe, Morse,
    Wave, Cascade, Stochastic,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct ParticleEffect {
    pub kind: ParticleKind,
    pub density: u32,
    pub color: Color,
    pub drift_speed: f64,
    pub lifetime: f64,           // seconds
    pub emission_zone: EmissionZone,
    pub gravity: f64,            // -1 (rises) to 1 (falls)
}

impl Default for ParticleEffect {
    fn default() -> Self {
        Self {
            kind: ParticleKind::default(),
            density: 0,
            color: Color::default(),
            drift_speed: 0.5,
            lifetime: 0.5,
            emission_zone: EmissionZone::default(),
            gravity: 0.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub enum ParticleKind {
    #[default]
    Pollen, Firefly, Stardust, FallingPetals, Spores, Motes, Embers,
    Butterflies, Snowflakes, Sparkle, Seeds, Bubbles, Lightning, Raindrops,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub enum EmissionZone {
    #[default]
    Center, PetalEdge, Whole, Above, Roots,
    Stem, Leaves, Spiral,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Iridescence {
    pub intensity: f64,
    pub hue_shift_range: f64,    // degrees of color shift based on angle
    pub affected_parts: Vec<String>, // "petals", "stem", etc.
}

impl Default for Iridescence {
    fn default() -> Self {
        Self {
            intensity: 0.5,
            hue_shift_range: 0.5,
            affected_parts: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Bioluminescence {
    pub pattern: BioPattern,
    pub color: Color,
    pub intensity: f64,
    pub trigger: BioTrigger,
}

impl Default for Bioluminescence {
    fn default() -> Self {
        Self {
            pattern: BioPattern::default(),
            color: Color::default(),
            intensity: 0.5,
            trigger: BioTrigger::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub enum BioPattern {
    #[default]
    Veins, Spots, Edges, Whole, Pulse,
    Fractal, Rings, Stripes, Constellation,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub enum BioTrigger {
    #[default]
    Always, Night, Touch, Proximity, Wind,
    Rain, Music, Moonlight,
}

// ═══════════════════════════════════════════════════════════════════════════
// ROOT SYSTEM — visual underground aesthetic
// ═══════════════════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct RootSystem {
    pub pattern: RootPattern,
    pub depth: f64,
    pub spread: f64,
    pub thickness: f64,
    pub color: Color,
    pub luminescence: Option<GlowEffect>,
    pub mycorrhizal: bool,       // fungal network connections to other flowers!
}

impl Default for RootSystem {
    fn default() -> Self {
        Self {
            pattern: RootPattern::default(),
            depth: 0.5,
            spread: 0.5,
            thickness: 0.5,
            color: Color::default(),
            luminescence: None,
            mycorrhizal: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub enum RootPattern {
    #[default]
    Taproot, Fibrous, Aerial, Rhizome, Tuberous, Adventitious,
    Pneumatophore, Haustorial, Prop,
}

// ═══════════════════════════════════════════════════════════════════════════
// FLOWER PERSONALITY — emergent behavior drivers
// ═══════════════════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct FlowerPersonality {
    pub growth_speed: f64,       // 0.1 (glacial) to 3.0 (vigorous)
    pub hardiness: f64,          // 0.0-1.0 resistance to environmental stress
    pub sociability: f64,        // 0.0 (loner) to 1.0 (thrives near others)
    pub light_preference: LightPreference,
    pub water_need: f64,         // 0.0 (desert) to 1.0 (aquatic)
    pub wind_response: WindResponse,
    pub pollinator_attraction: f64,
    pub fragrance: Option<Fragrance>,
}

impl Default for FlowerPersonality {
    fn default() -> Self {
        Self {
            growth_speed: 1.0,
            hardiness: 0.5,
            sociability: 0.5,
            light_preference: LightPreference::default(),
            water_need: 0.5,
            wind_response: WindResponse::default(),
            pollinator_attraction: 0.5,
            fragrance: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub enum LightPreference {
    #[default]
    FullSun, PartialShade, FullShade, Nocturnal,
    Dappled, Dawn, Twilight,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub enum WindResponse {
    #[default]
    Rigid, Gentle, Dramatic, Dancing,
    Swirling, Trembling,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Fragrance {
    pub intensity: f64,
    pub profile: FragranceProfile,
    pub radius: f64,             // how far the visual "fragrance waves" extend
}

impl Default for Fragrance {
    fn default() -> Self {
        Self {
            intensity: 0.5,
            profile: FragranceProfile::default(),
            radius: 0.5,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub enum FragranceProfile {
    #[default]
    Sweet, Spicy, Earthy, Citrus, Floral, Musky, Ethereal,
    Woody, Aquatic, Green, Powdery, Medicinal,
}

// ═══════════════════════════════════════════════════════════════════════════
// AURA — the ambient effect around the whole flower
// ═══════════════════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Aura {
    pub kind: AuraKind,
    pub color: Color,
    pub opacity: f64,
    pub radius: f64,
    pub animation_speed: f64,
}

impl Default for Aura {
    fn default() -> Self {
        Self {
            kind: AuraKind::default(),
            color: Color::default(),
            opacity: 0.5,
            radius: 0.5,
            animation_speed: 0.5,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub enum AuraKind {
    #[default]
    Mist, Sparkle, Ethereal, Prismatic, Shadow, Flame, Frost, Electric,
    Aurora, Nebula, Crystal, Moonlight, Solar, Void, Rainbow, Storm,
}

// ═══════════════════════════════════════════════════════════════════════════
// SHARED PRIMITIVE TYPES
// ═══════════════════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Color {
    pub r: f64,  // 0.0-1.0
    pub g: f64,
    pub b: f64,
    pub a: f64,
}

impl Default for Color {
    fn default() -> Self {
        Self { r: 0.8, g: 0.2, b: 0.5, a: 1.0 }
    }
}

impl Color {
    pub fn rgb(r: f64, g: f64, b: f64) -> Self {
        Self { r, g, b, a: 1.0 }
    }
    pub fn hex(hex: &str) -> Self {
        let hex = hex.trim_start_matches('#');
        let r = u8::from_str_radix(&hex[0..2], 16).unwrap_or(0) as f64 / 255.0;
        let g = u8::from_str_radix(&hex[2..4], 16).unwrap_or(0) as f64 / 255.0;
        let b = u8::from_str_radix(&hex[4..6], 16).unwrap_or(0) as f64 / 255.0;
        Self { r, g, b, a: 1.0 }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct ColorGradient {
    pub stops: Vec<ColorStop>,
}

impl Default for ColorGradient {
    fn default() -> Self {
        Self {
            stops: vec![ColorStop {
                position: 0.0,
                color: Color::default(),
            }],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct ColorStop {
    pub position: f64,  // 0.0-1.0
    pub color: Color,
}

impl Default for ColorStop {
    fn default() -> Self {
        Self {
            position: 0.0,
            color: Color::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub enum SurfaceTexture {
    #[default]
    Smooth, Velvet, Silk, Papery, Waxy, Rough, Hairy, Glassy, Crystalline, Scaled,
    Metallic, Pearlescent, Fuzzy, Frosted, Leathery, Powdery,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub enum VeinPattern {
    #[default]
    None, Parallel, Branching, Palmate, Reticulate, Dichotomous, Arcuate,
    Pinnate, Anastomosing,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub enum EdgeStyle {
    #[default]
    Smooth, Ruffled, Fringed, Serrated, Rolled, Undulate, Crisped, Lacerate,
    Lobed, Plicate, Revolute, Dentate, Erose,
}
