use serde::{Deserialize, Serialize};

/// World-level physics state for the shared garden
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GardenPhysics {
    pub wind_x: f64,
    pub wind_y: f64,
    pub time_of_day: f64,        // 0.0-24.0 hours
    pub weather: Weather,
    pub ambient_light: f64,      // 0.0-1.0
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Weather {
    Clear,
    Cloudy,
    Rain,
    Storm,
    Fog,
    Snow,
}

impl GardenPhysics {
    pub fn new() -> Self {
        Self {
            wind_x: 0.0,
            wind_y: 0.0,
            time_of_day: 12.0,
            weather: Weather::Clear,
            ambient_light: 1.0,
        }
    }

    /// Advance physics by dt seconds. Deterministic given same inputs.
    pub fn tick(&mut self, dt: f64) {
        self.time_of_day = (self.time_of_day + dt * 0.01) % 24.0;

        // Ambient light follows day/night cycle
        self.ambient_light = match self.time_of_day {
            t if t < 6.0 => 0.1 + t * 0.05,
            t if t < 18.0 => 0.8 + (1.0 - ((t - 12.0).abs() / 6.0)) * 0.2,
            t => 0.1 + (24.0 - t) * 0.05,
        };

        // Wind oscillates with perlin-like smoothness (simplified)
        self.wind_x = (self.time_of_day * 0.7).sin() * 0.5 + (self.time_of_day * 2.3).sin() * 0.2;
        self.wind_y = (self.time_of_day * 0.5).cos() * 0.3;
    }
}
