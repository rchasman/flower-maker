// WASM module loader for the rapier2d-based garden simulation.
// Loads the wasm-pack output from client/src/wasm/pkg/

import { FLOATS_PER_FLOWER, HEADER_FLOATS } from "./loop.ts";

let simulation: GardenSim | null = null;
const STUB_MAX_FLOWERS = 64;

export interface GardenSim {
  upsert_flower(
    session_id: bigint,
    spec_yaml: string,
    x: number,
    y: number,
  ): void;
  /** New spec where the flower stands; false when the flower is not in the simulation yet. */
  update_spec(session_id: bigint, spec_yaml: string): boolean;
  wilt_flower(session_id: bigint): void;
  remove_flower(session_id: bigint): void;
  tick(dt: number): number;
  /** Write render data to a Float32Array (SharedArrayBuffer-backed). Returns the flower count. */
  write_to_buffer(buf: Float32Array): number;
  /** Required Float32Array length for render buffer allocation. */
  render_buffer_size(): number;
  /** The rectangle, canvas px, every plant's foot stays inside. */
  set_bed(left: number, top: number, right: number, bottom: number): void;
  /** Set the physics body position for a flower (drag interaction). */
  set_body_position(session_id: bigint, x: number, y: number): void;
  flower_count(): number;
}

export async function loadWasm(): Promise<GardenSim> {
  if (simulation) return simulation;

  try {
    // Dynamic import — wasm-pack output lives in pkg/
    const mod = await import("./pkg/client_wasm.js" as string);
    await mod.default();
    simulation = new mod.GardenSimulation() as GardenSim;
    console.log("[wasm] GardenSimulation loaded");
    return simulation;
  } catch (err) {
    console.warn("[wasm] Failed to load — wasm-pack build needed:", err);
    simulation = createStub();
    return simulation;
  }
}

export function getSimulation(): GardenSim | null {
  return simulation;
}

function createStub(): GardenSim {
  console.warn("[wasm] Using stub simulation");
  const flowers = new Map<number, { x: number; y: number; spec: string }>();
  let bed = {
    left: -Infinity,
    top: -Infinity,
    right: Infinity,
    bottom: Infinity,
  };

  return {
    upsert_flower(sid: bigint, spec: string, x: number, y: number) {
      flowers.set(Number(sid), { x, y, spec });
    },
    update_spec(sid: bigint, spec: string) {
      const f = flowers.get(Number(sid));
      if (f) f.spec = spec;
      return f !== undefined;
    },
    wilt_flower(sid: bigint) {
      flowers.delete(Number(sid));
    },
    remove_flower(sid: bigint) {
      flowers.delete(Number(sid));
    },
    set_bed(left: number, top: number, right: number, bottom: number) {
      bed = { left, top, right, bottom };
    },
    set_body_position(sid: bigint, x: number, y: number) {
      const f = flowers.get(Number(sid));
      if (f) {
        f.x = Math.max(bed.left, Math.min(bed.right, x));
        f.y = Math.max(bed.top, Math.min(bed.bottom, y));
      }
    },
    tick() {
      return flowers.size;
    },
    render_buffer_size() {
      return HEADER_FLOATS + STUB_MAX_FLOWERS * FLOATS_PER_FLOWER;
    },
    write_to_buffer(buf: Float32Array) {
      const visible = [...flowers.entries()].slice(0, STUB_MAX_FLOWERS);
      buf[0] = visible.length;
      buf[1] = (buf[1] ?? 0) + 1;
      for (const [i, [sid, f]] of visible.entries()) {
        const off = HEADER_FLOATS + i * FLOATS_PER_FLOWER;
        buf.set([sid, f.x, f.y, 1, 1], off);
      }
      return visible.length;
    },
    flower_count() {
      return flowers.size;
    },
  };
}
