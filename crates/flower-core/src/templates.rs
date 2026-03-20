use crate::catalog::*;
use serde::{Deserialize, Serialize};

/// A standard flower type rooted in real botany.
/// Each template provides a fully filled FlowerSpec with realistic defaults.
/// AI uses these as a starting point and can vary from them.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowerTemplate {
    pub name: String,
    pub scientific_name: String,
    pub default_spec: FlowerSpec,
    pub color_variants: Vec<String>,
    pub occasions: Vec<String>,
    pub season: String,
    pub physics_archetype: PhysicsArchetype,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum PhysicsArchetype {
    Upright,  // tall, rigid stem — rose, tulip, iris
    Bushy,    // wide, heavy — hydrangea, peony
    Delicate, // light, fluttery — daisy, freesia
    Sturdy,   // heavy, dominant — sunflower, protea
}

impl PhysicsArchetype {
    pub fn mass(&self) -> f64 {
        match self {
            Self::Upright => 1.0,
            Self::Bushy => 1.5,
            Self::Delicate => 0.5,
            Self::Sturdy => 2.0,
        }
    }

    pub fn drag(&self) -> f64 {
        match self {
            Self::Upright => 0.3,
            Self::Bushy => 0.5,
            Self::Delicate => 0.8,
            Self::Sturdy => 0.2,
        }
    }

    pub fn collider_radius(&self) -> f64 {
        // Radii in pixel space — bodies are positioned at canvas pixel coords.
        // Slightly smaller than visual FLOWER_BASE_RADIUS (70px) so flowers
        // visually overlap before physics registers contact.
        match self {
            Self::Upright => 27.0,
            Self::Bushy => 43.0,
            Self::Delicate => 20.0,
            Self::Sturdy => 39.0,
        }
    }
}

pub fn rose() -> FlowerTemplate {
    FlowerTemplate {
        name: "Rose".into(),
        scientific_name: "Rosa damascena".into(),
        color_variants: vec!["Red".into(), "Pink".into(), "White".into(), "Yellow".into(), "Burgundy".into(), "Peach".into(), "Lavender".into(), "Coral".into()],
        occasions: vec!["Romance".into(), "Anniversary".into(), "Sympathy".into(), "Birthday".into()],
        season: "Year-round".into(),
        physics_archetype: PhysicsArchetype::Upright,
        default_spec: FlowerSpec {
            name: "Rose".into(),
            species: "Rosa damascena".into(),
            petals: PetalSystem {
                layers: vec![
                    PetalLayer {
                        index: 0, count: 5, shape: PetalShape::Ovate,
                        arrangement: PetalArrangement::Spiral,
                        curvature: 0.6, curl: 0.3, texture: SurfaceTexture::Velvet,
                        color: ColorGradient { stops: vec![
                            ColorStop { position: 0.0, color: Color::hex("#dc2626") },
                            ColorStop { position: 1.0, color: Color::hex("#991b1b") },
                        ]},
                        opacity: 1.0, vein_pattern: VeinPattern::Branching,
                        edge_style: EdgeStyle::Smooth, width: 1.2, length: 1.5,
                        angular_offset: 0.0, droop: 0.1, thickness: 0.4,
                    },
                    PetalLayer {
                        index: 1, count: 8, shape: PetalShape::Ovate,
                        arrangement: PetalArrangement::Spiral,
                        curvature: 0.4, curl: 0.2, texture: SurfaceTexture::Velvet,
                        color: ColorGradient { stops: vec![
                            ColorStop { position: 0.0, color: Color::hex("#ef4444") },
                            ColorStop { position: 1.0, color: Color::hex("#dc2626") },
                        ]},
                        opacity: 1.0, vein_pattern: VeinPattern::Branching,
                        edge_style: EdgeStyle::Smooth, width: 1.0, length: 1.3,
                        angular_offset: 36.0, droop: 0.15, thickness: 0.35,
                    },
                    PetalLayer {
                        index: 2, count: 13, shape: PetalShape::Ovate,
                        arrangement: PetalArrangement::Spiral,
                        curvature: 0.2, curl: 0.1, texture: SurfaceTexture::Velvet,
                        color: ColorGradient { stops: vec![
                            ColorStop { position: 0.0, color: Color::hex("#f87171") },
                            ColorStop { position: 1.0, color: Color::hex("#ef4444") },
                        ]},
                        opacity: 0.95, vein_pattern: VeinPattern::Branching,
                        edge_style: EdgeStyle::Ruffled, width: 0.9, length: 1.1,
                        angular_offset: 18.0, droop: 0.2, thickness: 0.3,
                    },
                ],
                bloom_progress: 1.0,
                wilt_progress: 0.0,
                symmetry: Symmetry::Spiral { divergence_angle: 137.5 },
            },
            reproductive: ReproductiveSystem {
                pistil: Some(Pistil {
                    style: PistilStyle::Compound,
                    stigma_shape: StigmaShape::Capitate,
                    color: Color::hex("#fbbf24"),
                    height: 0.3,
                    glow: None,
                }),
                stamens: vec![Stamen {
                    filament_curve: 0.2, filament_color: Color::hex("#fde68a"),
                    anther_shape: AntherShape::Versatile, anther_color: Color::hex("#f59e0b"),
                    pollen_load: 0.7, height: 0.25, sway: 0.3,
                }],
                pollen: Some(PollenSystem {
                    particle_count: 8, drift_speed: 0.3,
                    color: Color::hex("#fbbf24"), luminosity: 0.0,
                    dispersal: DispersalPattern::Gravity, trail: false,
                }),
                nectary: Some(Nectary {
                    position: NectaryPosition::Basal,
                    color: Color::hex("#fef3c7"),
                    glow: None, drip_rate: 0.1,
                }),
            },
            structure: StructureSystem {
                stem: Stem {
                    height: 0.7, thickness: 0.4, curvature: 0.15,
                    color: Color::hex("#166534"),
                    thorns: Some(ThornSystem {
                        density: 0.3, size: 0.15, color: Color::hex("#15803d"),
                        shape: ThornShape::Hooked, curve: 0.4,
                    }),
                    internode_length: 0.15, surface: SurfaceTexture::Smooth,
                    branching: BranchPattern::Alternate,
                    style: StemStyle::default(),
                },
                sepals: vec![Sepal {
                    shape: SepalShape::Lanceolate, color: Color::hex("#166534"),
                    reflex_angle: 120.0, texture: SurfaceTexture::Smooth,
                    length: 0.3, persistent: true,
                }],
                receptacle: Receptacle {
                    shape: ReceptacleShape::Urceolate, size: 0.2,
                    color: Color::hex("#166534"),
                },
                peduncle: Peduncle {
                    length: 0.15, angle: 5.0, flexibility: 0.2,
                    color: Color::hex("#166534"),
                },
            },
            foliage: FoliageSystem {
                leaves: vec![Leaf {
                    shape: LeafShape::Ovate, size: 0.6,
                    color: ColorGradient { stops: vec![
                        ColorStop { position: 0.0, color: Color::hex("#166534") },
                        ColorStop { position: 1.0, color: Color::hex("#15803d") },
                    ]},
                    vein_pattern: VeinPattern::Reticulate,
                    serration: Serration::Fine,
                    arrangement: LeafArrangement::Alternate,
                    phyllotaxis_angle: 137.5, droop: 0.2, curl: 0.1,
                    translucency: 0.15,
                }],
                bracts: vec![],
                leaf_density: 0.6,
            },
            ornamentation: OrnamentationSystem {
                dewdrops: vec![Dewdrop {
                    size: 0.08, count: 3, refraction: 0.6,
                    placement: DewdropPlacement::PetalTip, surface_tension: 0.8,
                }],
                glow: None, particles: vec![], iridescence: None, bioluminescence: None,
            },
            roots: RootSystem {
                pattern: RootPattern::Taproot, depth: 0.7, spread: 0.5,
                thickness: 0.3, color: Color::hex("#78350f"),
                luminescence: None, mycorrhizal: true,
            },
            aura: None,
            personality: FlowerPersonality {
                growth_speed: 1.0, hardiness: 0.6, sociability: 0.7,
                light_preference: LightPreference::FullSun,
                water_need: 0.5, wind_response: WindResponse::Gentle,
                pollinator_attraction: 0.8,
                fragrance: Some(Fragrance {
                    intensity: 0.7, profile: FragranceProfile::Floral, radius: 0.5,
                }),
            },
        },
    }
}

