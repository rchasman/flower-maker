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
        match self {
            Self::Upright => 0.4,
            Self::Bushy => 0.7,
            Self::Delicate => 0.3,
            Self::Sturdy => 0.6,
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

/// Returns the initial 5 flower templates. Expand to 50+ later.
pub fn all_templates() -> Vec<FlowerTemplate> {
    vec![rose(), sunflower(), daisy(), orchid(), tulip()]
}
