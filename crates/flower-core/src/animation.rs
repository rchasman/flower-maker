use crate::catalog::FlowerSpec;
use serde::{Deserialize, Serialize};

/// Animation state for flowers. No lifecycle — flowers are static assemblies.
/// Only bloom-in (entrance) and wilt-out (exit) animations.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AnimationState {
    /// Fast bloom entrance: 0.0 → 1.0 over ~2 seconds
    BloomingIn { progress: f64 },
    /// Fully visible, static. Particles still emit.
    Alive,
    /// Fast wilt exit: 0.0 → 1.0 over ~2 seconds
    WiltingOut { progress: f64 },
    /// Invisible, ready for removal
    Gone,
}

/// Particle state for ornamental effects (pollen, fireflies, etc.)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParticleState {
    pub x: f64,
    pub y: f64,
    pub vx: f64,
    pub vy: f64,
    pub life: f64,
    pub kind: u8,
}

/// Per-flower animation + particle state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowerAnimation {
    pub state: AnimationState,
    pub particles: Vec<ParticleState>,
}

const BLOOM_DURATION: f64 = 2.0;
const WILT_DURATION: f64 = 2.0;
const MAX_PARTICLES: usize = 200;

impl FlowerAnimation {
    pub fn new() -> Self {
        Self {
            state: AnimationState::BloomingIn { progress: 0.0 },
            particles: Vec::new(),
        }
    }

    pub fn new_alive() -> Self {
        Self {
            state: AnimationState::Alive,
            particles: Vec::new(),
        }
    }

    /// Start wilt-out animation (for deletion/archive)
    pub fn start_wilt(&mut self) {
        self.state = AnimationState::WiltingOut { progress: 0.0 };
    }

    /// Current visual scale (0.0 = invisible, 1.0 = full size)
    pub fn scale(&self) -> f64 {
        match &self.state {
            AnimationState::BloomingIn { progress } => ease_out_back(*progress),
            AnimationState::Alive => 1.0,
            AnimationState::WiltingOut { progress } => 1.0 - ease_in_back(*progress),
            AnimationState::Gone => 0.0,
        }
    }

    /// Current visual alpha (0.0 = invisible, 1.0 = opaque)
    pub fn alpha(&self) -> f64 {
        match &self.state {
            AnimationState::BloomingIn { progress } => *progress,
            AnimationState::Alive => 1.0,
            AnimationState::WiltingOut { progress } => 1.0 - *progress,
            AnimationState::Gone => 0.0,
        }
    }

    pub fn is_gone(&self) -> bool {
        matches!(self.state, AnimationState::Gone)
    }

    /// Advance animation by dt seconds.
    pub fn tick(&mut self, spec: &FlowerSpec, dt: f64, wind: f64) {
        // Advance animation state
        self.state = match &self.state {
            AnimationState::BloomingIn { progress } => {
                let next = progress + dt / BLOOM_DURATION;
                if next >= 1.0 {
                    AnimationState::Alive
                } else {
                    AnimationState::BloomingIn { progress: next }
                }
            }
            AnimationState::WiltingOut { progress } => {
                let next = progress + dt / WILT_DURATION;
                if next >= 1.0 {
                    AnimationState::Gone
                } else {
                    AnimationState::WiltingOut { progress: next }
                }
            }
            other => other.clone(),
        };

        // Simulate particles (only while alive or blooming in)
        if matches!(self.state, AnimationState::Alive | AnimationState::BloomingIn { .. }) {
            // Update existing particles
            self.particles.retain_mut(|p| {
                p.x += p.vx * dt + wind * 0.1;
                p.y += p.vy * dt;
                p.life -= dt;
                p.life > 0.0
            });

            // Spawn new particles from ornamentation effects
            for effect in &spec.ornamentation.particles {
                if self.particles.len() < MAX_PARTICLES {
                    self.particles.push(ParticleState {
                        x: 0.0,
                        y: spec.structure.stem.height * 0.8,
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

/// Ease-out-back: overshoots slightly then settles (bouncy entrance)
fn ease_out_back(t: f64) -> f64 {
    let c1 = 1.70158;
    let c3 = c1 + 1.0;
    let t1 = t - 1.0;
    1.0 + c3 * t1 * t1 * t1 + c1 * t1 * t1
}

/// Ease-in-back: pulls back slightly before accelerating (dramatic exit)
fn ease_in_back(t: f64) -> f64 {
    let c1 = 1.70158;
    let c3 = c1 + 1.0;
    c3 * t * t * t - c1 * t * t
}
