use serde::{Deserialize, Serialize};

/// Animation state for flowers. No lifecycle — flowers are static assemblies.
/// Only bloom-in (entrance) and wilt-out (exit) animations.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AnimationState {
    /// Fast bloom entrance: 0.0 → 1.0 over ~2 seconds
    BloomingIn { progress: f64 },
    /// Fully visible, static.
    Alive,
    /// Fast wilt exit: 0.0 → 1.0 over ~2 seconds
    WiltingOut { progress: f64 },
    /// Invisible, ready for removal
    Gone,
}

/// Per-flower entrance and exit animation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowerAnimation {
    pub state: AnimationState,
}

const BLOOM_DURATION: f64 = 0.6;
const WILT_DURATION: f64 = 0.5;
/** A flower settles in from, and sinks out to, this share of its size: never past full size. */
const SETTLE_SCALE: f64 = 0.85;

impl FlowerAnimation {
    pub fn new() -> Self {
        Self {
            state: AnimationState::BloomingIn { progress: 0.0 },
        }
    }

    /// Start wilt-out animation (for deletion/archive)
    pub fn start_wilt(&mut self) {
        self.state = AnimationState::WiltingOut { progress: 0.0 };
    }

    /// Current visual scale (0.0 = invisible, 1.0 = full size)
    pub fn scale(&self) -> f64 {
        match &self.state {
            AnimationState::BloomingIn { progress } => {
                SETTLE_SCALE + (1.0 - SETTLE_SCALE) * ease_out_cubic(*progress)
            }
            AnimationState::Alive => 1.0,
            AnimationState::WiltingOut { progress } => {
                1.0 - (1.0 - SETTLE_SCALE) * ease_in_cubic(*progress)
            }
            AnimationState::Gone => 0.0,
        }
    }

    /// Current visual alpha (0.0 = invisible, 1.0 = opaque)
    pub fn alpha(&self) -> f64 {
        match &self.state {
            AnimationState::BloomingIn { progress } => ease_out_cubic(*progress),
            AnimationState::Alive => 1.0,
            AnimationState::WiltingOut { progress } => 1.0 - ease_in_cubic(*progress),
            AnimationState::Gone => 0.0,
        }
    }

    pub fn is_gone(&self) -> bool {
        matches!(self.state, AnimationState::Gone)
    }

    /// Advance animation by dt seconds.
    pub fn tick(&mut self, dt: f64) {
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
    }
}

/// Fast start, gentle landing; stays within 0..=1
fn ease_out_cubic(t: f64) -> f64 {
    1.0 - (1.0 - t).powi(3)
}

/// Gentle start, fast finish; stays within 0..=1
fn ease_in_cubic(t: f64) -> f64 {
    t.powi(3)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Scale at each step of an animation run to its end.
    fn scales(mut anim: FlowerAnimation, steps: usize) -> Vec<f64> {
        (0..steps)
            .map(|_| {
                anim.tick(1.0 / 60.0);
                anim.scale()
            })
            .collect()
    }

    #[test]
    fn a_bloom_only_grows_and_never_passes_full_size() {
        let s = scales(FlowerAnimation::new(), 60);
        assert!(s.windows(2).all(|w| w[1] >= w[0]), "{s:?}");
        assert!(s.iter().all(|&v| v <= 1.0));
        assert_eq!(s.last(), Some(&1.0));
    }

    #[test]
    fn a_wilt_only_shrinks_and_never_swells_first() {
        let mut anim = FlowerAnimation::new();
        anim.state = AnimationState::Alive;
        anim.start_wilt();
        let s = scales(anim, 40);
        assert!(s.windows(2).all(|w| w[1] <= w[0]), "{s:?}");
        assert!(s.iter().all(|&v| v <= 1.0));
    }
}
