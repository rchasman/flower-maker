use rapier2d::prelude::*;

/// Wrapper around rapier2d physics world for a single zone.
pub struct PhysicsWorld {
    gravity: Vector<f32>,
    integration_params: IntegrationParameters,
    physics_pipeline: PhysicsPipeline,
    island_manager: IslandManager,
    broad_phase: DefaultBroadPhase,
    narrow_phase: NarrowPhase,
    rigid_body_set: RigidBodySet,
    collider_set: ColliderSet,
    impulse_joint_set: ImpulseJointSet,
    multibody_joint_set: MultibodyJointSet,
    ccd_solver: CCDSolver,
    query_pipeline: QueryPipeline,
}

impl PhysicsWorld {
    pub fn new() -> Self {
        Self {
            gravity: vector![0.0, 0.0], // top-down, no gravity
            integration_params: IntegrationParameters::default(),
            physics_pipeline: PhysicsPipeline::new(),
            island_manager: IslandManager::new(),
            broad_phase: DefaultBroadPhase::new(),
            narrow_phase: NarrowPhase::new(),
            rigid_body_set: RigidBodySet::new(),
            collider_set: ColliderSet::new(),
            impulse_joint_set: ImpulseJointSet::new(),
            multibody_joint_set: MultibodyJointSet::new(),
            ccd_solver: CCDSolver::new(),
            query_pipeline: QueryPipeline::new(),
        }
    }

    /// Add a dynamic body with a circular collider. Returns the body handle.
    pub fn add_body(
        &mut self,
        x: f32, y: f32,
        radius: f32,
        mass: f32,
        session_id: u64,
    ) -> RigidBodyHandle {
        let body = RigidBodyBuilder::dynamic()
            .translation(vector![x, y])
            .linear_damping(2.0)  // flowers slow down naturally
            .angular_damping(1.0)
            .user_data(session_id as u128)
            .build();
        let handle = self.rigid_body_set.insert(body);

        let collider = ColliderBuilder::ball(radius)
            .density(mass / (std::f32::consts::PI * radius * radius))
            .restitution(0.3)
            .friction(0.5)
            .active_events(ActiveEvents::COLLISION_EVENTS)
            .build();
        self.collider_set.insert_with_parent(collider, handle, &mut self.rigid_body_set);

        handle
    }

    pub fn remove_body(&mut self, handle: RigidBodyHandle) {
        self.rigid_body_set.remove(
            handle,
            &mut self.island_manager,
            &mut self.collider_set,
            &mut self.impulse_joint_set,
            &mut self.multibody_joint_set,
            true,
        );
    }

    pub fn set_position(&mut self, handle: RigidBodyHandle, x: f32, y: f32) {
        if let Some(body) = self.rigid_body_set.get_mut(handle) {
            body.set_translation(vector![x, y], true);
        }
    }

    pub fn position(&self, handle: RigidBodyHandle) -> (f32, f32) {
        self.rigid_body_set.get(handle)
            .map(|b| {
                let t = b.translation();
                (t.x, t.y)
            })
            .unwrap_or((0.0, 0.0))
    }

    /// Collider radius and body mass, or None when the handle is gone.
    pub fn body_params(&self, handle: RigidBodyHandle) -> Option<(f32, f32)> {
        let body = self.rigid_body_set.get(handle)?;
        let collider = body.colliders().first().and_then(|h| self.collider_set.get(*h))?;
        let radius = collider.shape().as_ball()?.radius;
        Some((radius, body.mass()))
    }

    /// True when the body already has this collider radius and mass.
    pub fn body_matches(&self, handle: RigidBodyHandle, radius: f32, mass: f32) -> bool {
        self.body_params(handle)
            .is_some_and(|(r, m)| (r - radius).abs() < 1e-4 && (m - mass).abs() < 1e-3)
    }

    pub fn rotation(&self, handle: RigidBodyHandle) -> f32 {
        self.rigid_body_set.get(handle)
            .map(|b| b.rotation().angle())
            .unwrap_or(0.0)
    }

    /// Step the physics world forward by dt seconds.
    pub fn step(&mut self, dt: f32) {
        self.integration_params.dt = dt;
        self.physics_pipeline.step(
            &self.gravity,
            &self.integration_params,
            &mut self.island_manager,
            &mut self.broad_phase,
            &mut self.narrow_phase,
            &mut self.rigid_body_set,
            &mut self.collider_set,
            &mut self.impulse_joint_set,
            &mut self.multibody_joint_set,
            &mut self.ccd_solver,
            Some(&mut self.query_pipeline),
            &(),
            &(),
        );
    }

}
