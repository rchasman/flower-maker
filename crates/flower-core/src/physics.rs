use crate::catalog::FlowerSpec;

#[derive(Debug, Clone, Copy)]
enum PhysicsArchetype {
    Upright,  // tall, rigid stem — rose, tulip, iris
    Bushy,    // wide, heavy — hydrangea, peony
    Delicate, // light, fluttery — daisy, freesia
    Sturdy,   // heavy, dominant — sunflower, protea
}

impl PhysicsArchetype {
    fn from_stem(spec: &FlowerSpec) -> Self {
        let is_heavy = spec.structure.stem.thickness > 0.4;
        let is_tall = spec.structure.stem.height > 0.8;
        match (is_heavy, is_tall) {
            (true, true) => Self::Sturdy,
            (true, false) => Self::Bushy,
            (false, true) => Self::Upright,
            (false, false) => Self::Delicate,
        }
    }

    fn mass(&self) -> f64 {
        match self {
            Self::Upright => 1.0,
            Self::Bushy => 1.5,
            Self::Delicate => 0.5,
            Self::Sturdy => 2.0,
        }
    }

    fn collider_radius(&self) -> f64 {
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

/// Rigid body parameters for a flower: (collider radius in px, mass).
/// The stem sets the archetype, extra inflorescence heads grow both.
pub fn body_params(spec: &FlowerSpec) -> (f32, f32) {
    let archetype = PhysicsArchetype::from_stem(spec);
    let extra_heads = spec.inflorescence.head_count.saturating_sub(1) as f64;
    let radius_scale = (1.0 + 0.15 * extra_heads).min(2.5);
    let mass_scale = (1.0 + 0.1 * extra_heads).min(3.0);
    (
        (archetype.collider_radius() * radius_scale) as f32,
        (archetype.mass() * mass_scale) as f32,
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::catalog::{Inflorescence, InflorescenceKind};

    fn with_heads(head_count: u32) -> FlowerSpec {
        FlowerSpec {
            inflorescence: Inflorescence {
                kind: InflorescenceKind::Spray,
                head_count,
                ..Inflorescence::default()
            },
            ..FlowerSpec::default()
        }
    }

    #[test]
    fn seven_head_spray_gets_a_larger_body_than_one_head() {
        let (single_radius, single_mass) = body_params(&with_heads(1));
        let (spray_radius, spray_mass) = body_params(&with_heads(7));
        assert!(spray_radius > single_radius, "{spray_radius} <= {single_radius}");
        assert!(spray_mass > single_mass, "{spray_mass} <= {single_mass}");
        assert!((spray_radius - single_radius * 1.9).abs() < 1e-4);
        assert!((spray_mass - single_mass * 1.6).abs() < 1e-4);
    }

    #[test]
    fn head_scaling_is_capped() {
        let (single_radius, single_mass) = body_params(&with_heads(1));
        let (many_radius, many_mass) = body_params(&with_heads(100));
        assert!((many_radius - single_radius * 2.5).abs() < 1e-4);
        assert!((many_mass - single_mass * 3.0).abs() < 1e-4);
    }
}
