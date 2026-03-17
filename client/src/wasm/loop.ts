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
  spec_name: string;
  has_aura: boolean;
  has_glow: boolean;
  particles: number;
}

let animFrameId: number | null = null;
let lastTime = 0;

export function startLoop(
  sim: GardenSim,
  onMerge: MergeHandler,
  onRender: RenderCallback,
) {
  if (animFrameId !== null) return;

  lastTime = performance.now();

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
      const renderJson = sim.render_data();
      const data = JSON.parse(renderJson) as FlowerRenderData[];
      onRender(data);
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
  }
}
