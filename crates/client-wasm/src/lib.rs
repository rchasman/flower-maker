mod simulation;
mod buffer;

use flower_core::catalog::FlowerSpec;
use flower_core::animation::FlowerAnimation;
use flower_core::physics::body_params;
use simulation::{Bed, PhysicsWorld};
use buffer::RenderBuffer;
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
    world: PhysicsWorld,
    /// where plants may stand; unbounded until the canvas reports its bed
    bed: Option<Bed>,
    flowers: Vec<FlowerInstance>,
    render_buf: RenderBuffer,
}

#[wasm_bindgen]
impl GardenSimulation {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            world: PhysicsWorld::new(),
            bed: None,
            flowers: Vec::new(),
            render_buf: RenderBuffer::new(),
        }
    }

    /// Add a flower at (x, y), or move an existing one there with its new spec.
    pub fn upsert_flower(&mut self, session_id: u64, spec_yaml: &str, x: f32, y: f32) {
        let Some(spec) = parse_spec(session_id, spec_yaml) else { return };
        if self.flowers.iter().any(|f| f.session_id == session_id) {
            self.apply_spec(session_id, spec);
            self.set_body_position(session_id, x, y);
        } else {
            let (radius, mass) = body_params(&spec);
            let handle = self.world.add_body(x, y, radius, mass, session_id);
            self.flowers.push(FlowerInstance {
                session_id,
                spec,
                anim: FlowerAnimation::new(),
                body_handle: handle,
            });
        }
    }

    /// Give a flower a new spec where it stands; a spec update is not a move.
    /// False when there is no such flower yet, so the caller adds it instead.
    pub fn update_spec(&mut self, session_id: u64, spec_yaml: &str) -> bool {
        if !self.flowers.iter().any(|f| f.session_id == session_id) {
            return false;
        }
        if let Some(spec) = parse_spec(session_id, spec_yaml) {
            self.apply_spec(session_id, spec);
        }
        true
    }

    /// Start the wilt-out animation; a wilting flower no longer pushes the others.
    pub fn wilt_flower(&mut self, session_id: u64) {
        if let Some(flower) = self.flowers.iter_mut().find(|f| f.session_id == session_id) {
            flower.anim.start_wilt();
            self.world.set_ghost(flower.body_handle);
        }
    }

    /// Remove a flower immediately (no animation)
    pub fn remove_flower(&mut self, session_id: u64) {
        if let Some(idx) = self.flowers.iter().position(|f| f.session_id == session_id) {
            let flower = self.flowers.remove(idx);
            self.world.remove_body(flower.body_handle);
        }
    }

    /// The new spec on an existing flower, rebuilding its body in place when its size changes.
    fn apply_spec(&mut self, session_id: u64, spec: FlowerSpec) {
        let (radius, mass) = body_params(&spec);
        let Some(flower) = self.flowers.iter_mut().find(|f| f.session_id == session_id) else { return };
        if !self.world.body_matches(flower.body_handle, radius, mass) {
            let (x, y) = self.world.position(flower.body_handle);
            self.world.remove_body(flower.body_handle);
            flower.body_handle = self.world.add_body(x, y, radius, mass, session_id);
        }
        flower.spec = spec;
    }

    /// Advance physics + animations by dt seconds. Returns active flower count.
    pub fn tick(&mut self, dt: f32) -> u32 {
        self.world.step(dt);
        if let Some(bed) = self.bed {
            for flower in &self.flowers {
                self.world.keep_inside(flower.body_handle, &bed);
            }
        }

        for flower in &mut self.flowers {
            flower.anim.tick(dt as f64);
        }

        // Remove flowers whose wilt animation completed (single pass)
        self.flowers.retain(|f| {
            if f.anim.is_gone() {
                self.world.remove_body(f.body_handle);
                false
            } else {
                true
            }
        });

        self.flowers.len() as u32
    }

    /// Write render data into a SharedArrayBuffer-backed f32 slice.
    /// Call from JS: `sim.write_to_buffer(new Float32Array(sharedBuf))`
    /// Returns the number of flowers written.
    pub fn write_to_buffer(&mut self, buf: &mut [f32]) -> u32 {
        let flowers: Vec<_> = self.flowers.iter().map(|f| {
            let (x, y) = self.world.position(f.body_handle);
            buffer::FlowerData {
                session_id: f.session_id,
                x,
                y,
                scale: f.anim.scale() as f32,
                alpha: f.anim.alpha() as f32,
            }
        }).collect();
        self.render_buf.write(buf, &flowers) as u32
    }

    /// Required buffer size in f32 elements for SharedArrayBuffer allocation.
    pub fn render_buffer_size(&self) -> u32 {
        buffer::BUFFER_FLOATS as u32
    }

    pub fn flower_count(&self) -> u32 {
        self.flowers.len() as u32
    }

    /// The rectangle, canvas px, that every plant's foot stays inside from the next tick on.
    pub fn set_bed(&mut self, left: f32, top: f32, right: f32, bottom: f32) {
        self.bed = Some(Bed { left, top, right, bottom });
    }

    /// Set the physics body position for a flower (used for drag interaction).
    pub fn set_body_position(&mut self, session_id: u64, x: f32, y: f32) {
        if let Some(flower) = self.flowers.iter().find(|f| f.session_id == session_id) {
            self.world.set_position(flower.body_handle, x, y);
        }
    }

}