pub fn sunflower() -> FlowerTemplate {
    FlowerTemplate {
        name: "Sunflower".into(),
        scientific_name: "Helianthus annuus".into(),
        color_variants: vec!["Yellow".into(), "Orange".into(), "Red".into(), "Chocolate".into(), "Lemon".into()],
        occasions: vec!["Birthday".into(), "Get Well".into(), "Thank You".into()],
        season: "Summer".into(),
        physics_archetype: PhysicsArchetype::Sturdy,
        default_spec: FlowerSpec {
            name: "Sunflower".into(),
            species: "Helianthus annuus".into(),
            petals: PetalSystem {
                layers: vec![PetalLayer {
                    index: 0, count: 21, shape: PetalShape::Lanceolate,
                    arrangement: PetalArrangement::Radial,
                    curvature: -0.2, curl: 0.0, texture: SurfaceTexture::Papery,
                    color: ColorGradient { stops: vec![
                        ColorStop { position: 0.0, color: Color::hex("#facc15") },
                        ColorStop { position: 1.0, color: Color::hex("#eab308") },
                    ]},
                    opacity: 1.0, vein_pattern: VeinPattern::Parallel,
                    edge_style: EdgeStyle::Smooth, width: 0.6, length: 2.5,
                    angular_offset: 0.0, droop: 0.3, thickness: 0.2,
                }],
                bloom_progress: 1.0, wilt_progress: 0.0,
                symmetry: Symmetry::Radial { order: 21 },
            },
            reproductive: ReproductiveSystem {
                pistil: None,
                stamens: vec![],
                pollen: Some(PollenSystem {
                    particle_count: 15, drift_speed: 0.4,
                    color: Color::hex("#ca8a04"), luminosity: 0.0,
                    dispersal: DispersalPattern::Wind, trail: false,
                }),
                nectary: Some(Nectary {
                    position: NectaryPosition::Receptacular,
                    color: Color::hex("#fef08a"), glow: None, drip_rate: 0.2,
                }),
            },
            structure: StructureSystem {
                stem: Stem {
                    height: 1.5, thickness: 0.6, curvature: 0.05,
                    color: Color::hex("#166534"), thorns: None,
                    internode_length: 0.25, surface: SurfaceTexture::Hairy,
                    branching: BranchPattern::Alternate,
                    style: StemStyle::default(),
                },
                sepals: vec![],
                receptacle: Receptacle {
                    shape: ReceptacleShape::Convex, size: 0.8,
                    color: Color::hex("#78350f"),
                },
                peduncle: Peduncle {
                    length: 0.3, angle: 10.0, flexibility: 0.1,
                    color: Color::hex("#166534"),
                },
            },
            foliage: FoliageSystem {
                leaves: vec![Leaf {
                    shape: LeafShape::Cordate, size: 1.2,
                    color: ColorGradient { stops: vec![
                        ColorStop { position: 0.0, color: Color::hex("#166534") },
                        ColorStop { position: 1.0, color: Color::hex("#15803d") },
                    ]},
                    vein_pattern: VeinPattern::Palmate, serration: Serration::Coarse,
                    arrangement: LeafArrangement::Alternate,
                    phyllotaxis_angle: 137.5, droop: 0.3, curl: 0.0, translucency: 0.1,
                }],
                bracts: vec![], leaf_density: 0.4,
            },
            ornamentation: OrnamentationSystem {
                dewdrops: vec![], glow: None,
                particles: vec![ParticleEffect {
                    kind: ParticleKind::Pollen, density: 5,
                    color: Color::hex("#ca8a04"), drift_speed: 0.4,
                    lifetime: 3.0, emission_zone: EmissionZone::Center, gravity: 0.3,
                }],
                iridescence: None, bioluminescence: None,
            },
            roots: RootSystem {
                pattern: RootPattern::Taproot, depth: 0.9, spread: 0.6,
                thickness: 0.5, color: Color::hex("#78350f"),
                luminescence: None, mycorrhizal: false,
            },
            aura: None,
            personality: FlowerPersonality {
                growth_speed: 2.0, hardiness: 0.7, sociability: 0.4,
                light_preference: LightPreference::FullSun,
                water_need: 0.6, wind_response: WindResponse::Rigid,
                pollinator_attraction: 0.9,
                fragrance: None,
            },
        },
    }
}

pub fn daisy() -> FlowerTemplate {
    FlowerTemplate {
        name: "Daisy".into(),
        scientific_name: "Bellis perennis".into(),
        color_variants: vec!["White".into(), "Pink".into(), "Yellow".into(), "Lavender".into()],
        occasions: vec!["Everyday".into(), "Get Well".into(), "Birthday".into()],
        season: "Spring-Summer".into(),
        physics_archetype: PhysicsArchetype::Delicate,
        default_spec: FlowerSpec {
            name: "Daisy".into(),
            species: "Bellis perennis".into(),
            petals: PetalSystem {
                layers: vec![PetalLayer {
                    index: 0, count: 13, shape: PetalShape::Spatulate,
                    arrangement: PetalArrangement::Radial,
                    curvature: -0.1, curl: 0.0, texture: SurfaceTexture::Smooth,
                    color: ColorGradient { stops: vec![
                        ColorStop { position: 0.0, color: Color::rgb(1.0, 1.0, 1.0) },
                        ColorStop { position: 0.9, color: Color::rgb(1.0, 1.0, 1.0) },
                        ColorStop { position: 1.0, color: Color::rgb(0.95, 0.95, 0.9) },
                    ]},
                    opacity: 1.0, vein_pattern: VeinPattern::Parallel,
                    edge_style: EdgeStyle::Smooth, width: 0.4, length: 1.2,
                    angular_offset: 0.0, droop: 0.05, thickness: 0.15,
                }],
                bloom_progress: 1.0, wilt_progress: 0.0,
                symmetry: Symmetry::Radial { order: 13 },
            },
            reproductive: ReproductiveSystem {
                pistil: None, stamens: vec![],
                pollen: Some(PollenSystem {
                    particle_count: 5, drift_speed: 0.2,
                    color: Color::hex("#eab308"), luminosity: 0.0,
                    dispersal: DispersalPattern::Wind, trail: false,
                }),
                nectary: None,
            },
            structure: StructureSystem {
                stem: Stem {
                    height: 0.3, thickness: 0.15, curvature: 0.1,
                    color: Color::hex("#22c55e"), thorns: None,
                    internode_length: 0.1, surface: SurfaceTexture::Smooth,
                    branching: BranchPattern::None,
                    style: StemStyle::default(),
                },
                sepals: vec![], receptacle: Receptacle {
                    shape: ReceptacleShape::Convex, size: 0.3,
                    color: Color::hex("#eab308"),
                },
                peduncle: Peduncle {
                    length: 0.1, angle: 0.0, flexibility: 0.6,
                    color: Color::hex("#22c55e"),
                },
            },
            foliage: FoliageSystem {
                leaves: vec![Leaf {
                    shape: LeafShape::Ovate, size: 0.3,
                    color: ColorGradient { stops: vec![
                        ColorStop { position: 0.0, color: Color::hex("#22c55e") },
                        ColorStop { position: 1.0, color: Color::hex("#16a34a") },
                    ]},
                    vein_pattern: VeinPattern::Reticulate, serration: Serration::Crenate,
                    arrangement: LeafArrangement::Rosette,
                    phyllotaxis_angle: 137.5, droop: 0.1, curl: 0.0, translucency: 0.2,
                }],
                bracts: vec![], leaf_density: 0.3,
            },
            ornamentation: OrnamentationSystem {
                dewdrops: vec![Dewdrop {
                    size: 0.05, count: 5, refraction: 0.4,
                    placement: DewdropPlacement::Random, surface_tension: 0.7,
                }],
                glow: None, particles: vec![], iridescence: None, bioluminescence: None,
            },
            roots: RootSystem {
                pattern: RootPattern::Fibrous, depth: 0.3, spread: 0.4,
                thickness: 0.1, color: Color::hex("#a16207"),
                luminescence: None, mycorrhizal: false,
            },
            aura: None,
            personality: FlowerPersonality {
                growth_speed: 1.5, hardiness: 0.8, sociability: 0.9,
                light_preference: LightPreference::FullSun,
                water_need: 0.4, wind_response: WindResponse::Dancing,
                pollinator_attraction: 0.6,
                fragrance: Some(Fragrance {
                    intensity: 0.2, profile: FragranceProfile::Sweet, radius: 0.2,
                }),
            },
        },
    }
}

