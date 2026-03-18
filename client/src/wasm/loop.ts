import type { GardenSim } from "./loader.ts";

export interface MergeEvent {
  a: number;
  b: number;
}

export type MergeHandler = (event: MergeEvent) => void;
export type RenderCallback = (data: FlowerRenderData[]) => void;

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

/** Read flower data from the typed buffer. */
function readFromBuffer(buf: Float32Array): FlowerRenderData[] {
  const count = buf[0] ?? 0;
  const result: FlowerRenderData[] = [];

  for (let i = 0; i < count; i++) {
    const off = HEADER_FLOATS + i * FLOATS_PER_FLOWER;
    result.push({
      sid: buf[off]!,
      x: buf[off + 1]!,
      y: buf[off + 2]!,
      rotation: buf[off + 3]!,
      scale: buf[off + 4]!,
      alpha: buf[off + 5]!,
      has_aura: buf[off + 6]! > 0.5,
      has_glow: buf[off + 7]! > 0.5,
      particles: buf[off + 8]!,
      petal_color_r: buf[off + 9]!,
      petal_color_g: buf[off + 10]!,
      petal_color_b: buf[off + 11]!,
      petal_count: buf[off + 12]!,
    });
  }

  return result;
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
        // Fast path: write directly to typed buffer (no JSON alloc)
        sim.write_to_buffer!(buf);
        onRender(readFromBuffer(buf));
      } else {
        // Fallback: JSON serialization
        const renderJson = sim.render_data();
        const data = JSON.parse(renderJson) as FlowerRenderData[];
        onRender(data);
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
