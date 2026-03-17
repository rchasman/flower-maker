mod simulation;
mod merge;
mod animation;

use flower_core::catalog::FlowerSpec;
use flower_core::animation::FlowerAnimation;
use flower_core::physics::GardenPhysics;
use simulation::PhysicsWorld;
use merge::MergeTracker;
use wasm_bindgen::prelude::*;

struct FlowerInstance {
    session_id: u64,
    spec: FlowerSpec,
    anim: FlowerAnimation,
    body_handle: rapier2d::dynamics::RigidBodyHandle,
}

/// Single-zone garden simulation with rapier2d physics.
/// Runs in the designer view for YOUR flowers only.
#[wasm_bindgen]
pub struct GardenSimulation {
    physics: GardenPhysics,
    world: PhysicsWorld,
    merge_tracker: MergeTracker,
    flowers: Vec<FlowerInstance>,
}

#[wasm_bindgen]
impl GardenSimulation {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            physics: GardenPhysics::new(),
            world: PhysicsWorld::new(),
            merge_tracker: MergeTracker::new(),
            flowers: Vec::new(),
        }
    }

    /// Add or update a flower from SpacetimeDB data
    pub fn upsert_flower(&mut self, session_id: u64, spec_json: &str, x: f32, y: f32) {
        if let Ok(spec) = serde_json::from_str::<FlowerSpec>(spec_json) {
            if let Some(flower) = self.flowers.iter_mut().find(|f| f.session_id == session_id) {
                flower.spec = spec;
                self.world.set_position(flower.body_handle, x, y);
            } else {
                let radius = 0.5; // base collider radius
                let mass = 1.0;
                let handle = self.world.add_body(x, y, radius, mass, session_id);
                self.flowers.push(FlowerInstance {
                    session_id,
                    spec,
                    anim: FlowerAnimation::new(),
                    body_handle: handle,
                });
            }
        }
    }

    /// Start wilt-out animation for a flower (it will be removed after animation completes)
    pub fn wilt_flower(&mut self, session_id: u64) {
        if let Some(flower) = self.flowers.iter_mut().find(|f| f.session_id == session_id) {
            flower.anim.start_wilt();
        }
    }

    /// Remove a flower immediately (no animation)
    pub fn remove_flower(&mut self, session_id: u64) {
        if let Some(idx) = self.flowers.iter().position(|f| f.session_id == session_id) {
            let flower = self.flowers.remove(idx);
            self.world.remove_body(flower.body_handle);
        }
    }

    /// Advance physics + animations by dt seconds. Returns active flower count.
    pub fn tick(&mut self, dt: f32) -> u32 {
        let dt64 = dt as f64;
        self.physics.tick(dt64);
        let wind = self.physics.wind_x;

        // Step rapier2d physics
        self.world.step(dt);

        // Update merge tracker with current collision pairs
        self.merge_tracker.update(&self.world, dt);

        // Tick animations
        for flower in &mut self.flowers {
            flower.anim.tick(&flower.spec, dt64, wind);
        }

        // Remove flowers whose wilt animation completed
        let to_remove: Vec<u64> = self.flowers.iter()
            .filter(|f| f.anim.is_gone())
            .map(|f| f.session_id)
            .collect();
        for sid in to_remove {
            self.remove_flower(sid);
        }

        self.flowers.len() as u32
    }

    /// Get pending merge events as JSON: [{ "a": session_id, "b": session_id }, ...]
    pub fn get_merge_events(&mut self) -> String {
        let events = self.merge_tracker.drain_events(&self.flowers);
        serde_json::to_string(&events).unwrap_or_else(|_| "[]".into())
    }

    /// Export render data as JSON for PixiJS
    pub fn render_data(&self) -> String {
        let data: Vec<serde_json::Value> = self.flowers.iter().map(|f| {
            let pos = self.world.position(f.body_handle);
            let rot = self.world.rotation(f.body_handle);
            serde_json::json!({
                "sid": f.session_id,
                "x": pos.0,
                "y": pos.1,
                "rotation": rot,
                "scale": f.anim.scale(),
                "alpha": f.anim.alpha(),
                "spec_name": f.spec.name,
                "has_aura": f.spec.aura.is_some(),
                "has_glow": f.spec.ornamentation.glow.is_some(),
                "particles": f.anim.particles.len(),
            })
        }).collect();
        serde_json::to_string(&data).unwrap_or_else(|_| "[]".into())
    }

    pub fn flower_count(&self) -> u32 {
        self.flowers.len() as u32
    }

    pub fn wind_x(&self) -> f64 { self.physics.wind_x }
    pub fn wind_y(&self) -> f64 { self.physics.wind_y }
    pub fn ambient_light(&self) -> f64 { self.physics.ambient_light }
    pub fn time_of_day(&self) -> f64 { self.physics.time_of_day }
}
