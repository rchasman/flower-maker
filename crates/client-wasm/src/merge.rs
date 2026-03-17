use std::collections::{HashMap, HashSet};
use serde::Serialize;
use crate::simulation::PhysicsWorld;
use crate::FlowerInstance;

const MERGE_THRESHOLD_SECS: f32 = 0.5;

#[derive(Serialize)]
pub struct MergeEvent {
    pub a: u64,
    pub b: u64,
}

/// Tracks how long pairs of flowers have been in contact.
/// Emits a merge event when overlap exceeds the threshold.
pub struct MergeTracker {
    overlap_timers: HashMap<(u64, u64), f32>,
    pending_events: Vec<MergeEvent>,
    consumed: HashSet<u64>,
}

impl MergeTracker {
    pub fn new() -> Self {
        Self {
            overlap_timers: HashMap::new(),
            pending_events: Vec::new(),
            consumed: HashSet::new(),
        }
    }

    /// Update overlap timers from current physics contact pairs.
    pub fn update(&mut self, world: &PhysicsWorld, dt: f32) {
        let active_pairs = world.contact_pairs();

        // Build HashSet of currently active pairs (normalized: smaller ID first)
        let active_set: HashSet<(u64, u64)> = active_pairs.iter()
            .map(|&(a, b)| if a < b { (a, b) } else { (b, a) })
            .collect();

        // Remove stale timers in a single pass
        self.overlap_timers.retain(|k, _| active_set.contains(k));

        for pair in &active_set {
            if self.consumed.contains(&pair.0) || self.consumed.contains(&pair.1) {
                continue;
            }

            let timer = self.overlap_timers.entry(*pair).or_insert(0.0);
            *timer += dt;

            if *timer >= MERGE_THRESHOLD_SECS {
                self.pending_events.push(MergeEvent { a: pair.0, b: pair.1 });
                self.consumed.insert(pair.0);
                self.consumed.insert(pair.1);
                self.overlap_timers.remove(pair);
            }
        }
    }

    pub fn drain_events(&mut self, _flowers: &[FlowerInstance]) -> Vec<MergeEvent> {
        self.consumed.clear();
        std::mem::take(&mut self.pending_events)
    }
}
