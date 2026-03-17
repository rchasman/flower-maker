use crate::catalog::*;
use crate::templates::{FlowerTemplate, PhysicsArchetype};

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

/// Returns all 41 extended templates (beyond the initial 5).
pub fn extended_templates() -> Vec<FlowerTemplate> {
    vec![
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

        // ── Accent / Filler flowers ──────────────────────────────────────

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

        // ── Spray / Pom types ────────────────────────────────────────────

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
    ]
}
