use crate::catalog::FlowerSpec;
use serde::{Deserialize, Serialize};

/// Growth state for a flower being simulated
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GrowthState {
    pub age: f64,                // simulation ticks
    pub bloom_phase: BloomPhase,
    pub energy: f64,             // 0.0-1.0
    pub height_progress: f64,    // 0.0-1.0 of final height
    pub branch_points: Vec<BranchPoint>,
    pub active_particles: Vec<ParticleState>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BloomPhase {
    Seed,
    Sprouting,
    Vegetative,
    Budding,
    Blooming,
    FullBloom,
    Fruiting,
    Senescence,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BranchPoint {
    pub position: f64,           // along stem 0.0-1.0
    pub angle: f64,
    pub length: f64,
    pub has_leaf: bool,
    pub has_bud: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParticleState {
    pub x: f64,
    pub y: f64,
    pub vx: f64,
    pub vy: f64,
    pub life: f64,
    pub kind: u8,                // index into particle effects
}

impl GrowthState {
    pub fn new() -> Self {
        Self {
            age: 0.0,
            bloom_phase: BloomPhase::Seed,
            energy: 1.0,
            height_progress: 0.0,
            branch_points: Vec::new(),
            active_particles: Vec::new(),
        }
    }

    /// Advance simulation by one tick. Core algorithm shared between server and client WASM.
    pub fn tick(&mut self, spec: &FlowerSpec, dt: f64, wind: f64) {
        self.age += dt;
        let growth_rate = spec.personality.growth_speed * self.energy * dt;

        // Phase transitions based on age thresholds
        self.bloom_phase = match self.age {
            a if a < 2.0 => BloomPhase::Seed,
            a if a < 5.0 => BloomPhase::Sprouting,
            a if a < 15.0 => BloomPhase::Vegetative,
            a if a < 25.0 => BloomPhase::Budding,
            a if a < 40.0 => BloomPhase::Blooming,
            a if a < 80.0 => BloomPhase::FullBloom,
            a if a < 100.0 => BloomPhase::Fruiting,
            _ => BloomPhase::Senescence,
        };

        // Height grows logarithmically
        self.height_progress = (self.height_progress + growth_rate * 0.02).min(1.0);

        // Branch generation during vegetative phase
        if matches!(self.bloom_phase, BloomPhase::Vegetative | BloomPhase::Budding) {
            let target_branches = (self.height_progress * 8.0) as usize;
            while self.branch_points.len() < target_branches {
                let pos = self.branch_points.len() as f64 / 8.0;
                self.branch_points.push(BranchPoint {
                    position: pos,
                    angle: if self.branch_points.len() % 2 == 0 { 30.0 } else { -30.0 },
                    length: 0.3 + pos * 0.2,
                    has_leaf: true,
                    has_bud: matches!(self.bloom_phase, BloomPhase::Budding) && pos > 0.7,
                });
            }
        }

        // Particle simulation
        self.active_particles.retain_mut(|p| {
            p.x += p.vx * dt + wind * 0.1;
            p.y += p.vy * dt;
            p.life -= dt;
            p.life > 0.0
        });

        // Spawn new particles during bloom
        if matches!(self.bloom_phase, BloomPhase::Blooming | BloomPhase::FullBloom) {
            for effect in &spec.ornamentation.particles {
                if self.active_particles.len() < 500 {
                    self.active_particles.push(ParticleState {
                        x: 0.0,
                        y: self.height_progress * spec.structure.stem.height,
                        vx: (effect.drift_speed - 0.5) * 2.0,
                        vy: -effect.gravity * 0.5,
                        life: effect.lifetime,
                        kind: 0,
                    });
                }
            }
        }
    }
}
