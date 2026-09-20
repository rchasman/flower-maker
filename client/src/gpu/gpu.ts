import { init, type Gpu } from "vgpu";

let shared: Promise<Gpu> | undefined;

// One device for every canvas on the page. Rejects on browsers without WebGPU.
export const getGpu = (): Promise<Gpu> => {
  shared ??= init().catch(error => {
    shared = undefined;
    throw error;
  });
  return shared;
};