pub fn orchid() -> FlowerTemplate {
    FlowerTemplate {
        name: "Orchid".into(),
        scientific_name: "Phalaenopsis amabilis".into(),
        color_variants: vec!["White".into(), "Purple".into(), "Pink".into(), "Yellow".into(), "Spotted".into()],
        occasions: vec!["Romance".into(), "Congratulations".into(), "Anniversary".into()],
        season: "Year-round".into(),
        physics_archetype: PhysicsArchetype::Delicate,
        default_spec: FlowerSpec {
            name: "Orchid".into(),
            species: "Phalaenopsis amabilis".into(),
            petals: PetalSystem {
                layers: vec![PetalLayer {
                    index: 0, count: 3, shape: PetalShape::Ovate,
                    arrangement: PetalArrangement::Bilateral,
                    curvature: 0.3, curl: 0.15, texture: SurfaceTexture::Waxy,
                    color: ColorGradient { stops: vec![
                        ColorStop { position: 0.0, color: Color::rgb(1.0, 1.0, 1.0) },
                        ColorStop { position: 0.7, color: Color::rgb(0.95, 0.9, 0.95) },
                        ColorStop { position: 1.0, color: Color::hex("#e9d5ff") },
                    ]},
                    opacity: 0.95, vein_pattern: VeinPattern::Branching,
                    edge_style: EdgeStyle::Undulate, width: 1.5, length: 1.8,
                    angular_offset: 0.0, droop: 0.1, thickness: 0.25,
                }],
                bloom_progress: 1.0, wilt_progress: 0.0,
                symmetry: Symmetry::Bilateral,
            },
            reproductive: ReproductiveSystem {
                pistil: Some(Pistil {
                    style: PistilStyle::Compound, stigma_shape: StigmaShape::Lobed,
                    color: Color::hex("#fbbf24"), height: 0.15, glow: None,
                }),
                stamens: vec![], pollen: None,
                nectary: Some(Nectary {
                    position: NectaryPosition::Petaline,
                    color: Color::hex("#fef3c7"), glow: None, drip_rate: 0.05,
                }),
            },
            structure: StructureSystem {
                stem: Stem {
                    height: 0.6, thickness: 0.2, curvature: 0.3,
                    color: Color::hex("#166534"), thorns: None,
                    internode_length: 0.1, surface: SurfaceTexture::Smooth,
                    branching: BranchPattern::Alternate,
                    style: StemStyle::default(),
                },
                sepals: vec![Sepal {
                    shape: SepalShape::Petaloid, color: Color::rgb(0.95, 0.95, 0.95),
                    reflex_angle: 45.0, texture: SurfaceTexture::Waxy,
                    length: 0.4, persistent: true,
                }],
                receptacle: Receptacle {
                    shape: ReceptacleShape::Concave, size: 0.15,
                    color: Color::hex("#166534"),
                },
                peduncle: Peduncle {
                    length: 0.2, angle: 15.0, flexibility: 0.5,
                    color: Color::hex("#166534"),
                },
            },
            foliage: FoliageSystem {
                leaves: vec![Leaf {
                    shape: LeafShape::Linear, size: 0.8,
                    color: ColorGradient { stops: vec![
                        ColorStop { position: 0.0, color: Color::hex("#166534") },
                        ColorStop { position: 1.0, color: Color::hex("#14532d") },
                    ]},
                    vein_pattern: VeinPattern::Parallel, serration: Serration::None,
                    arrangement: LeafArrangement::Alternate,
                    phyllotaxis_angle: 180.0, droop: 0.4, curl: 0.1, translucency: 0.3,
                }],
                bracts: vec![], leaf_density: 0.3,
            },
            ornamentation: OrnamentationSystem {
                dewdrops: vec![], glow: None, particles: vec![],
                iridescence: Some(Iridescence {
                    intensity: 0.3, hue_shift_range: 30.0,
                    affected_parts: vec!["petals".into()],
                }),
                bioluminescence: None,
            },
            roots: RootSystem {
                pattern: RootPattern::Aerial, depth: 0.2, spread: 0.3,
                thickness: 0.15, color: Color::hex("#a3a3a3"),
                luminescence: None, mycorrhizal: true,
            },
            aura: Some(Aura {
                kind: AuraKind::Ethereal, color: Color::hex("#e9d5ff"),
                opacity: 0.15, radius: 0.4, animation_speed: 0.5,
            }),
            personality: FlowerPersonality {
                growth_speed: 0.5, hardiness: 0.3, sociability: 0.6,
                light_preference: LightPreference::PartialShade,
                water_need: 0.7, wind_response: WindResponse::Gentle,
                pollinator_attraction: 0.7,
                fragrance: Some(Fragrance {
                    intensity: 0.4, profile: FragranceProfile::Sweet, radius: 0.3,
                }),
            },
        },
    }
}

pub fn tulip() -> FlowerTemplate {
    FlowerTemplate {
        name: "Tulip".into(),
        scientific_name: "Tulipa gesneriana".into(),
        color_variants: vec!["Red".into(), "Yellow".into(), "Purple".into(), "White".into(), "Pink".into(), "Orange".into(), "Bi-color".into()],
        occasions: vec!["Birthday".into(), "Thank You".into(), "Congratulations".into()],
        season: "Spring".into(),
        physics_archetype: PhysicsArchetype::Upright,
        default_spec: FlowerSpec {
            name: "Tulip".into(),
            species: "Tulipa gesneriana".into(),
            petals: PetalSystem {
                layers: vec![PetalLayer {
                    index: 0, count: 6, shape: PetalShape::Ovate,
                    arrangement: PetalArrangement::Imbricate,
                    curvature: 0.5, curl: 0.0, texture: SurfaceTexture::Silk,
                    color: ColorGradient { stops: vec![
                        ColorStop { position: 0.0, color: Color::hex("#dc2626") },
                        ColorStop { position: 0.8, color: Color::hex("#ef4444") },
                        ColorStop { position: 1.0, color: Color::hex("#fca5a5") },
                    ]},
                    opacity: 1.0, vein_pattern: VeinPattern::Parallel,
                    edge_style: EdgeStyle::Smooth, width: 1.0, length: 1.5,
                    angular_offset: 0.0, droop: 0.0, thickness: 0.3,
                }],
                bloom_progress: 1.0, wilt_progress: 0.0,
                symmetry: Symmetry::Radial { order: 3 },
            },
            reproductive: ReproductiveSystem {
                pistil: Some(Pistil {
                    style: PistilStyle::Simple, stigma_shape: StigmaShape::Capitate,
                    color: Color::hex("#166534"), height: 0.2, glow: None,
                }),
                stamens: vec![Stamen {
                    filament_curve: 0.1, filament_color: Color::hex("#166534"),
                    anther_shape: AntherShape::Basifixed, anther_color: Color::hex("#1e3a5f"),
                    pollen_load: 0.5, height: 0.18, sway: 0.1,
                }],
                pollen: None, nectary: None,
            },
            structure: StructureSystem {
                stem: Stem {
                    height: 0.5, thickness: 0.3, curvature: 0.05,
                    color: Color::hex("#166534"), thorns: None,
                    internode_length: 0.5, surface: SurfaceTexture::Smooth,
                    branching: BranchPattern::None,
                    style: StemStyle::default(),
                },
                sepals: vec![], receptacle: Receptacle {
                    shape: ReceptacleShape::Flat, size: 0.15,
                    color: Color::hex("#166534"),
                },
                peduncle: Peduncle {
                    length: 0.1, angle: 0.0, flexibility: 0.3,
                    color: Color::hex("#166534"),
                },
            },
            foliage: FoliageSystem {
                leaves: vec![Leaf {
                    shape: LeafShape::Lanceolate, size: 0.7,
                    color: ColorGradient { stops: vec![
                        ColorStop { position: 0.0, color: Color::hex("#166534") },
                        ColorStop { position: 1.0, color: Color::hex("#15803d") },
                    ]},
                    vein_pattern: VeinPattern::Parallel, serration: Serration::None,
                    arrangement: LeafArrangement::Basal,
                    phyllotaxis_angle: 180.0, droop: 0.2, curl: 0.15, translucency: 0.15,
                }],
                bracts: vec![], leaf_density: 0.3,
            },
            ornamentation: OrnamentationSystem {
                dewdrops: vec![], glow: None, particles: vec![],
                iridescence: None, bioluminescence: None,
            },
            roots: RootSystem {
                pattern: RootPattern::Tuberous, depth: 0.4, spread: 0.2,
                thickness: 0.3, color: Color::hex("#78350f"),
                luminescence: None, mycorrhizal: false,
            },
            aura: None,
            personality: FlowerPersonality {
                growth_speed: 1.2, hardiness: 0.5, sociability: 0.8,
                light_preference: LightPreference::FullSun,
                water_need: 0.5, wind_response: WindResponse::Gentle,
                pollinator_attraction: 0.5,
                fragrance: Some(Fragrance {
                    intensity: 0.3, profile: FragranceProfile::Sweet, radius: 0.2,
                }),
            },
        },
    }
}

