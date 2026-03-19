/* tslint:disable */
/* eslint-disable */

/**
 * Single-zone garden simulation with rapier2d physics.
 * Runs in the designer view for YOUR flowers only.
 */
export class GardenSimulation {
    free(): void;
    [Symbol.dispose](): void;
    ambient_light(): number;
    flower_count(): number;
    /**
     * Get pending merge events as JSON: [{ "a": session_id, "b": session_id }, ...]
     */
    get_merge_events(): string;
    constructor();
    /**
     * Remove a flower immediately (no animation)
     */
    remove_flower(session_id: bigint): void;
    /**
     * Required buffer size in f32 elements for SharedArrayBuffer allocation.
     */
    static render_buffer_size(): number;
    /**
     * Export render data as JSON for PixiJS
     */
    render_data(): string;
    /**
     * Set the physics body position for a flower (used for drag interaction).
     */
    set_body_position(session_id: bigint, x: number, y: number): void;
    /**
     * Advance physics + animations by dt seconds. Returns active flower count.
     */
    tick(dt: number): number;
    time_of_day(): number;
    /**
     * Add or update a flower from SpacetimeDB data
     */
    upsert_flower(session_id: bigint, spec_json: string, x: number, y: number): void;
    /**
     * Start wilt-out animation for a flower (it will be removed after animation completes)
     */
    wilt_flower(session_id: bigint): void;
    wind_x(): number;
    wind_y(): number;
    /**
     * Write render data into a SharedArrayBuffer-backed f32 slice.
     * Call from JS: `sim.write_to_buffer(new Float32Array(sharedBuf))`
     * Returns the number of flowers written.
     */
    write_to_buffer(buf: Float32Array): number;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_gardensimulation_free: (a: number, b: number) => void;
    readonly gardensimulation_ambient_light: (a: number) => number;
    readonly gardensimulation_flower_count: (a: number) => number;
    readonly gardensimulation_get_merge_events: (a: number) => [number, number];
    readonly gardensimulation_new: () => number;
    readonly gardensimulation_remove_flower: (a: number, b: bigint) => void;
    readonly gardensimulation_render_buffer_size: () => number;
    readonly gardensimulation_render_data: (a: number) => [number, number];
    readonly gardensimulation_set_body_position: (a: number, b: bigint, c: number, d: number) => void;
    readonly gardensimulation_tick: (a: number, b: number) => number;
    readonly gardensimulation_time_of_day: (a: number) => number;
    readonly gardensimulation_upsert_flower: (a: number, b: bigint, c: number, d: number, e: number, f: number) => void;
    readonly gardensimulation_wilt_flower: (a: number, b: bigint) => void;
    readonly gardensimulation_wind_x: (a: number) => number;
    readonly gardensimulation_wind_y: (a: number) => number;
    readonly gardensimulation_write_to_buffer: (a: number, b: number, c: number, d: any) => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
