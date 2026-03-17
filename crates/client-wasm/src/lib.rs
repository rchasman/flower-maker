use flower_core::catalog::FlowerSpec;
use flower_core::growth::GrowthState;
use flower_core::physics::GardenPhysics;
use wasm_bindgen::prelude::*;

/// Garden simulation running client-side at 60fps
#[wasm_bindgen]
pub struct GardenSimulation {
    physics: GardenPhysics,
    flowers: Vec<FlowerInstance>,
}

struct FlowerInstance {
    spec: FlowerSpec,
    growth: GrowthState,
    x: f64,
    y: f64,
    session_id: u64,
}

#[wasm_bindgen]
impl GardenSimulation {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            physics: GardenPhysics::new(),
            flowers: Vec::new(),
        }
    }

    /// Add or update a flower from SpacetimeDB subscription data
    pub fn upsert_flower(&mut self, session_id: u64, spec_json: &str, x: f64, y: f64) {
        if let Ok(spec) = serde_json::from_str::<FlowerSpec>(spec_json) {
            if let Some(flower) = self.flowers.iter_mut().find(|f| f.session_id == session_id) {
                flower.spec = spec;
                flower.x = x;
                flower.y = y;
            } else {
                self.flowers.push(FlowerInstance {
                    spec,
                    growth: GrowthState::new(),
                    x,
                    y,
                    session_id,
                });
            }
        }
    }

    /// Remove a flower (session completed/deleted)
    pub fn remove_flower(&mut self, session_id: u64) {
        self.flowers.retain(|f| f.session_id != session_id);
    }

    /// Advance all simulations by dt seconds. Returns number of active flowers.
    pub fn tick(&mut self, dt: f64) -> u32 {
        self.physics.tick(dt);
        let wind = self.physics.wind_x;
        for flower in &mut self.flowers {
            flower.growth.tick(&flower.spec, dt, wind);
        }
        self.flowers.len() as u32
    }

    /// Get flower count
    pub fn flower_count(&self) -> u32 {
        self.flowers.len() as u32
    }

    /// Get current wind for rendering
    pub fn wind_x(&self) -> f64 {
        self.physics.wind_x
    }

    pub fn wind_y(&self) -> f64 {
        self.physics.wind_y
    }

    pub fn ambient_light(&self) -> f64 {
        self.physics.ambient_light
    }

    pub fn time_of_day(&self) -> f64 {
        self.physics.time_of_day
    }

    /// Export all flower render data as a flat JSON array for the WebGL renderer.
    /// Each entry: { session_id, x, y, phase, height, bloom, particle_count, glow, ... }
    pub fn render_data(&self) -> String {
        let data: Vec<serde_json::Value> = self.flowers.iter().map(|f| {
            serde_json::json!({
                "sid": f.session_id,
                "x": f.x,
                "y": f.y,
                "phase": format!("{:?}", f.growth.bloom_phase),
                "height": f.growth.height_progress,
                "age": f.growth.age,
                "energy": f.growth.energy,
                "branches": f.growth.branch_points.len(),
                "particles": f.growth.active_particles.len(),
                "spec": {
                    "name": f.spec.name,
                    "petals": f.spec.petals.layers.len(),
                    "has_glow": f.spec.ornamentation.glow.is_some(),
                    "has_aura": f.spec.aura.is_some(),
                    "wind_response": format!("{:?}", f.spec.personality.wind_response),
                    "mycorrhizal": f.spec.roots.mycorrhizal,
                }
            })
        }).collect();
        serde_json::to_string(&data).unwrap_or_else(|_| "[]".to_string())
    }

    /// Get detailed render data for a single flower (for zoomed-in view)
    pub fn flower_detail(&self, session_id: u64) -> String {
        self.flowers.iter()
            .find(|f| f.session_id == session_id)
            .map(|f| {
                serde_json::json!({
                    "spec": f.spec,
                    "growth": f.growth,
                    "x": f.x,
                    "y": f.y,
                    "physics": {
                        "wind_x": self.physics.wind_x,
                        "wind_y": self.physics.wind_y,
                        "ambient_light": self.physics.ambient_light,
                        "time_of_day": self.physics.time_of_day,
                    }
                }).to_string()
            })
            .unwrap_or_else(|| "null".to_string())
    }
}
