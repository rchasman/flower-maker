use std::cell::Cell;
use crate::catalog::*;

/// Cross two flower specs to produce offspring. Deterministic given a seed.
pub fn cross(parent_a: &FlowerSpec, parent_b: &FlowerSpec, seed: u64) -> FlowerSpec {
    // Simple deterministic PRNG (Cell for interior mutability so multiple closures can share)
    let rng = Cell::new(seed);
    let next = || -> f64 {
        let v = rng.get().wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
        rng.set(v);
        (v >> 33) as f64 / (1u64 << 31) as f64
    };

    let pick_color = |a: &Color, b: &Color| -> Color {
        let t = next();
        Color {
            r: a.r * (1.0 - t) + b.r * t,
            g: a.g * (1.0 - t) + b.g * t,
            b: a.b * (1.0 - t) + b.b * t,
            a: 1.0,
        }
    };

    let pick_f64 = |a: f64, b: f64| -> f64 {
        let t = next();
        a * (1.0 - t) + b * t
    };

    let pick_head_count = |a: u32, b: u32| -> u32 {
        (pick_f64(a as f64, b as f64).round() as u32).max(1)
    };

    // Petals and taxonomy come from the same parent so the child's family agrees with its petals.
    let petal_parent = if next() > 0.5 { parent_a } else { parent_b };
    let symmetry_parent = if next() > 0.5 { parent_a } else { parent_b };

    FlowerSpec {
        name: format!("{} × {}", parent_a.name, parent_b.name),
        species: if next() > 0.5 { parent_a.species.clone() } else { parent_b.species.clone() },
        taxonomy: petal_parent.taxonomy.clone(),
        petals: PetalSystem {
            layers: petal_parent.petals.layers.clone(),
            bloom_progress: 0.0,
            wilt_progress: 0.0,
            symmetry: symmetry_parent.petals.symmetry.clone(),
            symmetry_order: symmetry_parent.petals.symmetry_order,
            divergence_angle: symmetry_parent.petals.divergence_angle,
            stage: LifeStage::Bloom,
        },
        reproductive: if next() > 0.5 { parent_a.reproductive.clone() } else { parent_b.reproductive.clone() },
        structure: StructureSystem {
            stem: Stem {
                height: pick_f64(parent_a.structure.stem.height, parent_b.structure.stem.height),
                thickness: pick_f64(parent_a.structure.stem.thickness, parent_b.structure.stem.thickness),
                curvature: pick_f64(parent_a.structure.stem.curvature, parent_b.structure.stem.curvature),
                color: pick_color(&parent_a.structure.stem.color, &parent_b.structure.stem.color),
                thorns: if next() > 0.5 { parent_a.structure.stem.thorns.clone() } else { parent_b.structure.stem.thorns.clone() },
                internode_length: pick_f64(parent_a.structure.stem.internode_length, parent_b.structure.stem.internode_length),
                surface: if next() > 0.5 { parent_a.structure.stem.surface.clone() } else { parent_b.structure.stem.surface.clone() },
                branching: if next() > 0.5 { parent_a.structure.stem.branching.clone() } else { parent_b.structure.stem.branching.clone() },
                style: if next() > 0.5 { parent_a.structure.stem.style.clone() } else { parent_b.structure.stem.style.clone() },
            },
            sepals: if next() > 0.5 { parent_a.structure.sepals.clone() } else { parent_b.structure.sepals.clone() },
            receptacle: if next() > 0.5 { parent_a.structure.receptacle.clone() } else { parent_b.structure.receptacle.clone() },
            peduncle: Peduncle {
                length: pick_f64(parent_a.structure.peduncle.length, parent_b.structure.peduncle.length),
                angle: pick_f64(parent_a.structure.peduncle.angle, parent_b.structure.peduncle.angle),
                flexibility: pick_f64(parent_a.structure.peduncle.flexibility, parent_b.structure.peduncle.flexibility),
                color: pick_color(&parent_a.structure.peduncle.color, &parent_b.structure.peduncle.color),
            },
            buds: if next() > 0.5 { parent_a.structure.buds.clone() } else { parent_b.structure.buds.clone() },
        },
        foliage: if next() > 0.5 { parent_a.foliage.clone() } else { parent_b.foliage.clone() },
        ornamentation: if next() > 0.5 { parent_a.ornamentation.clone() } else { parent_b.ornamentation.clone() },
        roots: RootSystem {
            pattern: if next() > 0.5 { parent_a.roots.pattern.clone() } else { parent_b.roots.pattern.clone() },
            depth: pick_f64(parent_a.roots.depth, parent_b.roots.depth),
            spread: pick_f64(parent_a.roots.spread, parent_b.roots.spread),
            thickness: pick_f64(parent_a.roots.thickness, parent_b.roots.thickness),
            color: pick_color(&parent_a.roots.color, &parent_b.roots.color),
            luminescence: if next() > 0.5 { parent_a.roots.luminescence.clone() } else { parent_b.roots.luminescence.clone() },
            mycorrhizal: parent_a.roots.mycorrhizal || parent_b.roots.mycorrhizal,
        },
        aura: match (next() > 0.3, &parent_a.aura, &parent_b.aura) {
            (_, Some(a), Some(b)) => Some(Aura {
                kind: if next() > 0.5 { a.kind.clone() } else { b.kind.clone() },
                color: pick_color(&a.color, &b.color),
                opacity: pick_f64(a.opacity, b.opacity),
                radius: pick_f64(a.radius, b.radius),
                animation_speed: pick_f64(a.animation_speed, b.animation_speed),
            }),
            (true, Some(a), None) => Some(a.clone()),
            (true, None, Some(b)) => Some(b.clone()),
            _ => None,
        },
        personality: FlowerPersonality {
            growth_speed: pick_f64(parent_a.personality.growth_speed, parent_b.personality.growth_speed),
            hardiness: pick_f64(parent_a.personality.hardiness, parent_b.personality.hardiness),
            sociability: pick_f64(parent_a.personality.sociability, parent_b.personality.sociability),
            light_preference: if next() > 0.5 { parent_a.personality.light_preference.clone() } else { parent_b.personality.light_preference.clone() },
            water_need: pick_f64(parent_a.personality.water_need, parent_b.personality.water_need),
            wind_response: if next() > 0.5 { parent_a.personality.wind_response.clone() } else { parent_b.personality.wind_response.clone() },
            pollinator_attraction: pick_f64(parent_a.personality.pollinator_attraction, parent_b.personality.pollinator_attraction),
            fragrance: if next() > 0.5 { parent_a.personality.fragrance.clone() } else { parent_b.personality.fragrance.clone() },
        },
        inflorescence: Inflorescence {
            kind: if next() > 0.5 { parent_a.inflorescence.kind.clone() } else { parent_b.inflorescence.kind.clone() },
            head_count: pick_head_count(parent_a.inflorescence.head_count, parent_b.inflorescence.head_count),
            head_scale: pick_f64(parent_a.inflorescence.head_scale, parent_b.inflorescence.head_scale),
            spread: pick_f64(parent_a.inflorescence.spread, parent_b.inflorescence.spread),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parent(family: FlowerFamily, petal_count: u32, head_count: u32) -> FlowerSpec {
        FlowerSpec {
            taxonomy: Taxonomy { family, ..Taxonomy::default() },
            petals: PetalSystem {
                layers: vec![PetalLayer { count: petal_count, ..PetalLayer::default() }],
                ..PetalSystem::default()
            },
            inflorescence: Inflorescence { head_count, ..Inflorescence::default() },
            ..FlowerSpec::default()
        }
    }

    #[test]
    fn child_family_follows_the_parent_that_gave_its_petals() {
        let iris = parent(FlowerFamily::Iridaceae, 3, 1);
        let rose = parent(FlowerFamily::Rosaceae, 5, 1);

        (0..64u64).for_each(|seed| {
            let child = cross(&iris, &rose, seed);
            let petal_count = child.petals.layers[0].count;
            let family_matches_petals = match petal_count {
                3 => matches!(child.taxonomy.family, FlowerFamily::Iridaceae),
                5 => matches!(child.taxonomy.family, FlowerFamily::Rosaceae),
                _ => false,
            };
            assert!(
                family_matches_petals,
                "seed {seed}: petals from count-{petal_count} parent but family {:?}",
                child.taxonomy.family
            );
        });
    }

    #[test]
    fn child_stage_is_bloom_and_head_count_stays_at_least_one() {
        let bud = FlowerSpec {
            petals: PetalSystem { stage: LifeStage::Bud, ..PetalSystem::default() },
            ..parent(FlowerFamily::Invented, 4, 1)
        };
        let spray = parent(FlowerFamily::Asteraceae, 8, 7);

        (0..32u64).for_each(|seed| {
            let child = cross(&bud, &spray, seed);
            assert!(matches!(child.petals.stage, LifeStage::Bloom));
            assert!((1..=7).contains(&child.inflorescence.head_count), "seed {seed}: {}", child.inflorescence.head_count);
        });
    }
}
