import type { GardenSim } from "./loader.ts";

export interface MergeEvent {
  a: number;
  b: number;
}

export type MergeHandler = (event: MergeEvent) => void;
export type RenderCallback = (pool: FlowerRenderData[], count: number) => void;

export interface FlowerRenderData {
  sid: number;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  alpha: number;
  has_aura: boolean;
  has_glow: boolean;
  particles: number;
  petal_color_r: number;
  petal_color_g: number;
  petal_color_b: number;
  petal_count: number;
}

// SharedArrayBuffer layout constants (must match buffer.rs)
const FLOATS_PER_FLOWER = 14;
const HEADER_FLOATS = 2;

// ── Object pool: pre-allocated FlowerRenderData slots, reused every frame ──
const INITIAL_POOL_CAPACITY = 256;

function createEmptyFlower(): FlowerRenderData {
  return { sid: 0, x: 0, y: 0, rotation: 0, scale: 0, alpha: 0, has_aura: false, has_glow: false, particles: 0, petal_color_r: 0, petal_color_g: 0, petal_color_b: 0, petal_count: 0 };
}

/** Module-level pool — grows by 2x when capacity is exceeded, never shrinks. */
let pool: FlowerRenderData[] = Array.from({ length: INITIAL_POOL_CAPACITY }, createEmptyFlower);

function ensurePoolCapacity(needed: number): void {
  if (needed <= pool.length) return;
  let newCap = pool.length;
  while (newCap < needed) newCap *= 2;
  for (let i = pool.length; i < newCap; i++) {
    pool.push(createEmptyFlower());
  }
}

/** Copy all fields from src into an existing pool slot (zero allocation). */
function copyIntoSlot(slot: FlowerRenderData, src: FlowerRenderData): void {
  slot.sid = src.sid;
  slot.x = src.x;
  slot.y = src.y;
  slot.rotation = src.rotation;
  slot.scale = src.scale;
  slot.alpha = src.alpha;
  slot.has_aura = src.has_aura;
  slot.has_glow = src.has_glow;
  slot.particles = src.particles;
  slot.petal_color_r = src.petal_color_r;
  slot.petal_color_g = src.petal_color_g;
  slot.petal_color_b = src.petal_color_b;
  slot.petal_count = src.petal_count;
}

let animFrameId: number | null = null;
let lastTime = 0;

/** Shared render buffer — allocated once, reused every frame. */
let sharedBuffer: Float32Array | null = null;

function getOrCreateBuffer(sim: GardenSim): Float32Array | null {
  if (sharedBuffer) return sharedBuffer;

  // Try SharedArrayBuffer for zero-copy reads
  try {
    if (typeof SharedArrayBuffer !== "undefined" && sim.render_buffer_size) {
      const size = sim.render_buffer_size();
      const sab = new SharedArrayBuffer(size * 4);
      sharedBuffer = new Float32Array(sab);
      return sharedBuffer;
    }
  } catch {
    // SharedArrayBuffer not available (missing COOP/COEP headers)
  }

  // Fallback: regular ArrayBuffer
  try {
    if (sim.render_buffer_size) {
      const size = sim.render_buffer_size();
      sharedBuffer = new Float32Array(size);
      return sharedBuffer;
    }
  } catch {
    // render_buffer_size not available (old WASM build)
  }

  return null;
}

/** Read flower data from the typed buffer into the pre-allocated pool. Returns active count. */
function readFromBuffer(buf: Float32Array): number {
  const count = buf[0] ?? 0;
  ensurePoolCapacity(count);

  for (let i = 0; i < count; i++) {
    const off = HEADER_FLOATS + i * FLOATS_PER_FLOWER;
    const slot = pool[i]!;
    slot.sid = buf[off]!;
    slot.x = buf[off + 1]!;
    slot.y = buf[off + 2]!;
    slot.rotation = buf[off + 3]!;
    slot.scale = buf[off + 4]!;
    slot.alpha = buf[off + 5]!;
    slot.has_aura = buf[off + 6]! > 0.5;
    slot.has_glow = buf[off + 7]! > 0.5;
    slot.particles = buf[off + 8]!;
    slot.petal_color_r = buf[off + 9]!;
    slot.petal_color_g = buf[off + 10]!;
    slot.petal_color_b = buf[off + 11]!;
    slot.petal_count = buf[off + 12]!;
  }

  return count;
}

export function startLoop(
  sim: GardenSim,
  onMerge: MergeHandler,
  onRender: RenderCallback,
) {
  if (animFrameId !== null) return;

  lastTime = performance.now();
  const buf = getOrCreateBuffer(sim);
  const useBuffer = buf !== null && typeof sim.write_to_buffer === "function";

  function frame(time: number) {
    const dt = Math.min((time - lastTime) / 1000, 0.05); // cap at 50ms
    lastTime = time;

    // 1. Physics tick
    sim.tick(dt as unknown as number);

    // 2. Check merge events
    try {
      const eventsJson = sim.get_merge_events();
      const events = JSON.parse(eventsJson) as MergeEvent[];
      events.forEach(onMerge);
    } catch {
      /* no events */
    }

    // 3. Export render data
    try {
      if (useBuffer && buf) {
        // Fast path: write directly to typed buffer, read into pool (zero alloc)
        sim.write_to_buffer!(buf);
        const count = readFromBuffer(buf);
        onRender(pool, count);
      } else {
        // Fallback: JSON → pool (avoids per-frame object allocation)
        const renderJson = sim.render_data();
        const raw = JSON.parse(renderJson) as FlowerRenderData[];
        ensurePoolCapacity(raw.length);
        for (let i = 0; i < raw.length; i++) {
          copyIntoSlot(pool[i]!, raw[i]!);
        }
        onRender(pool, raw.length);
      }
    } catch {
      /* render error */
    }

    animFrameId = requestAnimationFrame(frame);
  }

  animFrameId = requestAnimationFrame(frame);
}

export function stopLoop() {
  if (animFrameId !== null) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
    sharedBuffer = null;
  }
}
