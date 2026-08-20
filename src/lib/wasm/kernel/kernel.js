/* @ts-self-types="./kernel.d.ts" */

/**
 * The residency fix for `scale_copied`: data lives in wasm memory, JS writes it
 * once through a view, and each call crosses the boundary with two scalars.
 */
export class FloatKernel {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        FloatKernelFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_floatkernel_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    len() {
        const ret = wasm.floatkernel_len(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {number} len
     */
    constructor(len) {
        const ret = wasm.floatkernel_new(len);
        this.__wbg_ptr = ret;
        FloatKernelFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Same re-view rule as `PixelKernel::pixels_ptr`.
     * @returns {number}
     */
    ptr() {
        const ret = wasm.floatkernel_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {number} factor
     */
    scale(factor) {
        wasm.floatkernel_scale(this.__wbg_ptr, factor);
    }
}
if (Symbol.dispose) FloatKernel.prototype[Symbol.dispose] = FloatKernel.prototype.free;

/**
 * RGBA pixel buffer resident in wasm linear memory.
 *
 * JS writes source pixels through a `Uint8Array` view over `pixels_ptr()` and the
 * filters take no data arguments — no per-call marshalling. The scratch buffer is
 * allocated up front so no filter call ever grows wasm memory: growth detaches
 * every outstanding JS view over `memory.buffer`, the classic zero-copy bug.
 */
export class PixelKernel {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        PixelKernelFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_pixelkernel_free(ptr, 0);
    }
    /**
     * Direct 2D box blur, (2r+1)² taps per pixel — the hero workload. Deliberately
     * the dense direct form, not the separable/sliding-window O(1) trick: the
     * showcase's independent variable is the language, not the algorithm, and the
     * JS twin runs these exact loops. Edge handling is clamp-to-edge, so the tap
     * count is constant and the integer division is exact in both engines.
     * @param {number} radius
     */
    box_blur(radius) {
        wasm.pixelkernel_box_blur(this.__wbg_ptr, radius);
    }
    /**
     * @returns {number}
     */
    byte_len() {
        const ret = wasm.pixelkernel_byte_len(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Integer-luma grayscale — the control workload. Three multiplies and a shift
     * per pixel is memory-bandwidth-bound; the JS JIT keeps pace, and the page
     * says so. Weights are the Rec.601 luma coefficients scaled to /256.
     */
    grayscale() {
        wasm.pixelkernel_grayscale(this.__wbg_ptr);
    }
    /**
     * @param {number} width
     * @param {number} height
     */
    constructor(width, height) {
        const ret = wasm.pixelkernel_new(width, height);
        this.__wbg_ptr = ret;
        PixelKernelFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * The view taken over this pointer must be re-created after any call that can
     * allocate (in this kernel: only the constructor) — a stale view over a grown
     * memory reads a detached buffer.
     * @returns {number}
     */
    pixels_ptr() {
        const ret = wasm.pixelkernel_pixels_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
}
if (Symbol.dispose) PixelKernel.prototype[Symbol.dispose] = PixelKernel.prototype.free;

/**
 * The deliberate counter-example: `&[f32]` in, `Vec<f32>` out means wasm-bindgen
 * copies the whole array into linear memory on every call and copies the result
 * back out. For one multiply per element the copies dwarf the compute and plain
 * JS wins — which is the lesson, so do not "fix" this function.
 * @param {Float32Array} data
 * @param {number} factor
 * @returns {Float32Array}
 */
export function scale_copied(data, factor) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passArrayF32ToWasm0(data, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.scale_copied(retptr, ptr0, len0, factor);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var v2 = getArrayF32FromWasm0(r0, r1).slice();
        wasm.__wbindgen_export2(r0, r1 * 4, 4);
        return v2;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg___wbindgen_throw_bb96b2010945f0bc: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
    };
    return {
        __proto__: null,
        "./kernel_bg.js": import0,
    };
}

const FloatKernelFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_floatkernel_free(ptr, 1));
const PixelKernelFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_pixelkernel_free(ptr, 1));

function getArrayF32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getFloat32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

let cachedFloat32ArrayMemory0 = null;
function getFloat32ArrayMemory0() {
    if (cachedFloat32ArrayMemory0 === null || cachedFloat32ArrayMemory0.byteLength === 0) {
        cachedFloat32ArrayMemory0 = new Float32Array(wasm.memory.buffer);
    }
    return cachedFloat32ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
    return decodeText(ptr >>> 0, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function passArrayF32ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 4, 4) >>> 0;
    getFloat32ArrayMemory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
    wasmInstance = instance;
    wasm = instance.exports;
    wasmModule = module;
    cachedDataViewMemory0 = null;
    cachedFloat32ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (!module.ok) {
            throw new Error(`failed to fetch Wasm: ${module.status} ${module.statusText} fetching '${module.url}'`);
        }

        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('kernel_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
