use serde::{Deserialize, Serialize};

// ═══════════════════════════════════════════════════════════════════════════
// Complete Flower Spec — the top-level structure AI generates
// ═══════════════════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowerSpec {
    pub name: String,
    pub species: String,
    pub petals: PetalSystem,
    pub reproductive: ReproductiveSystem,
    pub structure: StructureSystem,
    pub foliage: FoliageSystem,
    pub ornamentation: OrnamentationSystem,
    pub roots: RootSystem,
    pub aura: Option<Aura>,
    pub personality: FlowerPersonality,
}

// ═══════════════════════════════════════════════════════════════════════════
// PETAL SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PetalSystem {
    pub layers: Vec<PetalLayer>,
    pub bloom_progress: f64,        // 0.0 = bud, 1.0 = full bloom
    pub wilt_progress: f64,         // 0.0 = fresh, 1.0 = wilted
    pub symmetry: Symmetry,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PetalShape {
    Ovate, Lanceolate, Spatulate, Oblong, Orbicular,
    Cordate, Deltoid, Falcate, Ligulate, Tubular,
    Fimbriate, Laciniate, Runcinate,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PetalArrangement {
    Radial, Spiral, Bilateral, Imbricate, Valvate, Contorted, Whorled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Symmetry {
    Radial { order: u32 },
    Bilateral,
    Asymmetric,
    Spiral { divergence_angle: f64 },
}

// ═══════════════════════════════════════════════════════════════════════════
// REPRODUCTIVE SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReproductiveSystem {
    pub pistil: Option<Pistil>,
    pub stamens: Vec<Stamen>,
    pub pollen: Option<PollenSystem>,
    pub nectary: Option<Nectary>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pistil {
    pub style: PistilStyle,
    pub stigma_shape: StigmaShape,
    pub color: Color,
    pub height: f64,
    pub glow: Option<GlowEffect>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PistilStyle { Simple, Compound, Split, Gynobasic, Capitate }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum StigmaShape { Capitate, Plumose, Fimbriate, Clavate, Discoid, Lobed }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Stamen {
    pub filament_curve: f64,     // 0.0-1.0
    pub filament_color: Color,
    pub anther_shape: AntherShape,
    pub anther_color: Color,
    pub pollen_load: f64,        // 0.0-1.0
    pub height: f64,
    pub sway: f64,               // 0.0-1.0 wind responsiveness
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AntherShape { Versatile, Basifixed, Sagittate, Didynamous, Syngenesious }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PollenSystem {
    pub particle_count: u32,
    pub drift_speed: f64,
    pub color: Color,
    pub luminosity: f64,         // 0.0-1.0 (bioluminescent pollen)
    pub dispersal: DispersalPattern,
    pub trail: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DispersalPattern { Gravity, Wind, Burst, Spiral, Chaotic }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Nectary {
    pub position: NectaryPosition,
    pub color: Color,
    pub glow: Option<GlowEffect>,
    pub drip_rate: f64,          // visual drip animation speed
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum NectaryPosition { Basal, Petaline, Sepaline, Receptacular }

// ═══════════════════════════════════════════════════════════════════════════
// STRUCTURE SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StructureSystem {
    pub stem: Stem,
    pub sepals: Vec<Sepal>,
    pub receptacle: Receptacle,
    pub peduncle: Peduncle,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Stem {
    pub height: f64,
    pub thickness: f64,
    pub curvature: f64,          // 0.0 straight, 1.0 arched
    pub color: Color,
    pub thorns: Option<ThornSystem>,
    pub internode_length: f64,
    pub surface: SurfaceTexture,
    pub branching: BranchPattern,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThornSystem {
    pub density: f64,            // thorns per unit
    pub size: f64,
    pub color: Color,
    pub shape: ThornShape,
    pub curve: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ThornShape { Straight, Hooked, Recurved, Bulbous, Barbed }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BranchPattern { None, Alternate, Opposite, Whorled, Dichotomous }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Sepal {
    pub shape: SepalShape,
    pub color: Color,
    pub reflex_angle: f64,       // 0=closed, 180=fully reflexed
    pub texture: SurfaceTexture,
    pub length: f64,
    pub persistent: bool,        // stays after bloom
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SepalShape { Lanceolate, Ovate, Triangular, Leaflike, Petaloid }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Receptacle {
    pub shape: ReceptacleShape,
    pub size: f64,
    pub color: Color,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ReceptacleShape { Flat, Convex, Concave, Conical, Urceolate }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Peduncle {
    pub length: f64,
    pub angle: f64,              // degrees from vertical
    pub flexibility: f64,        // wind responsiveness
    pub color: Color,
}

// ═══════════════════════════════════════════════════════════════════════════
// FOLIAGE SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FoliageSystem {
    pub leaves: Vec<Leaf>,
    pub bracts: Vec<Bract>,
    pub leaf_density: f64,       // 0.0-1.0
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LeafShape {
    Ovate, Lanceolate, Cordate, Palmate, Pinnate, Linear,
    Reniform, Hastate, Sagittate, Peltate, Acicular,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LeafArrangement { Alternate, Opposite, Whorled, Rosette, Basal }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Serration { None, Fine, Coarse, Lobed, Crenate, Dentate, Doubly }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Bract {
    pub color: ColorGradient,
    pub size: f64,
    pub shape: LeafShape,
    pub showy: bool,             // is this a "petal-like" bract (like poinsettia)
    pub position: f64,           // 0.0=base, 1.0=flower head
}

// ═══════════════════════════════════════════════════════════════════════════
// ORNAMENTATION SYSTEM — the magic layer
// ═══════════════════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrnamentationSystem {
    pub dewdrops: Vec<Dewdrop>,
    pub glow: Option<GlowEffect>,
    pub particles: Vec<ParticleEffect>,
    pub iridescence: Option<Iridescence>,
    pub bioluminescence: Option<Bioluminescence>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Dewdrop {
    pub size: f64,
    pub count: u32,
    pub refraction: f64,         // 0.0-1.0 rainbow effect
    pub placement: DewdropPlacement,
    pub surface_tension: f64,    // affects shape: 0=flat, 1=spherical
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DewdropPlacement { Random, PetalTip, VeinJunction, Edge, Center }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlowEffect {
    pub intensity: f64,          // 0.0-1.0
    pub color: Color,
    pub radius: f64,
    pub pulse: Option<PulsePattern>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PulsePattern {
    pub speed: f64,              // Hz
    pub pattern: PulseType,
    pub min_intensity: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PulseType { Sine, Heartbeat, Flicker, Breathe, Morse }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParticleEffect {
    pub kind: ParticleKind,
    pub density: u32,
    pub color: Color,
    pub drift_speed: f64,
    pub lifetime: f64,           // seconds
    pub emission_zone: EmissionZone,
    pub gravity: f64,            // -1 (rises) to 1 (falls)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ParticleKind { Pollen, Firefly, Stardust, FallingPetals, Spores, Motes, Embers }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EmissionZone { Center, PetalEdge, Whole, Above, Roots }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Iridescence {
    pub intensity: f64,
    pub hue_shift_range: f64,    // degrees of color shift based on angle
    pub affected_parts: Vec<String>, // "petals", "stem", etc.
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Bioluminescence {
    pub pattern: BioPattern,
    pub color: Color,
    pub intensity: f64,
    pub trigger: BioTrigger,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BioPattern { Veins, Spots, Edges, Whole, Pulse }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BioTrigger { Always, Night, Touch, Proximity, Wind }

// ═══════════════════════════════════════════════════════════════════════════
// ROOT SYSTEM — visual underground aesthetic
// ═══════════════════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RootSystem {
    pub pattern: RootPattern,
    pub depth: f64,
    pub spread: f64,
    pub thickness: f64,
    pub color: Color,
    pub luminescence: Option<GlowEffect>,
    pub mycorrhizal: bool,       // fungal network connections to other flowers!
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RootPattern { Taproot, Fibrous, Aerial, Rhizome, Tuberous, Adventitious }

// ═══════════════════════════════════════════════════════════════════════════
// FLOWER PERSONALITY — emergent behavior drivers
// ═══════════════════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LightPreference { FullSun, PartialShade, FullShade, Nocturnal }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WindResponse { Rigid, Gentle, Dramatic, Dancing }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Fragrance {
    pub intensity: f64,
    pub profile: FragranceProfile,
    pub radius: f64,             // how far the visual "fragrance waves" extend
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FragranceProfile { Sweet, Spicy, Earthy, Citrus, Floral, Musky, Ethereal }

// ═══════════════════════════════════════════════════════════════════════════
// AURA — the ambient effect around the whole flower
// ═══════════════════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Aura {
    pub kind: AuraKind,
    pub color: Color,
    pub opacity: f64,
    pub radius: f64,
    pub animation_speed: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AuraKind { Mist, Sparkle, Ethereal, Prismatic, Shadow, Flame, Frost, Electric }

// ═══════════════════════════════════════════════════════════════════════════
// SHARED PRIMITIVE TYPES
// ═══════════════════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Color {
    pub r: f64,  // 0.0-1.0
    pub g: f64,
    pub b: f64,
    pub a: f64,
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
pub struct ColorGradient {
    pub stops: Vec<ColorStop>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColorStop {
    pub position: f64,  // 0.0-1.0
    pub color: Color,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SurfaceTexture {
    Smooth, Velvet, Silk, Papery, Waxy, Rough, Hairy, Glassy, Crystalline, Scaled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum VeinPattern {
    None, Parallel, Branching, Palmate, Reticulate, Dichotomous, Arcuate,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EdgeStyle {
    Smooth, Ruffled, Fringed, Serrated, Rolled, Undulate, Crisped, Lacerate,
}
