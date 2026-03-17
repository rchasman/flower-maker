use std::collections::HashMap;
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
    /// (min_session_id, max_session_id) → accumulated overlap time
    overlap_timers: HashMap<(u64, u64), f32>,
    /// Merge events ready to be consumed
    pending_events: Vec<MergeEvent>,
    /// Session IDs already consumed by a merge this frame (prevent double-merge)
    consumed: Vec<u64>,
}

impl MergeTracker {
    pub fn new() -> Self {
        Self {
            overlap_timers: HashMap::new(),
            pending_events: Vec::new(),
            consumed: Vec::new(),
        }
    }

    /// Update overlap timers from current physics contact pairs.
    pub fn update(&mut self, world: &PhysicsWorld, dt: f32) {
        let active_pairs = world.contact_pairs();

        // Build set of currently active pairs (normalized: smaller ID first)
        let active_set: Vec<(u64, u64)> = active_pairs.iter()
            .map(|&(a, b)| if a < b { (a, b) } else { (b, a) })
            .collect();

        // Increment timers for active pairs, remove stale ones
        let stale_keys: Vec<(u64, u64)> = self.overlap_timers.keys()
            .filter(|k| !active_set.contains(k))
            .copied()
            .collect();
        for key in stale_keys {
            self.overlap_timers.remove(&key);
        }

        for pair in &active_set {
            // Skip if either flower was already consumed by a merge
            if self.consumed.contains(&pair.0) || self.consumed.contains(&pair.1) {
                continue;
            }

            let timer = self.overlap_timers.entry(*pair).or_insert(0.0);
            *timer += dt;

            if *timer >= MERGE_THRESHOLD_SECS {
                self.pending_events.push(MergeEvent { a: pair.0, b: pair.1 });
                self.consumed.push(pair.0);
                self.consumed.push(pair.1);
                self.overlap_timers.remove(pair);
            }
        }
    }

    /// Drain pending merge events. Maps body user_data to session IDs via flower list.
    pub fn drain_events(&mut self, _flowers: &[FlowerInstance]) -> Vec<MergeEvent> {
        self.consumed.clear();
        std::mem::take(&mut self.pending_events)
    }
}