fn parse_spec(session_id: u64, spec_yaml: &str) -> Option<FlowerSpec> {
    serde_yaml::from_str::<FlowerSpec>(spec_yaml)
        .map_err(|e| {
            web_sys::console::error_1(&format!("[wasm] spec parse failed for sid={session_id}: {e}").into());
        })
        .ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    use flower_core::catalog::{Inflorescence, InflorescenceKind};

    fn spray_yaml(head_count: u32) -> String {
        let spec = FlowerSpec {
            inflorescence: Inflorescence {
                kind: InflorescenceKind::Spray,
                head_count,
                ..Inflorescence::default()
            },
            ..FlowerSpec::default()
        };
        serde_yaml::to_string(&spec).expect("spec serialises")
    }

    #[test]
    fn upsert_grows_collider_when_head_count_rises() {
        let mut sim = GardenSimulation::new();
        sim.upsert_flower(7, &spray_yaml(1), 10.0, 20.0);
        let (radius_one_head, _) = sim.world.body_params(sim.flowers[0].body_handle).unwrap();

        sim.upsert_flower(7, &spray_yaml(7), 10.0, 20.0);
        let handle = sim.flowers[0].body_handle;
        let (radius_seven_heads, _) = sim.world.body_params(handle).unwrap();

        assert!(radius_seven_heads > radius_one_head);
        assert_eq!(sim.flowers.len(), 1);
        assert_eq!(sim.world.position(handle), (10.0, 20.0));
    }

    #[test]
    fn upsert_keeps_body_when_params_are_unchanged() {
        let mut sim = GardenSimulation::new();
        sim.upsert_flower(7, &spray_yaml(3), 0.0, 0.0);
        let handle = sim.flowers[0].body_handle;
        sim.upsert_flower(7, &spray_yaml(3), 5.0, 6.0);
        assert_eq!(sim.flowers[0].body_handle, handle);
        assert_eq!(sim.world.position(handle), (5.0, 6.0));
    }

    #[test]
    fn a_spec_update_leaves_the_flower_where_it_stands() {
        let mut sim = GardenSimulation::new();
        sim.upsert_flower(7, &spray_yaml(1), 10.0, 20.0);
        sim.set_body_position(7, 40.0, 50.0);
        assert!(sim.update_spec(7, &spray_yaml(7)));
        assert!(!sim.update_spec(8, &spray_yaml(7)));
        assert_eq!(sim.world.position(sim.flowers[0].body_handle), (40.0, 50.0));
    }

    #[test]
    fn a_wilting_flower_stops_pushing_its_neighbour() {
        let mut sim = GardenSimulation::new();
        sim.upsert_flower(1, &spray_yaml(1), 0.0, 0.0);
        sim.upsert_flower(2, &spray_yaml(1), 1.0, 0.0);
        sim.wilt_flower(1);
        for _ in 0..30 {
            sim.world.step(1.0 / 60.0);
        }
        let (x, _) = sim.world.position(sim.flowers[1].body_handle);
        assert!((x - 1.0).abs() < 1e-3, "the neighbour moved to {x}");
    }

    #[test]
    fn a_shoved_plant_stops_at_the_edge_of_the_bed() {
        let mut sim = GardenSimulation::new();
        sim.set_bed(0.0, 100.0, 400.0, 300.0);
        sim.upsert_flower(1, &spray_yaml(1), 200.0, 90.0);
        sim.upsert_flower(2, &spray_yaml(1), -50.0, 200.0);
        sim.tick(1.0 / 60.0);
        assert_eq!(sim.world.position(sim.flowers[0].body_handle).1, 100.0);
        assert_eq!(sim.world.position(sim.flowers[1].body_handle).0, 0.0);
    }
}
