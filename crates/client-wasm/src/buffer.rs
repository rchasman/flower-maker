/// Double-buffered SharedArrayBuffer writer for WASM → PixiJS render data.
///
/// Layout per flower (5 f32 values = 20 bytes):
///   [0]  session_id (as f32)
///   [1]  x, the plant's foot on the bed
///   [2]  y
///   [3]  scale
///   [4]  alpha
///
/// Header (2 f32 = 8 bytes at start of buffer):
///   [0] flower_count
///   [1] write_generation (incremented each write, reader skips if unchanged)

pub const FLOATS_PER_FLOWER: usize = 5;
pub const HEADER_FLOATS: usize = 2;
pub const MAX_FLOWERS: usize = 64;
pub const BUFFER_FLOATS: usize = HEADER_FLOATS + MAX_FLOWERS * FLOATS_PER_FLOWER;

pub struct FlowerData {
    pub session_id: u64,
    pub x: f32,
    pub y: f32,
    pub scale: f32,
    pub alpha: f32,
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
                buf[offset + 3] = flower.scale;
                buf[offset + 4] = flower.alpha;
            }
        }

        count
    }
}
