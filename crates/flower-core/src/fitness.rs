use crate::catalog::*;
use crate::environment::Environment;

/// Evaluate how well a FlowerSpec is adapted to an Environment.
/// Returns a score 0.0–100.0. Higher = better adapted.
pub fn evaluate(spec: &FlowerSpec, env: &Environment) -> f64 {
    let mut score = 0.0;

    // ── Light preference (20 pts max) ──────────────────────────────────
    score += match &spec.personality.light_preference {
        LightPreference::FullSun if env.light > 0.7 => 20.0,
        LightPreference::FullSun => 20.0 * env.light,
        LightPreference::PartialShade if (0.3..=0.7).contains(&env.light) => 20.0,
        LightPreference::PartialShade => 10.0,
        LightPreference::FullShade if env.light < 0.3 => 20.0,
        LightPreference::FullShade => 20.0 * (1.0 - env.light),
        LightPreference::Nocturnal if env.light < 0.15 => 20.0,
        LightPreference::Nocturnal => 5.0,
        LightPreference::Dappled if (0.3..=0.6).contains(&env.light) => 20.0,
        LightPreference::Dappled => 12.0,
        LightPreference::Dawn if env.light < 0.5 => 18.0,
        LightPreference::Dawn => 10.0,
        LightPreference::Twilight if (0.15..=0.4).contains(&env.light) => 20.0,
        LightPreference::Twilight => 8.0,
    };

    // ── Wind response (15 pts max) ─────────────────────────────────────
    score += match &spec.personality.wind_response {
        WindResponse::Rigid if env.wind > 0.7 => 10.0,  // survives but doesn't thrive
        WindResponse::Rigid => 12.0,
        WindResponse::Gentle if env.wind < 0.5 => 15.0,
        WindResponse::Gentle => 8.0,
        WindResponse::Dramatic if env.wind > 0.5 => 15.0, // thrives in wind
        WindResponse::Dramatic => 10.0,
        WindResponse::Dancing if env.wind > 0.3 => 15.0,
        WindResponse::Dancing if env.wind < 0.1 => 5.0,
        WindResponse::Dancing => 10.0,
        WindResponse::Swirling if env.wind > 0.4 => 14.0,
        WindResponse::Swirling => 9.0,
        WindResponse::Trembling => 11.0,
    };

    // ── Hardiness vs temperature extremes (15 pts max) ─────────────────
    let temp_stress = (env.temperature - 0.5).abs() * 2.0; // 0=comfortable, 1=extreme
    score += spec.personality.hardiness * 15.0 * (0.5 + 0.5 * (1.0 - temp_stress));

    // ── Water need vs moisture (10 pts max) ────────────────────────────
    let water_match = 1.0 - (spec.personality.water_need - env.moisture).abs();
    score += water_match * 10.0;

    // ── Stem & structure vs wind (5 pts max) ───────────────────────────
    let stem_strength = spec.structure.stem.thickness * (1.0 - spec.structure.stem.curvature);
    if env.wind > 0.6 {
        score += stem_strength * 5.0;
    } else {
        score += 3.0; // structure matters less in calm
    }

    // ── Root system vs altitude/wind (5 pts max) ───────────────────────
    let root_depth = spec.roots.depth;
    if env.altitude > 0.5 || env.wind > 0.7 {
        score += root_depth * 5.0; // deep roots matter in exposed environments
    } else {
        score += 2.5;
    }

    // ── Mycorrhizal network bonus (5 pts) ──────────────────────────────
    if spec.roots.mycorrhizal {
        score += 5.0; // connected flowers share nutrients — always beneficial
    }

    // ── Bioluminescence in dark environments (5 pts) ───────────────────
    if let Some(ref bio) = spec.ornamentation.bioluminescence {
        if env.light < 0.2 {
            score += bio.intensity * 5.0; // huge advantage in darkness
        } else {
            score += 1.0; // minor aesthetic bonus
        }
    }

    // ── Pollinator attraction (10 pts max) ─────────────────────────────
    score += spec.personality.pollinator_attraction * env.pollinator_density * 10.0;

    // ── Fragrance bonus (5 pts max) ────────────────────────────────────
    if let Some(ref fragrance) = spec.personality.fragrance {
        score += fragrance.intensity * env.pollinator_density * 5.0;
    }

    // ── Aura bonus (5 pts max) — rare trait, always rewarded ───────────
    if spec.aura.is_some() {
        score += 5.0;
    }

    score.min(100.0).max(0.0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::environment;

    fn minimal_spec() -> FlowerSpec {
        FlowerSpec {
            name: "Test".into(),
            species: "Testa minima".into(),
            petals: PetalSystem {
                layers: vec![],
                bloom_progress: 1.0,
                wilt_progress: 0.0,
                symmetry: Symmetry::Radial { order: 5 },
            },
            reproductive: ReproductiveSystem {
                pistil: None,
                stamens: vec![],
                pollen: None,
                nectary: None,
            },
            structure: StructureSystem {
                stem: Stem {
                    height: 0.5,
                    thickness: 0.5,
                    curvature: 0.1,
                    color: Color::rgb(0.2, 0.5, 0.2),
                    thorns: None,
                    internode_length: 0.3,
                    surface: SurfaceTexture::Smooth,
                    branching: BranchPattern::None,
                    style: StemStyle::Straight,
                },
                sepals: vec![],
                receptacle: Receptacle {
                    shape: ReceptacleShape::Flat,
                    size: 0.3,
                    color: Color::rgb(0.2, 0.5, 0.2),
                },
                peduncle: Peduncle {
                    length: 0.2,
                    angle: 0.0,
                    flexibility: 0.3,
                    color: Color::rgb(0.2, 0.5, 0.2),
                },
            },
            foliage: FoliageSystem {
                leaves: vec![],
                bracts: vec![],
                leaf_density: 0.5,
            },
            ornamentation: OrnamentationSystem {
                dewdrops: vec![],
                glow: None,
                particles: vec![],
                iridescence: None,
                bioluminescence: None,
            },
            roots: RootSystem {
                pattern: RootPattern::Fibrous,
                depth: 0.5,
                spread: 0.5,
                thickness: 0.3,
                color: Color::rgb(0.4, 0.3, 0.2),
                luminescence: None,
                mycorrhizal: false,
            },
            aura: None,
            personality: FlowerPersonality {
                growth_speed: 1.0,
                hardiness: 0.5,
                sociability: 0.5,
                light_preference: LightPreference::PartialShade,
                water_need: 0.5,
                wind_response: WindResponse::Gentle,
                pollinator_attraction: 0.5,
                fragrance: None,
            },
        }
    }

    #[test]
    fn score_is_bounded() {
        let spec = minimal_spec();
        for env in environment::all_environments() {
            let s = evaluate(&spec, &env);
            assert!(s >= 0.0 && s <= 100.0, "score {s} out of bounds for {}", env.name);
        }
    }

    #[test]
    fn nocturnal_flower_scores_high_in_dark() {
        let mut spec = minimal_spec();
        spec.personality.light_preference = LightPreference::Nocturnal;
        spec.ornamentation.bioluminescence = Some(Bioluminescence {
            pattern: BioPattern::Veins,
            color: Color::rgb(0.0, 0.8, 1.0),
            intensity: 0.9,
            trigger: BioTrigger::Always,
        });

        let dark_score = evaluate(&spec, &environment::nocturnal());
        let sun_score = evaluate(&spec, &environment::desert());
        assert!(dark_score > sun_score, "nocturnal flower should score higher in dark ({dark_score}) than desert ({sun_score})");
    }
}
