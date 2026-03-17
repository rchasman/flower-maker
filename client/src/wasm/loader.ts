// WASM module loader for the rapier2d-based garden simulation.
// Loads the wasm-pack output from client/src/wasm/pkg/

let simulation: GardenSim | null = null;

export interface GardenSim {
  upsert_flower(
    session_id: number,
    spec_json: string,
    x: number,
    y: number,
  ): void;
  wilt_flower(session_id: number): void;
  remove_flower(session_id: number): void;
  tick(dt: number): number;
  get_merge_events(): string;
  render_data(): string;
  flower_count(): number;
  wind_x(): number;
  wind_y(): number;
  ambient_light(): number;
  time_of_day(): number;
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

  return {
    upsert_flower(sid: number, spec: string, x: number, y: number) {
      flowers.set(sid, { x, y, spec });
    },
    wilt_flower(sid: number) {
      flowers.delete(sid);
    },
    remove_flower(sid: number) {
      flowers.delete(sid);
    },
    tick() {
      return flowers.size;
    },
    get_merge_events() {
      return "[]";
    },
    render_data() {
      const data = [...flowers.entries()].map(([sid, f]) => ({
        sid,
        x: f.x,
        y: f.y,
        rotation: 0,
        scale: 1,
        alpha: 1,
        spec_name: "stub",
        has_aura: false,
        has_glow: false,
        particles: 0,
      }));
      return JSON.stringify(data);
    },
    flower_count() {
      return flowers.size;
    },
    wind_x() {
      return 0;
    },
    wind_y() {
      return 0;
    },
    ambient_light() {
      return 1;
    },
    time_of_day() {
      return 12;
    },
  };
}
