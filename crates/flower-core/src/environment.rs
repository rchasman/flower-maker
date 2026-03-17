use serde::{Deserialize, Serialize};

/// Abstract environment for fitness scoring. No rendering impact —
/// these are leaderboard categories that define selection pressures.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Environment {
    pub name: String,
    pub light: f64,              // 0.0 = total darkness, 1.0 = blazing sun
    pub wind: f64,               // 0.0 = dead calm, 1.0 = gale force
    pub temperature: f64,        // 0.0 = freezing, 1.0 = scorching
    pub moisture: f64,           // 0.0 = bone dry, 1.0 = aquatic
    pub altitude: f64,           // 0.0 = sea level, 1.0 = alpine peak
    pub pollinator_density: f64, // 0.0 = none, 1.0 = swarming
}

pub fn tropical() -> Environment {
    Environment {
        name: "Tropical".into(),
        light: 0.9,
        wind: 0.2,
        temperature: 0.85,
        moisture: 0.9,
        altitude: 0.1,
        pollinator_density: 0.95,
    }
}

pub fn alpine() -> Environment {
    Environment {
        name: "Alpine".into(),
        light: 0.7,
        wind: 0.8,
        temperature: 0.2,
        moisture: 0.4,
        altitude: 0.95,
        pollinator_density: 0.3,
    }
}

pub fn desert() -> Environment {
    Environment {
        name: "Desert".into(),
        light: 1.0,
        wind: 0.5,
        temperature: 0.95,
        moisture: 0.05,
        altitude: 0.3,
        pollinator_density: 0.15,
    }
}

pub fn temperate() -> Environment {
    Environment {
        name: "Temperate".into(),
        light: 0.6,
        wind: 0.4,
        temperature: 0.5,
        moisture: 0.6,
        altitude: 0.2,
        pollinator_density: 0.7,
    }
}

pub fn nocturnal() -> Environment {
    Environment {
        name: "Nocturnal".into(),
        light: 0.05,
        wind: 0.1,
        temperature: 0.35,
        moisture: 0.7,
        altitude: 0.15,
        pollinator_density: 0.4,
    }
}

pub fn storm() -> Environment {
    Environment {
        name: "Storm".into(),
        light: 0.3,
        wind: 0.95,
        temperature: 0.4,
        moisture: 0.85,
        altitude: 0.2,
        pollinator_density: 0.1,
    }
}

pub fn all_environments() -> Vec<Environment> {
    vec![tropical(), alpine(), desert(), temperate(), nocturnal(), storm()]
}
