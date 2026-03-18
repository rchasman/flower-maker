/// Double-buffered SharedArrayBuffer writer for WASM → PixiJS render data.
///
/// Layout per flower (14 f32 values = 56 bytes):
///   [0]  session_id (as f32)
///   [1]  x
///   [2]  y
///   [3]  rotation
///   [4]  scale
///   [5]  alpha
///   [6]  has_aura (0.0 or 1.0)
///   [7]  has_glow (0.0 or 1.0)
///   [8]  particle_count
///   [9]  petal_color_r (0.0-1.0)
///   [10] petal_color_g (0.0-1.0)
///   [11] petal_color_b (0.0-1.0)
///   [12] petal_count
///   [13] reserved
///
/// Header (2 f32 = 8 bytes at start of buffer):
///   [0] flower_count
///   [1] write_generation (incremented each write, reader skips if unchanged)

pub const FLOATS_PER_FLOWER: usize = 14;
pub const HEADER_FLOATS: usize = 2;
pub const MAX_FLOWERS: usize = 64;
pub const BUFFER_FLOATS: usize = HEADER_FLOATS + MAX_FLOWERS * FLOATS_PER_FLOWER;
/// Total byte size: (2 + 64*14) * 4 = 3592 bytes
pub const BUFFER_BYTES: usize = BUFFER_FLOATS * 4;

pub struct FlowerData {
    pub session_id: u64,
    pub x: f32,
    pub y: f32,
    pub rotation: f32,
    pub scale: f32,
    pub alpha: f32,
    pub has_aura: bool,
    pub has_glow: bool,
    pub particles: usize,
    pub petal_color_r: f32,
    pub petal_color_g: f32,
    pub petal_color_b: f32,
    pub petal_count: u32,
}

pub struct RenderBuffer {
    generation: f32,
}

impl RenderBuffer {
    pub fn new() -> Self {
        Self { generation: 0.0 }
    }

    /// Write render data directly into a f32 slice (backed by SharedArrayBuffer).
    /// Returns the number of flowers written.
    pub fn write(&mut self, buf: &mut [f32], flowers: &[FlowerData]) -> usize {
        let count = flowers.len().min(MAX_FLOWERS);
        self.generation += 1.0;

        // Header
        if buf.len() >= HEADER_FLOATS {
            buf[0] = count as f32;
            buf[1] = self.generation;
        }

        // Flower data
        for (i, flower) in flowers.iter().take(count).enumerate() {
            let offset = HEADER_FLOATS + i * FLOATS_PER_FLOWER;
            if offset + FLOATS_PER_FLOWER <= buf.len() {
                buf[offset] = flower.session_id as f32;
                buf[offset + 1] = flower.x;
                buf[offset + 2] = flower.y;
                buf[offset + 3] = flower.rotation;
                buf[offset + 4] = flower.scale;
                buf[offset + 5] = flower.alpha;
                buf[offset + 6] = if flower.has_aura { 1.0 } else { 0.0 };
                buf[offset + 7] = if flower.has_glow { 1.0 } else { 0.0 };
                buf[offset + 8] = flower.particles as f32;
                buf[offset + 9] = flower.petal_color_r;
                buf[offset + 10] = flower.petal_color_g;
                buf[offset + 11] = flower.petal_color_b;
                buf[offset + 12] = flower.petal_count as f32;
                buf[offset + 13] = 0.0; // reserved
            }
        }

        count
    }
}