// ── Helpers for concise template definitions ────────────────────────────────

/// Generate a base FlowerSpec from an archetype with customizable overrides.
fn base_spec(
    name: &str,
    species: &str,
    archetype: PhysicsArchetype,
    primary_color: &str,
    petal_count: u32,
    petal_shape: PetalShape,
    symmetry: Symmetry,
    light: LightPreference,
    wind: WindResponse,
    hardiness: f64,
    water: f64,
    pollinator: f64,
    fragrance_intensity: f64,
    fragrance_profile: FragranceProfile,
    stem_height: f64,
    leaf_shape: LeafShape,
    mycorrhizal: bool,
) -> FlowerSpec {
    let (mass, _drag, _radius) = (
        archetype.mass(),
        archetype.drag(),
        archetype.collider_radius(),
    );
    let stem_thickness = match archetype {
        PhysicsArchetype::Sturdy => 0.5 + mass * 0.1,
        PhysicsArchetype::Bushy => 0.35,
        PhysicsArchetype::Upright => 0.3,
        PhysicsArchetype::Delicate => 0.15,
    };

    FlowerSpec {
        name: name.into(),
        species: species.into(),
        petals: PetalSystem {
            layers: vec![PetalLayer {
                index: 0, count: petal_count, shape: petal_shape,
                arrangement: PetalArrangement::Radial,
                curvature: 0.3, curl: 0.1, texture: SurfaceTexture::Smooth,
                color: ColorGradient { stops: vec![
                    ColorStop { position: 0.0, color: Color::hex(primary_color) },
                    ColorStop { position: 1.0, color: Color::hex(primary_color) },
                ]},
                opacity: 1.0, vein_pattern: VeinPattern::Branching,
                edge_style: EdgeStyle::Smooth, width: 1.0, length: 1.2,
                angular_offset: 0.0, droop: 0.1, thickness: 0.25,
            }],
            bloom_progress: 1.0, wilt_progress: 0.0, symmetry,
        },
        reproductive: ReproductiveSystem {
            pistil: Some(Pistil {
                style: PistilStyle::Simple, stigma_shape: StigmaShape::Capitate,
                color: Color::hex("#fbbf24"), height: 0.2, glow: None,
            }),
            stamens: vec![],
            pollen: Some(PollenSystem {
                particle_count: 5, drift_speed: 0.3,
                color: Color::hex("#eab308"), luminosity: 0.0,
                dispersal: DispersalPattern::Wind, trail: false,
            }),
            nectary: None,
        },
        structure: StructureSystem {
            stem: Stem {
                height: stem_height, thickness: stem_thickness, curvature: 0.1,
                color: Color::hex("#166534"), thorns: None,
                internode_length: 0.2, surface: SurfaceTexture::Smooth,
                branching: BranchPattern::None,
                style: StemStyle::default(),
            },
            sepals: vec![], receptacle: Receptacle {
                shape: ReceptacleShape::Flat, size: 0.2,
                color: Color::hex("#166534"),
            },
            peduncle: Peduncle {
                length: 0.15, angle: 5.0, flexibility: 0.3,
                color: Color::hex("#166534"),
            },
        },
        foliage: FoliageSystem {
            leaves: vec![Leaf {
                shape: leaf_shape, size: 0.5,
                color: ColorGradient { stops: vec![
                    ColorStop { position: 0.0, color: Color::hex("#166534") },
                    ColorStop { position: 1.0, color: Color::hex("#15803d") },
                ]},
                vein_pattern: VeinPattern::Reticulate, serration: Serration::None,
                arrangement: LeafArrangement::Alternate,
                phyllotaxis_angle: 137.5, droop: 0.2, curl: 0.0, translucency: 0.15,
            }],
            bracts: vec![], leaf_density: 0.4,
        },
        ornamentation: OrnamentationSystem {
            dewdrops: vec![], glow: None, particles: vec![],
            iridescence: None, bioluminescence: None,
        },
        roots: RootSystem {
            pattern: RootPattern::Fibrous, depth: 0.5, spread: 0.4,
            thickness: 0.2, color: Color::hex("#78350f"),
            luminescence: None, mycorrhizal,
        },
        aura: None,
        personality: FlowerPersonality {
            growth_speed: 1.0, hardiness, sociability: 0.5,
            light_preference: light, water_need: water,
            wind_response: wind, pollinator_attraction: pollinator,
            fragrance: if fragrance_intensity > 0.0 {
                Some(Fragrance { intensity: fragrance_intensity, profile: fragrance_profile, radius: 0.3 })
            } else { None },
        },
    }
}

fn tpl(
    name: &str, scientific: &str,
    colors: &[&str], occasions: &[&str], season: &str,
    arch: PhysicsArchetype, spec: FlowerSpec,
) -> FlowerTemplate {
    FlowerTemplate {
        name: name.into(), scientific_name: scientific.into(),
        color_variants: colors.iter().map(|s| (*s).into()).collect(),
        occasions: occasions.iter().map(|s| (*s).into()).collect(),
        season: season.into(),
        physics_archetype: arch,
        default_spec: spec,
    }
}

/// Override stem style on a base_spec.
fn styled(mut spec: FlowerSpec, style: StemStyle) -> FlowerSpec {
    spec.structure.stem.style = style;
    spec
}

/// Override petal texture on all layers.
fn textured(mut spec: FlowerSpec, tex: SurfaceTexture) -> FlowerSpec {
    spec.petals.layers.iter_mut().for_each(|l| l.texture = tex.clone());
    spec
}

/// Override petal edge style on all layers.
fn edged(mut spec: FlowerSpec, edge: EdgeStyle) -> FlowerSpec {
    spec.petals.layers.iter_mut().for_each(|l| l.edge_style = edge.clone());
    spec
}

/// Add an aura to a spec.
fn with_aura(mut spec: FlowerSpec, kind: AuraKind, color: &str, opacity: f64) -> FlowerSpec {
    spec.aura = Some(Aura {
        kind, color: Color::hex(color), opacity, radius: 0.4, animation_speed: 0.5,
    });
    spec
}

