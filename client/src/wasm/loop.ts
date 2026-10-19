import type { GardenSim } from "./loader.ts";

export type RenderCallback = (pool: FlowerRenderData[], count: number) => void;

export interface FlowerRenderData {
  sid: number;
  /** the plant's foot on the bed, canvas px */
  x: number;
  y: number;
  scale: number;
  alpha: number;
}

// SharedArrayBuffer layout constants (must match buffer.rs)
export const FLOATS_PER_FLOWER = 5;
export const HEADER_FLOATS = 2;

// ── Object pool: pre-allocated FlowerRenderData slots, reused every frame ──
const INITIAL_POOL_CAPACITY = 256;

function createEmptyFlower(): FlowerRenderData {
  return { sid: 0, x: 0, y: 0, scale: 0, alpha: 0 };
}

/** Module-level pool — grows by 2x when capacity is exceeded, never shrinks. */
let pool: FlowerRenderData[] = Array.from(
  { length: INITIAL_POOL_CAPACITY },
  createEmptyFlower,
);

function ensurePoolCapacity(needed: number): void {
  if (needed <= pool.length) return;
  let newCap = pool.length;
  while (newCap < needed) newCap *= 2;
  for (let i = pool.length; i < newCap; i++) {
    pool.push(createEmptyFlower());
  }
}

let animFrameId: number | null = null;
let lastTime = 0;

/** Shared render buffer — allocated once, reused every frame. */
let sharedBuffer: Float32Array | null = null;

function getOrCreateBuffer(sim: GardenSim): Float32Array {
  if (sharedBuffer) return sharedBuffer;
  const size = sim.render_buffer_size();
  sharedBuffer = new Float32Array(allocateBackingStore(size * 4));
  return sharedBuffer;
}

/** SharedArrayBuffer needs COOP/COEP headers; a plain ArrayBuffer works everywhere. */
function allocateBackingStore(
  byteLength: number,
): SharedArrayBuffer | ArrayBuffer {
  if (typeof SharedArrayBuffer === "undefined")
    return new ArrayBuffer(byteLength);
  try {
    return new SharedArrayBuffer(byteLength);
  } catch {
    return new ArrayBuffer(byteLength);
  }
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
    slot.scale = buf[off + 3]!;
    slot.alpha = buf[off + 4]!;
  }

  return count;
}

export function startLoop(sim: GardenSim, onRender: RenderCallback) {
  if (animFrameId !== null) return;

  lastTime = performance.now();
  const buf = getOrCreateBuffer(sim);

  function frame(time: number) {
    const dt = Math.min((time - lastTime) / 1000, 0.05); // cap at 50ms
    lastTime = time;

    try {
      sim.tick(dt);
    } catch (err) {
      console.error("[loop] tick failed:", err);
    }

    try {
      sim.write_to_buffer(buf);
      onRender(pool, readFromBuffer(buf));
    } catch (err) {
      console.error("[loop] render frame failed:", err);
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
