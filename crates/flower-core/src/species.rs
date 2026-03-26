use crate::catalog::*;

/// Canonical parameter constraints for a botanical family.
/// Used to validate/constrain AI-generated FlowerSpecs.
pub struct FamilyProfile {
    pub family: FlowerFamily,
    pub petal_count: (u32, u32),          // (min, max) per layer
    pub typical_layer_count: (u32, u32),  // (min, max) layers
    pub typical_shapes: Vec<PetalShape>,
    pub typical_arrangement: PetalArrangement,
    pub symmetry: Symmetry,
    pub typical_edge_styles: Vec<EdgeStyle>,
    pub typical_textures: Vec<SurfaceTexture>,
    pub stamen_count: (u32, u32),
    pub has_prominent_disc: bool,
    pub sepal_count: (u32, u32),
    pub typical_vein_pattern: VeinPattern,
    pub botanical_class: BotanicalClass,
    pub description: &'static str,        // for AI prompts
}

pub fn family_profile(family: &FlowerFamily) -> FamilyProfile {
    match family {
        FlowerFamily::Rosaceae => FamilyProfile {
            family: FlowerFamily::Rosaceae,
            petal_count: (5, 60),
            typical_layer_count: (1, 8),
            typical_shapes: vec![PetalShape::Orbicular, PetalShape::Obovate, PetalShape::Cordate],
            typical_arrangement: PetalArrangement::Spiral,
            symmetry: Symmetry::Radial { order: 5 },
            typical_edge_styles: vec![EdgeStyle::Smooth, EdgeStyle::Ruffled, EdgeStyle::Undulate],
            typical_textures: vec![SurfaceTexture::Silk, SurfaceTexture::Velvet],
            stamen_count: (10, 50),
            has_prominent_disc: false,
            sepal_count: (5, 5),
            typical_vein_pattern: VeinPattern::Branching,
            botanical_class: BotanicalClass::Dicot,
            description: "Rose family. 5-based petal symmetry, many stamens, spiral arrangement in cultivated varieties. Petals are broad, often orbicular or obovate with smooth to ruffled edges.",
        },
        FlowerFamily::Asteraceae => FamilyProfile {
            family: FlowerFamily::Asteraceae,
            petal_count: (5, 34),
            typical_layer_count: (1, 3),
            typical_shapes: vec![PetalShape::Ligulate, PetalShape::Lanceolate, PetalShape::Tubular],
            typical_arrangement: PetalArrangement::Radial,
            symmetry: Symmetry::Radial { order: 0 },
            typical_edge_styles: vec![EdgeStyle::Smooth, EdgeStyle::Dentate],
            typical_textures: vec![SurfaceTexture::Smooth, SurfaceTexture::Velvet],
            stamen_count: (0, 5),
            has_prominent_disc: true,
            sepal_count: (0, 0),
            typical_vein_pattern: VeinPattern::Parallel,
            botanical_class: BotanicalClass::Dicot,
            description: "Daisy/sunflower family. Composite heads with outer ray florets (ligulate) and inner disc florets (tubular). Prominent central disc. Radial symmetry.",
        },
        FlowerFamily::Orchidaceae => FamilyProfile {
            family: FlowerFamily::Orchidaceae,
            petal_count: (3, 6),
            typical_layer_count: (1, 2),
            typical_shapes: vec![PetalShape::Ovate, PetalShape::Spatulate, PetalShape::Flabellate],
            typical_arrangement: PetalArrangement::Bilateral,
            symmetry: Symmetry::Bilateral,
            typical_edge_styles: vec![EdgeStyle::Ruffled, EdgeStyle::Fringed, EdgeStyle::Undulate],
            typical_textures: vec![SurfaceTexture::Waxy, SurfaceTexture::Silk, SurfaceTexture::Velvet],
            stamen_count: (1, 2),
            has_prominent_disc: false,
            sepal_count: (3, 3),
            typical_vein_pattern: VeinPattern::Parallel,
            botanical_class: BotanicalClass::Monocot,
            description: "Orchid family. Bilateral symmetry with 3 sepals and 3 petals (one modified into a labellum/lip). Often waxy, elaborately ruffled or fringed. Few stamens.",
        },
        FlowerFamily::Liliaceae => FamilyProfile {
            family: FlowerFamily::Liliaceae,
            petal_count: (6, 6),
            typical_layer_count: (1, 2),
            typical_shapes: vec![PetalShape::Lanceolate, PetalShape::Ovate, PetalShape::Spatulate],
            typical_arrangement: PetalArrangement::Radial,
            symmetry: Symmetry::Radial { order: 3 },
            typical_edge_styles: vec![EdgeStyle::Smooth, EdgeStyle::Rolled],
            typical_textures: vec![SurfaceTexture::Waxy, SurfaceTexture::Smooth],
            stamen_count: (6, 6),
            has_prominent_disc: false,
            sepal_count: (0, 0),
            typical_vein_pattern: VeinPattern::Parallel,
            botanical_class: BotanicalClass::Monocot,
            description: "Lily family. 6 tepals in 2 whorls of 3, radial 3-fold symmetry. 6 prominent stamens. Tepals often recurved. Parallel venation (monocot).",
        },
        FlowerFamily::Fabaceae => FamilyProfile {
            family: FlowerFamily::Fabaceae,
            petal_count: (5, 5),
            typical_layer_count: (1, 1),
            typical_shapes: vec![PetalShape::Obovate, PetalShape::Ovate, PetalShape::Unguiculate],
            typical_arrangement: PetalArrangement::Papilionaceous,
            symmetry: Symmetry::Bilateral,
            typical_edge_styles: vec![EdgeStyle::Smooth, EdgeStyle::Rolled],
            typical_textures: vec![SurfaceTexture::Smooth, SurfaceTexture::Silk],
            stamen_count: (10, 10),
            has_prominent_disc: false,
            sepal_count: (5, 5),
            typical_vein_pattern: VeinPattern::Branching,
            botanical_class: BotanicalClass::Dicot,
            description: "Pea/bean family. Butterfly-like (papilionaceous): 1 large banner petal, 2 wing petals, 2 keel petals. Bilateral symmetry. 10 stamens.",
        },
        FlowerFamily::Papaveraceae => FamilyProfile {
            family: FlowerFamily::Papaveraceae,
            petal_count: (4, 6),
            typical_layer_count: (1, 2),
            typical_shapes: vec![PetalShape::Orbicular, PetalShape::Obovate, PetalShape::Flabellate],
            typical_arrangement: PetalArrangement::Radial,
            symmetry: Symmetry::Radial { order: 4 },
            typical_edge_styles: vec![EdgeStyle::Ruffled, EdgeStyle::Crisped, EdgeStyle::Undulate],
            typical_textures: vec![SurfaceTexture::Papery, SurfaceTexture::Silk],
            stamen_count: (20, 50),
            has_prominent_disc: true,
            sepal_count: (2, 2),
            typical_vein_pattern: VeinPattern::Branching,
            botanical_class: BotanicalClass::Dicot,
            description: "Poppy family. 4-6 large, crinkled papery petals. Prominent dark central disc with many stamens. Delicate, tissue-paper texture. Often bold colors.",
        },
        FlowerFamily::Ranunculaceae => FamilyProfile {
            family: FlowerFamily::Ranunculaceae,
            petal_count: (5, 20),
            typical_layer_count: (1, 5),
            typical_shapes: vec![PetalShape::Orbicular, PetalShape::Ovate, PetalShape::Spatulate],
            typical_arrangement: PetalArrangement::Spiral,
            symmetry: Symmetry::Radial { order: 5 },
            typical_edge_styles: vec![EdgeStyle::Smooth, EdgeStyle::Ruffled],
            typical_textures: vec![SurfaceTexture::Glassy, SurfaceTexture::Waxy, SurfaceTexture::Silk],
            stamen_count: (10, 100),
            has_prominent_disc: false,
            sepal_count: (5, 8),
            typical_vein_pattern: VeinPattern::Branching,
            botanical_class: BotanicalClass::Dicot,
            description: "Buttercup/anemone family. Variable petal count, often many stamens. Simple open structure. Some species (ranunculus) have many layers. Petals often glossy/waxy.",
        },
        FlowerFamily::Iridaceae => FamilyProfile {
            family: FlowerFamily::Iridaceae,
            petal_count: (6, 6),
            typical_layer_count: (1, 2),
            typical_shapes: vec![PetalShape::Spatulate, PetalShape::Obovate, PetalShape::Flabellate],
            typical_arrangement: PetalArrangement::Radial,
            symmetry: Symmetry::Radial { order: 3 },
            typical_edge_styles: vec![EdgeStyle::Ruffled, EdgeStyle::Undulate, EdgeStyle::Fringed],
            typical_textures: vec![SurfaceTexture::Silk, SurfaceTexture::Velvet],
            stamen_count: (3, 3),
            has_prominent_disc: false,
            sepal_count: (3, 3),
            typical_vein_pattern: VeinPattern::Parallel,
            botanical_class: BotanicalClass::Monocot,
            description: "Iris family. 3 standards (upright) + 3 falls (drooping), often with beard/crest on falls. 3-fold symmetry. Ruffled, elegant petals.",
        },
        FlowerFamily::Malvaceae => FamilyProfile {
            family: FlowerFamily::Malvaceae,
            petal_count: (5, 5),
            typical_layer_count: (1, 2),
            typical_shapes: vec![PetalShape::Obovate, PetalShape::Flabellate, PetalShape::Orbicular],
            typical_arrangement: PetalArrangement::Radial,
            symmetry: Symmetry::Radial { order: 5 },
            typical_edge_styles: vec![EdgeStyle::Ruffled, EdgeStyle::Undulate, EdgeStyle::Crisped],
            typical_textures: vec![SurfaceTexture::Silk, SurfaceTexture::Velvet, SurfaceTexture::Papery],
            stamen_count: (20, 100),
            has_prominent_disc: false,
            sepal_count: (5, 5),
            typical_vein_pattern: VeinPattern::Branching,
            botanical_class: BotanicalClass::Dicot,
            description: "Hibiscus/hollyhock family. 5 large, often ruffled petals. Stamens fused into a prominent central column. Funnel or trumpet shape common.",
        },
        FlowerFamily::Caryophyllaceae => FamilyProfile {
            family: FlowerFamily::Caryophyllaceae,
            petal_count: (5, 5),
            typical_layer_count: (1, 6),
            typical_shapes: vec![PetalShape::Unguiculate, PetalShape::Obovate, PetalShape::Spatulate],
            typical_arrangement: PetalArrangement::Radial,
            symmetry: Symmetry::Radial { order: 5 },
            typical_edge_styles: vec![EdgeStyle::Fringed, EdgeStyle::Serrated, EdgeStyle::Ruffled],
            typical_textures: vec![SurfaceTexture::Velvet, SurfaceTexture::Silk],
            stamen_count: (5, 10),
            has_prominent_disc: false,
            sepal_count: (5, 5),
            typical_vein_pattern: VeinPattern::Branching,
            botanical_class: BotanicalClass::Dicot,
            description: "Carnation/pink family. 5 petals, often deeply notched or fringed. Narrow clawed base (unguiculate). Many cultivated layers in carnations. Radial symmetry.",
        },
        FlowerFamily::Convolvulaceae => FamilyProfile {
            family: FlowerFamily::Convolvulaceae,
            petal_count: (5, 5),
            typical_layer_count: (1, 1),
            typical_shapes: vec![PetalShape::Tubular, PetalShape::Flabellate],
            typical_arrangement: PetalArrangement::Radial,
            symmetry: Symmetry::Radial { order: 5 },
            typical_edge_styles: vec![EdgeStyle::Smooth, EdgeStyle::Undulate],
            typical_textures: vec![SurfaceTexture::Silk, SurfaceTexture::Smooth],
            stamen_count: (5, 5),
            has_prominent_disc: false,
            sepal_count: (5, 5),
            typical_vein_pattern: VeinPattern::Branching,
            botanical_class: BotanicalClass::Dicot,
            description: "Morning glory family. 5 fused petals forming a funnel or trumpet shape. Radial symmetry with 5-pointed star outline. Often vivid colors with white throat.",
        },
        FlowerFamily::Solanaceae => FamilyProfile {
            family: FlowerFamily::Solanaceae,
            petal_count: (5, 5),
            typical_layer_count: (1, 2),
            typical_shapes: vec![PetalShape::Tubular, PetalShape::Ovate, PetalShape::Orbicular],
            typical_arrangement: PetalArrangement::Radial,
            symmetry: Symmetry::Radial { order: 5 },
            typical_edge_styles: vec![EdgeStyle::Smooth, EdgeStyle::Undulate, EdgeStyle::Ruffled],
            typical_textures: vec![SurfaceTexture::Velvet, SurfaceTexture::Silk, SurfaceTexture::Smooth],
            stamen_count: (5, 5),
            has_prominent_disc: false,
            sepal_count: (5, 5),
            typical_vein_pattern: VeinPattern::Branching,
            botanical_class: BotanicalClass::Dicot,
            description: "Nightshade/petunia family. 5 fused petals, often tubular or funnel-shaped. 5 stamens alternating with petal lobes. Prominent veining. Radial symmetry.",
        },
        // Default for families without specific profiles
        _ => FamilyProfile {
            family: family.clone(),
            petal_count: (4, 12),
            typical_layer_count: (1, 3),
            typical_shapes: vec![PetalShape::Ovate, PetalShape::Obovate],
            typical_arrangement: PetalArrangement::Radial,
            symmetry: Symmetry::Radial { order: 5 },
            typical_edge_styles: vec![EdgeStyle::Smooth],
            typical_textures: vec![SurfaceTexture::Smooth],
            stamen_count: (4, 10),
            has_prominent_disc: false,
            sepal_count: (4, 5),
            typical_vein_pattern: VeinPattern::Branching,
            botanical_class: BotanicalClass::Dicot,
            description: "Generic flowering plant. Moderate petal count, radial symmetry.",
        },
    }
}

/// Validate a FlowerSpec against its family profile. Returns list of deviations.
pub fn validate_spec(spec: &FlowerSpec) -> Vec<String> {
    let profile = family_profile(&spec.taxonomy.family);
    let mut issues = Vec::new();

    if let Some(layer) = spec.petals.layers.first() {
        if layer.count < profile.petal_count.0 || layer.count > profile.petal_count.1 {
            issues.push(format!(
                "Petal count {} outside typical range {:?} for {:?}",
                layer.count, profile.petal_count, profile.family
            ));
        }
    }

    if spec.petals.layers.len() < profile.typical_layer_count.0 as usize
        || spec.petals.layers.len() > profile.typical_layer_count.1 as usize
    {
        issues.push(format!(
            "Layer count {} outside typical range {:?} for {:?}",
            spec.petals.layers.len(),
            profile.typical_layer_count,
            profile.family
        ));
    }

    issues
}
