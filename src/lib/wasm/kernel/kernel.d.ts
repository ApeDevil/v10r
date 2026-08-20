/* tslint:disable */
/* eslint-disable */

/**
 * The residency fix for `scale_copied`: data lives in wasm memory, JS writes it
 * once through a view, and each call crosses the boundary with two scalars.
 */
export class FloatKernel {
    free(): void;
    [Symbol.dispose](): void;
    len(): number;
    constructor(len: number);
    /**
     * Same re-view rule as `PixelKernel::pixels_ptr`.
     */
    ptr(): number;
    scale(factor: number): void;
}

/**
 * RGBA pixel buffer resident in wasm linear memory.
 *
 * JS writes source pixels through a `Uint8Array` view over `pixels_ptr()` and the
 * filters take no data arguments — no per-call marshalling. The scratch buffer is
 * allocated up front so no filter call ever grows wasm memory: growth detaches
 * every outstanding JS view over `memory.buffer`, the classic zero-copy bug.
 */
export class PixelKernel {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Direct 2D box blur, (2r+1)² taps per pixel — the hero workload. Deliberately
     * the dense direct form, not the separable/sliding-window O(1) trick: the
     * showcase's independent variable is the language, not the algorithm, and the
     * JS twin runs these exact loops. Edge handling is clamp-to-edge, so the tap
     * count is constant and the integer division is exact in both engines.
     */
    box_blur(radius: number): void;
    byte_len(): number;
    /**
     * Integer-luma grayscale — the control workload. Three multiplies and a shift
     * per pixel is memory-bandwidth-bound; the JS JIT keeps pace, and the page
     * says so. Weights are the Rec.601 luma coefficients scaled to /256.
     */
    grayscale(): void;
    constructor(width: number, height: number);
    /**
     * The view taken over this pointer must be re-created after any call that can
     * allocate (in this kernel: only the constructor) — a stale view over a grown
     * memory reads a detached buffer.
     */
    pixels_ptr(): number;
}

/**
 * The deliberate counter-example: `&[f32]` in, `Vec<f32>` out means wasm-bindgen
 * copies the whole array into linear memory on every call and copies the result
 * back out. For one multiply per element the copies dwarf the compute and plain
 * JS wins — which is the lesson, so do not "fix" this function.
 */
export function scale_copied(data: Float32Array, factor: number): Float32Array;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_floatkernel_free: (a: number, b: number) => void;
    readonly __wbg_pixelkernel_free: (a: number, b: number) => void;
    readonly floatkernel_len: (a: number) => number;
    readonly floatkernel_new: (a: number) => number;
    readonly floatkernel_ptr: (a: number) => number;
    readonly floatkernel_scale: (a: number, b: number) => void;
    readonly pixelkernel_box_blur: (a: number, b: number) => void;
    readonly pixelkernel_byte_len: (a: number) => number;
    readonly pixelkernel_grayscale: (a: number) => void;
    readonly pixelkernel_new: (a: number, b: number) => number;
    readonly scale_copied: (a: number, b: number, c: number, d: number) => void;
    readonly pixelkernel_pixels_ptr: (a: number) => number;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
    readonly __wbindgen_export: (a: number, b: number) => number;
    readonly __wbindgen_export2: (a: number, b: number, c: number) => void;
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
