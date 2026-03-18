/// Double-buffered SharedArrayBuffer writer for WASM → PixiJS render data.
///
/// Layout per flower (10 f32 values = 40 bytes):
///   [0] session_id (as f32)
///   [1] x
///   [2] y
///   [3] rotation
///   [4] scale
///   [5] alpha
///   [6] has_aura (0.0 or 1.0)
///   [7] has_glow (0.0 or 1.0)
///   [8] particle_count
///   [9] reserved
///
/// Header (2 f32 = 8 bytes at start of buffer):
///   [0] flower_count
///   [1] write_generation (incremented each write, reader skips if unchanged)

pub const FLOATS_PER_FLOWER: usize = 10;
pub const HEADER_FLOATS: usize = 2;
pub const MAX_FLOWERS: usize = 64;
pub const BUFFER_FLOATS: usize = HEADER_FLOATS + MAX_FLOWERS * FLOATS_PER_FLOWER;
/// Total byte size: (2 + 64*10) * 4 = 2568 bytes
pub const BUFFER_BYTES: usize = BUFFER_FLOATS * 4;

pub struct RenderBuffer {
    generation: f32,
}

impl RenderBuffer {
    pub fn new() -> Self {
        Self { generation: 0.0 }
    }

    /// Write render data directly into a f32 slice (backed by SharedArrayBuffer).
    /// Returns the number of flowers written.
    pub fn write(&mut self, buf: &mut [f32], flowers: &[(u64, f32, f32, f32, f32, f32, bool, bool, usize)]) -> usize {
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
                buf[offset] = flower.0 as f32;     // session_id
                buf[offset + 1] = flower.1;         // x
                buf[offset + 2] = flower.2;         // y
                buf[offset + 3] = flower.3;         // rotation
                buf[offset + 4] = flower.4;         // scale
                buf[offset + 5] = flower.5;         // alpha
                buf[offset + 6] = if flower.6 { 1.0 } else { 0.0 }; // has_aura
                buf[offset + 7] = if flower.7 { 1.0 } else { 0.0 }; // has_glow
                buf[offset + 8] = flower.8 as f32;  // particles
                buf[offset + 9] = 0.0;              // reserved
            }
        }

        count
    }
}
