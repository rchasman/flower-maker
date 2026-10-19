/* tslint:disable */
/* eslint-disable */

/**
 * Single-zone garden simulation with rapier2d physics.
 * Runs in the designer view for YOUR flowers only.
 */
export class GardenSimulation {
    free(): void;
    [Symbol.dispose](): void;
    flower_count(): number;
    constructor();
    /**
     * Remove a flower immediately (no animation)
     */
    remove_flower(session_id: bigint): void;
    /**
     * Required buffer size in f32 elements for SharedArrayBuffer allocation.
     */
    render_buffer_size(): number;
    /**
     * The rectangle, canvas px, that every plant's foot stays inside from the next tick on.
     */
    set_bed(left: number, top: number, right: number, bottom: number): void;
    /**
     * Set the physics body position for a flower (used for drag interaction).
     */
    set_body_position(session_id: bigint, x: number, y: number): void;
    /**
     * Advance physics + animations by dt seconds. Returns active flower count.
     */
    tick(dt: number): number;
    /**
     * Give a flower a new spec where it stands; a spec update is not a move.
     * False when there is no such flower yet, so the caller adds it instead.
     */
    update_spec(session_id: bigint, spec_yaml: string): boolean;
    /**
     * Add a flower at (x, y), or move an existing one there with its new spec.
     */
    upsert_flower(session_id: bigint, spec_yaml: string, x: number, y: number): void;
    /**
     * Start the wilt-out animation; a wilting flower no longer pushes the others.
     */
    wilt_flower(session_id: bigint): void;
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
    readonly gardensimulation_flower_count: (a: number) => number;
    readonly gardensimulation_new: () => number;
    readonly gardensimulation_remove_flower: (a: number, b: bigint) => void;
    readonly gardensimulation_render_buffer_size: (a: number) => number;
    readonly gardensimulation_set_bed: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly gardensimulation_set_body_position: (a: number, b: bigint, c: number, d: number) => void;
    readonly gardensimulation_tick: (a: number, b: number) => number;
    readonly gardensimulation_update_spec: (a: number, b: bigint, c: number, d: number) => number;
    readonly gardensimulation_upsert_flower: (a: number, b: bigint, c: number, d: number, e: number, f: number) => void;
    readonly gardensimulation_wilt_flower: (a: number, b: bigint) => void;
    readonly gardensimulation_write_to_buffer: (a: number, b: number, c: number, d: any) => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
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