/// Returns all flower templates.
pub fn all_templates() -> Vec<FlowerTemplate> {
    vec![
        rose(), sunflower(), daisy(), orchid(), tulip(),

        // ── Standard florist flowers ────────────────────────────────────────

        tpl("Carnation", "Dianthus caryophyllus",
            &["Red","White","Pink","Yellow","Orange","Lavender"], &["Birthday","Get Well","Sympathy","Thank You"], "Year-round",
            PhysicsArchetype::Upright,
            base_spec("Carnation", "Dianthus caryophyllus", PhysicsArchetype::Upright,
                "#ec4899", 30, PetalShape::Fimbriate, Symmetry::Radial{order:5},
                LightPreference::FullSun, WindResponse::Gentle, 0.7, 0.4, 0.5, 0.5, FragranceProfile::Spicy, 0.5, LeafShape::Linear, false)),

        tpl("Gerbera Daisy", "Gerbera jamesonii",
            &["Red","White","Pink","Yellow","Orange"], &["Birthday","Congratulations","Thank You"], "Year-round",
            PhysicsArchetype::Upright,
            base_spec("Gerbera Daisy", "Gerbera jamesonii", PhysicsArchetype::Upright,
                "#f97316", 21, PetalShape::Spatulate, Symmetry::Radial{order:21},
                LightPreference::FullSun, WindResponse::Gentle, 0.5, 0.5, 0.7, 0.2, FragranceProfile::Sweet, 0.4, LeafShape::Ovate, false)),

        tpl("Lily", "Lilium candidum",
            &["White","Pink","Yellow","Orange"], &["Anniversary","Sympathy","Thank You"], "Summer",
            PhysicsArchetype::Upright,
            base_spec("Lily", "Lilium candidum", PhysicsArchetype::Upright,
                "#fefce8", 6, PetalShape::Lanceolate, Symmetry::Radial{order:3},
                LightPreference::PartialShade, WindResponse::Gentle, 0.6, 0.5, 0.8, 0.8, FragranceProfile::Floral, 0.7, LeafShape::Lanceolate, true)),

        tpl("Alstroemeria", "Alstroemeria aurea",
            &["Pink","White","Yellow","Orange","Lavender"], &["Birthday","Thank You"], "Year-round",
            PhysicsArchetype::Upright,
            base_spec("Alstroemeria", "Alstroemeria aurea", PhysicsArchetype::Upright,
                "#f472b6", 6, PetalShape::Lanceolate, Symmetry::Bilateral,
                LightPreference::PartialShade, WindResponse::Gentle, 0.7, 0.5, 0.6, 0.0, FragranceProfile::Sweet, 0.5, LeafShape::Lanceolate, false)),

        tpl("Hydrangea", "Hydrangea macrophylla",
            &["Blue","White","Pink","Green"], &["Anniversary","Sympathy"], "Summer",
            PhysicsArchetype::Bushy,
            base_spec("Hydrangea", "Hydrangea macrophylla", PhysicsArchetype::Bushy,
                "#3b82f6", 40, PetalShape::Orbicular, Symmetry::Radial{order:4},
                LightPreference::PartialShade, WindResponse::Rigid, 0.5, 0.8, 0.4, 0.3, FragranceProfile::Sweet, 0.6, LeafShape::Ovate, true)),

        tpl("Iris", "Iris germanica",
            &["Blue","Purple","White"], &["Birthday","Thank You"], "Spring",
            PhysicsArchetype::Upright,
            base_spec("Iris", "Iris germanica", PhysicsArchetype::Upright,
                "#6366f1", 6, PetalShape::Lanceolate, Symmetry::Radial{order:3},
                LightPreference::FullSun, WindResponse::Gentle, 0.6, 0.4, 0.5, 0.4, FragranceProfile::Floral, 0.6, LeafShape::Linear, true)),

        tpl("Snapdragon", "Antirrhinum majus",
            &["Pink","White","Yellow","Orange"], &["Anniversary","Congratulations"], "Spring-Fall",
            PhysicsArchetype::Upright,
            base_spec("Snapdragon", "Antirrhinum majus", PhysicsArchetype::Upright,
                "#f43f5e", 20, PetalShape::Tubular, Symmetry::Bilateral,
                LightPreference::FullSun, WindResponse::Rigid, 0.7, 0.5, 0.7, 0.3, FragranceProfile::Sweet, 0.7, LeafShape::Lanceolate, false)),

        tpl("Stock", "Matthiola incana",
            &["Pink","White","Lavender"], &["Anniversary","Thank You"], "Spring",
            PhysicsArchetype::Upright,
            base_spec("Stock", "Matthiola incana", PhysicsArchetype::Upright,
                "#c084fc", 30, PetalShape::Orbicular, Symmetry::Radial{order:4},
                LightPreference::FullSun, WindResponse::Gentle, 0.5, 0.5, 0.5, 0.7, FragranceProfile::Spicy, 0.5, LeafShape::Lanceolate, false)),

        tpl("Aster", "Aster amellus",
            &["Purple","Pink","White"], &["Birthday","Thank You"], "Fall",
            PhysicsArchetype::Delicate,
            base_spec("Aster", "Aster amellus", PhysicsArchetype::Delicate,
                "#a855f7", 21, PetalShape::Lanceolate, Symmetry::Radial{order:21},
                LightPreference::FullSun, WindResponse::Dancing, 0.7, 0.4, 0.6, 0.2, FragranceProfile::Sweet, 0.3, LeafShape::Lanceolate, false)),

        tpl("Lisianthus", "Eustoma grandiflorum",
            &["Purple","White","Pink"], &["Anniversary","Love & Romance"], "Summer",
            PhysicsArchetype::Delicate,
            base_spec("Lisianthus", "Eustoma grandiflorum", PhysicsArchetype::Delicate,
                "#7c3aed", 8, PetalShape::Ovate, Symmetry::Spiral{divergence_angle:137.5},
                LightPreference::PartialShade, WindResponse::Gentle, 0.4, 0.6, 0.6, 0.3, FragranceProfile::Floral, 0.5, LeafShape::Ovate, false)),

        tpl("Chrysanthemum", "Chrysanthemum morifolium",
            &["Yellow","White","Lavender","Pink"], &["Birthday","Get Well","Thank You"], "Fall",
            PhysicsArchetype::Bushy,
            base_spec("Chrysanthemum", "Chrysanthemum morifolium", PhysicsArchetype::Bushy,
                "#facc15", 50, PetalShape::Lanceolate, Symmetry::Radial{order:8},
                LightPreference::FullSun, WindResponse::Rigid, 0.8, 0.5, 0.6, 0.3, FragranceProfile::Earthy, 0.5, LeafShape::Palmate, true)),

        tpl("Delphinium", "Delphinium elatum",
            &["Blue","White"], &["Anniversary","Congratulations"], "Summer",
            PhysicsArchetype::Upright,
            base_spec("Delphinium", "Delphinium elatum", PhysicsArchetype::Upright,
                "#2563eb", 5, PetalShape::Spatulate, Symmetry::Bilateral,
                LightPreference::FullSun, WindResponse::Rigid, 0.5, 0.6, 0.7, 0.2, FragranceProfile::Sweet, 1.0, LeafShape::Palmate, false)),

        tpl("Peony", "Paeonia lactiflora",
            &["Pink","White","Red"], &["Anniversary","Love & Romance"], "Spring",
            PhysicsArchetype::Bushy,
            base_spec("Peony", "Paeonia lactiflora", PhysicsArchetype::Bushy,
                "#f9a8d4", 40, PetalShape::Ovate, Symmetry::Spiral{divergence_angle:137.5},
                LightPreference::FullSun, WindResponse::Gentle, 0.5, 0.6, 0.8, 0.9, FragranceProfile::Floral, 0.5, LeafShape::Palmate, true)),

        tpl("Freesia", "Freesia refracta",
            &["White","Yellow","Pink","Lavender"], &["Birthday","Thank You"], "Spring",
            PhysicsArchetype::Delicate,
            base_spec("Freesia", "Freesia refracta", PhysicsArchetype::Delicate,
                "#fef08a", 6, PetalShape::Tubular, Symmetry::Bilateral,
                LightPreference::FullSun, WindResponse::Dancing, 0.5, 0.5, 0.6, 0.8, FragranceProfile::Citrus, 0.4, LeafShape::Linear, false)),

        tpl("Ranunculus", "Ranunculus asiaticus",
            &["Pink","White","Yellow","Orange","Red"], &["Anniversary","Love & Romance"], "Spring",
            PhysicsArchetype::Delicate,
            base_spec("Ranunculus", "Ranunculus asiaticus", PhysicsArchetype::Delicate,
                "#fb923c", 40, PetalShape::Orbicular, Symmetry::Spiral{divergence_angle:137.5},
                LightPreference::FullSun, WindResponse::Gentle, 0.4, 0.6, 0.6, 0.2, FragranceProfile::Sweet, 0.3, LeafShape::Palmate, false)),

        tpl("Dahlia", "Dahlia pinnata",
            &["Red","Pink","Yellow","Orange","White"], &["Birthday","Thank You"], "Summer-Fall",
            PhysicsArchetype::Bushy,
            base_spec("Dahlia", "Dahlia pinnata", PhysicsArchetype::Bushy,
                "#dc2626", 60, PetalShape::Spatulate, Symmetry::Radial{order:8},
                LightPreference::FullSun, WindResponse::Gentle, 0.5, 0.6, 0.7, 0.3, FragranceProfile::Earthy, 0.6, LeafShape::Pinnate, false)),

        tpl("Sweet Pea", "Lathyrus odoratus",
            &["Pink","White","Lavender"], &["Anniversary","Love & Romance"], "Spring",
            PhysicsArchetype::Delicate,
            base_spec("Sweet Pea", "Lathyrus odoratus", PhysicsArchetype::Delicate,
                "#f0abfc", 5, PetalShape::Ovate, Symmetry::Bilateral,
                LightPreference::FullSun, WindResponse::Dancing, 0.4, 0.5, 0.5, 0.9, FragranceProfile::Sweet, 0.3, LeafShape::Ovate, false)),

        tpl("Gladiolus", "Gladiolus communis",
            &["White","Pink","Red","Yellow","Purple"], &["Anniversary","Thank You"], "Summer",
            PhysicsArchetype::Sturdy,
            base_spec("Gladiolus", "Gladiolus communis", PhysicsArchetype::Sturdy,
                "#ef4444", 12, PetalShape::Ovate, Symmetry::Bilateral,
                LightPreference::FullSun, WindResponse::Rigid, 0.6, 0.5, 0.5, 0.3, FragranceProfile::Sweet, 1.2, LeafShape::Linear, false)),

        tpl("Larkspur", "Consolida ajacis",
            &["Purple","Pink","White"], &["Anniversary","Congratulations"], "Summer",
            PhysicsArchetype::Upright,
            base_spec("Larkspur", "Consolida ajacis", PhysicsArchetype::Upright,
                "#8b5cf6", 8, PetalShape::Spatulate, Symmetry::Bilateral,
                LightPreference::FullSun, WindResponse::Gentle, 0.5, 0.5, 0.6, 0.2, FragranceProfile::Sweet, 0.8, LeafShape::Palmate, false)),

        tpl("Liatris", "Liatris spicata",
            &["Purple"], &["Anniversary","Congratulations"], "Summer",
            PhysicsArchetype::Upright,
            base_spec("Liatris", "Liatris spicata", PhysicsArchetype::Upright,
                "#7c3aed", 30, PetalShape::Fimbriate, Symmetry::Radial{order:5},
                LightPreference::FullSun, WindResponse::Rigid, 0.8, 0.3, 0.8, 0.2, FragranceProfile::Earthy, 0.8, LeafShape::Linear, true)),

        tpl("Bells of Ireland", "Moluccella laevis",
            &["Green"], &["Anniversary","Congratulations"], "Summer",
            PhysicsArchetype::Upright,
            base_spec("Bells of Ireland", "Moluccella laevis", PhysicsArchetype::Upright,
                "#22c55e", 6, PetalShape::Orbicular, Symmetry::Radial{order:6},
                LightPreference::FullSun, WindResponse::Gentle, 0.6, 0.5, 0.3, 0.0, FragranceProfile::Earthy, 0.7, LeafShape::Ovate, false)),

        // ── Accent / Filler flowers ─────────────────────────────────────────

        tpl("Solidago", "Solidago canadensis",
            &["Yellow"], &["Get Well","Thank You"], "Fall",
            PhysicsArchetype::Delicate,
            base_spec("Solidago", "Solidago canadensis", PhysicsArchetype::Delicate,
                "#eab308", 50, PetalShape::Lanceolate, Symmetry::Radial{order:5},
                LightPreference::FullSun, WindResponse::Dancing, 0.8, 0.3, 0.7, 0.1, FragranceProfile::Earthy, 0.5, LeafShape::Lanceolate, true)),

        tpl("Hypericum", "Hypericum androsaemum",
            &["Green","Red","Pink"], &["Birthday","Thank You"], "Summer-Fall",
            PhysicsArchetype::Delicate,
            base_spec("Hypericum", "Hypericum androsaemum", PhysicsArchetype::Delicate,
                "#16a34a", 5, PetalShape::Orbicular, Symmetry::Radial{order:5},
                LightPreference::PartialShade, WindResponse::Gentle, 0.7, 0.5, 0.3, 0.0, FragranceProfile::Earthy, 0.4, LeafShape::Ovate, false)),

        tpl("Statice", "Limonium sinuatum",
            &["Purple","Lavender"], &["Get Well","Thank You"], "Summer",
            PhysicsArchetype::Delicate,
            base_spec("Statice", "Limonium sinuatum", PhysicsArchetype::Delicate,
                "#a78bfa", 30, PetalShape::Spatulate, Symmetry::Radial{order:5},
                LightPreference::FullSun, WindResponse::Rigid, 0.9, 0.2, 0.3, 0.0, FragranceProfile::Earthy, 0.4, LeafShape::Ovate, false)),

        tpl("Waxflower", "Chamelaucium uncinatum",
            &["Pink","White"], &["Anniversary","Thank You"], "Winter-Spring",
            PhysicsArchetype::Delicate,
            base_spec("Waxflower", "Chamelaucium uncinatum", PhysicsArchetype::Delicate,
                "#fda4af", 5, PetalShape::Orbicular, Symmetry::Radial{order:5},
                LightPreference::FullSun, WindResponse::Dancing, 0.8, 0.2, 0.4, 0.4, FragranceProfile::Citrus, 0.3, LeafShape::Acicular, false)),

        tpl("Queen Anne's Lace", "Daucus carota",
            &["White"], &["Anniversary","Thank You"], "Summer",
            PhysicsArchetype::Delicate,
            base_spec("Queen Anne's Lace", "Daucus carota", PhysicsArchetype::Delicate,
                "#fafafa", 100, PetalShape::Spatulate, Symmetry::Radial{order:5},
                LightPreference::FullSun, WindResponse::Dancing, 0.8, 0.3, 0.5, 0.1, FragranceProfile::Earthy, 0.5, LeafShape::Pinnate, false)),

        tpl("Heather", "Calluna vulgaris",
            &["Pink","Purple"], &["Anniversary","Thank You"], "Fall",
            PhysicsArchetype::Delicate,
            base_spec("Heather", "Calluna vulgaris", PhysicsArchetype::Delicate,
                "#c084fc", 20, PetalShape::Tubular, Symmetry::Radial{order:4},
                LightPreference::FullSun, WindResponse::Gentle, 0.9, 0.3, 0.5, 0.3, FragranceProfile::Floral, 0.3, LeafShape::Acicular, true)),

        tpl("Bupleurum", "Bupleurum rotundifolium",
            &["Green"], &["Birthday","Thank You"], "Summer",
            PhysicsArchetype::Delicate,
            base_spec("Bupleurum", "Bupleurum rotundifolium", PhysicsArchetype::Delicate,
                "#4ade80", 5, PetalShape::Orbicular, Symmetry::Radial{order:5},
                LightPreference::FullSun, WindResponse::Dancing, 0.7, 0.3, 0.2, 0.0, FragranceProfile::Earthy, 0.4, LeafShape::Ovate, false)),

        tpl("Yarrow", "Achillea millefolium",
            &["Yellow"], &["Get Well","Thank You"], "Summer",
            PhysicsArchetype::Delicate,
            base_spec("Yarrow", "Achillea millefolium", PhysicsArchetype::Delicate,
                "#fbbf24", 30, PetalShape::Spatulate, Symmetry::Radial{order:5},
                LightPreference::FullSun, WindResponse::Dancing, 0.9, 0.2, 0.7, 0.3, FragranceProfile::Earthy, 0.4, LeafShape::Pinnate, true)),

        tpl("Limonium", "Limonium latifolium",
            &["Lavender","Purple"], &["Get Well","Thank You"], "Summer",
            PhysicsArchetype::Delicate,
            base_spec("Limonium", "Limonium latifolium", PhysicsArchetype::Delicate,
                "#818cf8", 40, PetalShape::Spatulate, Symmetry::Radial{order:5},
                LightPreference::FullSun, WindResponse::Gentle, 0.8, 0.2, 0.3, 0.0, FragranceProfile::Earthy, 0.4, LeafShape::Ovate, false)),

        // ── Spray / Pom types ───────────────────────────────────────────────

        tpl("Spray Rose", "Rosa spray",
            &["Red","White","Pink","Yellow","Orange","Peach"], &["Anniversary","Birthday","Love & Romance","Thank You"], "Year-round",
            PhysicsArchetype::Delicate,
            base_spec("Spray Rose", "Rosa spray", PhysicsArchetype::Delicate,
                "#fb7185", 15, PetalShape::Ovate, Symmetry::Spiral{divergence_angle:137.5},
                LightPreference::FullSun, WindResponse::Gentle, 0.6, 0.5, 0.7, 0.5, FragranceProfile::Floral, 0.4, LeafShape::Ovate, true)),

        tpl("Mini Carnation", "Dianthus caryophyllus mini",
            &["Red","Pink","White","Yellow","Orange"], &["Birthday","Get Well","Thank You"], "Year-round",
            PhysicsArchetype::Delicate,
            base_spec("Mini Carnation", "Dianthus caryophyllus mini", PhysicsArchetype::Delicate,
                "#f472b6", 20, PetalShape::Fimbriate, Symmetry::Radial{order:5},
                LightPreference::FullSun, WindResponse::Dancing, 0.7, 0.4, 0.5, 0.3, FragranceProfile::Spicy, 0.3, LeafShape::Linear, false)),

        tpl("Button Pom", "Chrysanthemum button",
            &["Green","Yellow"], &["Birthday","Thank You"], "Fall",
            PhysicsArchetype::Delicate,
            base_spec("Button Pom", "Chrysanthemum button", PhysicsArchetype::Delicate,
                "#a3e635", 50, PetalShape::Orbicular, Symmetry::Radial{order:8},
                LightPreference::FullSun, WindResponse::Gentle, 0.8, 0.4, 0.4, 0.1, FragranceProfile::Earthy, 0.25, LeafShape::Ovate, false)),

        tpl("Fuji Mum", "Chrysanthemum fuji",
            &["Lavender","Green","White"], &["Anniversary","Thank You"], "Fall",
            PhysicsArchetype::Bushy,
            base_spec("Fuji Mum", "Chrysanthemum fuji", PhysicsArchetype::Bushy,
                "#c4b5fd", 80, PetalShape::Lanceolate, Symmetry::Radial{order:8},
                LightPreference::FullSun, WindResponse::Gentle, 0.7, 0.5, 0.4, 0.2, FragranceProfile::Earthy, 0.5, LeafShape::Ovate, false)),

        tpl("Cushion Pom", "Chrysanthemum cushion",
            &["Yellow","Green","White"], &["Birthday","Thank You"], "Fall",
            PhysicsArchetype::Delicate,
            base_spec("Cushion Pom", "Chrysanthemum cushion", PhysicsArchetype::Delicate,
                "#fde047", 40, PetalShape::Orbicular, Symmetry::Radial{order:5},
                LightPreference::FullSun, WindResponse::Gentle, 0.8, 0.4, 0.4, 0.1, FragranceProfile::Earthy, 0.25, LeafShape::Ovate, false)),

        tpl("Kermit Pom", "Chrysanthemum kermit",
            &["Green"], &["Birthday","Thank You"], "Fall",
            PhysicsArchetype::Delicate,
            base_spec("Kermit Pom", "Chrysanthemum kermit", PhysicsArchetype::Delicate,
                "#4ade80", 40, PetalShape::Orbicular, Symmetry::Radial{order:5},
                LightPreference::FullSun, WindResponse::Gentle, 0.8, 0.4, 0.3, 0.1, FragranceProfile::Earthy, 0.25, LeafShape::Ovate, false)),

        tpl("Spray Mum", "Chrysanthemum spray",
            &["Yellow","White","Lavender","Pink"], &["Birthday","Get Well","Thank You"], "Fall",
            PhysicsArchetype::Delicate,
            base_spec("Spray Mum", "Chrysanthemum spray", PhysicsArchetype::Delicate,
                "#fbbf24", 30, PetalShape::Lanceolate, Symmetry::Radial{order:5},
                LightPreference::FullSun, WindResponse::Gentle, 0.7, 0.4, 0.5, 0.2, FragranceProfile::Earthy, 0.3, LeafShape::Ovate, false)),

        tpl("Matsumoto Aster", "Callistephus chinensis",
            &["Pink","Purple","Lavender","White"], &["Birthday","Thank You"], "Summer-Fall",
            PhysicsArchetype::Delicate,
            base_spec("Matsumoto Aster", "Callistephus chinensis", PhysicsArchetype::Delicate,
                "#d946ef", 21, PetalShape::Lanceolate, Symmetry::Radial{order:21},
                LightPreference::FullSun, WindResponse::Dancing, 0.6, 0.4, 0.5, 0.2, FragranceProfile::Sweet, 0.35, LeafShape::Ovate, false)),

        tpl("Sweet William", "Dianthus barbatus",
            &["Pink","Red","White","Purple"], &["Birthday","Thank You"], "Spring-Summer",
            PhysicsArchetype::Delicate,
            base_spec("Sweet William", "Dianthus barbatus", PhysicsArchetype::Delicate,
                "#e11d48", 5, PetalShape::Orbicular, Symmetry::Radial{order:5},
                LightPreference::FullSun, WindResponse::Gentle, 0.7, 0.4, 0.5, 0.4, FragranceProfile::Spicy, 0.3, LeafShape::Lanceolate, false)),

        tpl("Solidaster", "x Solidaster luteus",
            &["Yellow"], &["Get Well","Thank You"], "Summer-Fall",
            PhysicsArchetype::Delicate,
            base_spec("Solidaster", "x Solidaster luteus", PhysicsArchetype::Delicate,
                "#fde047", 30, PetalShape::Spatulate, Symmetry::Radial{order:5},
                LightPreference::FullSun, WindResponse::Dancing, 0.8, 0.3, 0.6, 0.1, FragranceProfile::Earthy, 0.4, LeafShape::Lanceolate, false)),

        // ── v2 Showcase: flowers that highlight new shapes & stem styles ──

        tpl("Protea", "Protea cynaroides",
            &["Pink","Red","White","Cream"], &["Anniversary","Congratulations"], "Winter-Spring",
            PhysicsArchetype::Sturdy,
            with_aura(textured(styled(
                base_spec("Protea", "Protea cynaroides", PhysicsArchetype::Sturdy,
                    "#be185d", 40, PetalShape::Acuminate, Symmetry::Radial{order:8},
                    LightPreference::FullSun, WindResponse::Rigid, 0.9, 0.3, 0.6, 0.2, FragranceProfile::Earthy, 0.8, LeafShape::Elliptic, false),
                StemStyle::Woody), SurfaceTexture::Leathery),
                AuraKind::Crystal, "#f9a8d4", 0.1)),

        tpl("Bird of Paradise", "Strelitzia reginae",
            &["Orange","Blue","Yellow"], &["Congratulations","Thank You"], "Year-round",
            PhysicsArchetype::Sturdy,
            styled(edged(
                base_spec("Bird of Paradise", "Strelitzia reginae", PhysicsArchetype::Sturdy,
                    "#ea580c", 5, PetalShape::Sagittate, Symmetry::Bilateral,
                    LightPreference::FullSun, WindResponse::Rigid, 0.7, 0.6, 0.8, 0.3, FragranceProfile::Sweet, 1.0, LeafShape::Obovate, false),
                EdgeStyle::Smooth), StemStyle::Arching)),

        tpl("Wisteria", "Wisteria sinensis",
            &["Lavender","White","Pink","Blue"], &["Love & Romance","Anniversary"], "Spring",
            PhysicsArchetype::Delicate,
            with_aura(styled(
                base_spec("Wisteria", "Wisteria sinensis", PhysicsArchetype::Delicate,
                    "#a78bfa", 12, PetalShape::Ovate, Symmetry::Bilateral,
                    LightPreference::FullSun, WindResponse::Dancing, 0.6, 0.5, 0.7, 0.9, FragranceProfile::Sweet, 0.6, LeafShape::Pinnate, true),
                StemStyle::Trailing),
                AuraKind::Ethereal, "#c4b5fd", 0.12)),

        tpl("Lotus", "Nelumbo nucifera",
            &["Pink","White","Yellow"], &["Anniversary","Sympathy"], "Summer",
            PhysicsArchetype::Bushy,
            with_aura(textured(
                base_spec("Lotus", "Nelumbo nucifera", PhysicsArchetype::Bushy,
                    "#fda4af", 20, PetalShape::Flabellate, Symmetry::Spiral{divergence_angle:137.5},
                    LightPreference::FullSun, WindResponse::Gentle, 0.5, 0.9, 0.7, 0.8, FragranceProfile::Aquatic, 0.4, LeafShape::Peltate, true),
                SurfaceTexture::Waxy),
                AuraKind::Moonlight, "#fecdd3", 0.15)),

        tpl("Passionflower", "Passiflora incarnata",
            &["Purple","White","Blue"], &["Love & Romance","Anniversary"], "Summer",
            PhysicsArchetype::Delicate,
            with_aura(styled(
                base_spec("Passionflower", "Passiflora incarnata", PhysicsArchetype::Delicate,
                    "#7c3aed", 30, PetalShape::Filiform, Symmetry::Radial{order:5},
                    LightPreference::PartialShade, WindResponse::Dancing, 0.6, 0.7, 0.8, 0.4, FragranceProfile::Sweet, 0.4, LeafShape::Palmate, true),
                StemStyle::Twining),
                AuraKind::Prismatic, "#c4b5fd", 0.18)),

        tpl("Heliconia", "Heliconia rostrata",
            &["Red","Orange","Yellow","Green"], &["Birthday","Thank You"], "Year-round",
            PhysicsArchetype::Sturdy,
            styled(textured(
                base_spec("Heliconia", "Heliconia rostrata", PhysicsArchetype::Sturdy,
                    "#dc2626", 8, PetalShape::Cuneate, Symmetry::Bilateral,
                    LightPreference::PartialShade, WindResponse::Rigid, 0.6, 0.8, 0.6, 0.3, FragranceProfile::Green, 1.2, LeafShape::Obovate, false),
                SurfaceTexture::Waxy), StemStyle::Succulent)),

        tpl("Bleeding Heart", "Lamprocapnos spectabilis",
            &["Pink","White","Red"], &["Love & Romance","Anniversary"], "Spring",
            PhysicsArchetype::Delicate,
            styled(
                base_spec("Bleeding Heart", "Lamprocapnos spectabilis", PhysicsArchetype::Delicate,
                    "#f472b6", 6, PetalShape::Panduriform, Symmetry::Bilateral,
                    LightPreference::PartialShade, WindResponse::Dancing, 0.4, 0.6, 0.5, 0.2, FragranceProfile::Sweet, 0.5, LeafShape::Pinnate, false),
                StemStyle::Arching)),

        tpl("Plumeria", "Plumeria rubra",
            &["White","Pink","Yellow","Red"], &["Love & Romance","Anniversary"], "Summer",
            PhysicsArchetype::Upright,
            with_aura(textured(styled(
                base_spec("Plumeria", "Plumeria rubra", PhysicsArchetype::Upright,
                    "#fef3c7", 5, PetalShape::Obovate, Symmetry::Spiral{divergence_angle:72.0},
                    LightPreference::FullSun, WindResponse::Gentle, 0.5, 0.5, 0.8, 0.9, FragranceProfile::Sweet, 0.6, LeafShape::Oblanceolate, false),
                StemStyle::Woody), SurfaceTexture::Pearlescent),
                AuraKind::Moonlight, "#fef9c3", 0.1)),

        tpl("Thistle", "Cirsium vulgare",
            &["Purple","Pink","White"], &["Get Well","Thank You"], "Summer-Fall",
            PhysicsArchetype::Sturdy,
            edged(styled(
                base_spec("Thistle", "Cirsium vulgare", PhysicsArchetype::Sturdy,
                    "#9333ea", 60, PetalShape::Filiform, Symmetry::Radial{order:8},
                    LightPreference::FullSun, WindResponse::Rigid, 0.9, 0.2, 0.4, 0.1, FragranceProfile::Earthy, 0.7, LeafShape::Lanceolate, false),
                StemStyle::Straight), EdgeStyle::Dentate)),

        tpl("Clematis", "Clematis montana",
            &["White","Pink","Purple","Blue"], &["Birthday","Thank You"], "Spring-Summer",
            PhysicsArchetype::Delicate,
            styled(
                base_spec("Clematis", "Clematis montana", PhysicsArchetype::Delicate,
                    "#e9d5ff", 4, PetalShape::Ovate, Symmetry::Radial{order:4},
                    LightPreference::PartialShade, WindResponse::Dancing, 0.6, 0.5, 0.6, 0.3, FragranceProfile::Sweet, 0.4, LeafShape::Cordate, true),
                StemStyle::Twining)),

        tpl("Kangaroo Paw", "Anigozanthos flavidus",
            &["Red","Yellow","Green","Orange"], &["Birthday","Congratulations"], "Spring-Summer",
            PhysicsArchetype::Upright,
            styled(textured(
                base_spec("Kangaroo Paw", "Anigozanthos flavidus", PhysicsArchetype::Upright,
                    "#dc2626", 6, PetalShape::Filiform, Symmetry::Bilateral,
                    LightPreference::FullSun, WindResponse::Gentle, 0.7, 0.3, 0.5, 0.0, FragranceProfile::Earthy, 0.7, LeafShape::Linear, false),
                SurfaceTexture::Fuzzy), StemStyle::Succulent)),

        tpl("Japanese Anemone", "Anemone hupehensis",
            &["Pink","White","Magenta"], &["Anniversary","Thank You"], "Fall",
            PhysicsArchetype::Delicate,
            styled(
                base_spec("Japanese Anemone", "Anemone hupehensis", PhysicsArchetype::Delicate,
                    "#f9a8d4", 8, PetalShape::Orbicular, Symmetry::Radial{order:8},
                    LightPreference::PartialShade, WindResponse::Dancing, 0.6, 0.5, 0.5, 0.2, FragranceProfile::Sweet, 0.5, LeafShape::Palmate, false),
                StemStyle::Sinuous)),

        tpl("Foxglove", "Digitalis purpurea",
            &["Purple","Pink","White","Yellow"], &["Get Well","Thank You"], "Summer",
            PhysicsArchetype::Upright,
            styled(
                base_spec("Foxglove", "Digitalis purpurea", PhysicsArchetype::Upright,
                    "#a855f7", 20, PetalShape::Unguiculate, Symmetry::Bilateral,
                    LightPreference::PartialShade, WindResponse::Gentle, 0.5, 0.6, 0.7, 0.3, FragranceProfile::Medicinal, 0.9, LeafShape::Oblanceolate, false),
                StemStyle::Straight)),

        tpl("Calla Lily", "Zantedeschia aethiopica",
            &["White","Yellow","Pink","Purple","Black"], &["Anniversary","Sympathy","Love & Romance"], "Spring-Summer",
            PhysicsArchetype::Upright,
            with_aura(textured(styled(
                base_spec("Calla Lily", "Zantedeschia aethiopica", PhysicsArchetype::Upright,
                    "#fafafa", 1, PetalShape::Unguiculate, Symmetry::Bilateral,
                    LightPreference::PartialShade, WindResponse::Gentle, 0.5, 0.7, 0.7, 0.6, FragranceProfile::Floral, 0.7, LeafShape::Sagittate, false),
                StemStyle::Sinuous), SurfaceTexture::Waxy),
                AuraKind::Ethereal, "#e2e8f0", 0.1)),

        tpl("Bromeliad", "Guzmania lingulata",
            &["Red","Orange","Yellow","Pink"], &["Birthday","Thank You"], "Year-round",
            PhysicsArchetype::Bushy,
            styled(textured(
                base_spec("Bromeliad", "Guzmania lingulata", PhysicsArchetype::Bushy,
                    "#ef4444", 12, PetalShape::Rhomboid, Symmetry::Radial{order:6},
                    LightPreference::PartialShade, WindResponse::Rigid, 0.7, 0.7, 0.4, 0.0, FragranceProfile::Green, 0.3, LeafShape::Linear, false),
                SurfaceTexture::Metallic), StemStyle::Succulent)),
    ]
}
