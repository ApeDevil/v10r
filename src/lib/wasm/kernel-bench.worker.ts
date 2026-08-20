/**
 * Worker shell for the wasm-vs-JS filter benchmark.
 *
 * Message plumbing plus the timing loop — the algorithms live in filters.ts (JS)
 * and the wasm kernel (Rust), and the statistics in bench.ts, all node-testable.
 * Same split rule as image-analysis.worker.ts.
 *
 * The handler is installed synchronously at module top level; kernel init is
 * awaited INSIDE the handler. Awaiting init before installing the handler drops
 * any message posted while the module compiles (the vite-plugin-wasm#67 race).
 *
 * Protocol per request: warm both engines untimed, then counterbalance timed
 * rounds — which engine goes first alternates every round (AB/BA), timings
 * stored by lane, not position. Adjacency alone is not enough: a fixed order
 * keeps position bias (cache warmth, thermal drift) even in dedicated bench
 * libraries (tinybench#46). Wasm rounds are split at the boundary
 * (copy-in | compute | copy-out); JS rounds carry no copy cost because the data
 * already lives in JS memory — that asymmetry is the exhibit, not an unfairness.
 */
import type { RoundTiming } from './bench';
import { boxBlur, checksum, grayscale } from './filters';
import { type Kernel, loadKernel } from './index';

export type BenchFilter = 'grayscale' | 'blur';

export interface BenchRequest {
	id: number;
	filter: BenchFilter;
	width: number;
	height: number;
	radius: number;
	/** RGBA source frame — transferred in. */
	pixels: ArrayBuffer;
	warmup: number;
	rounds: number;
}

export interface EngineReport {
	rounds: RoundTiming[];
	checksum: string;
	/** Final output frame — transferred back for the side-by-side render. */
	pixels: ArrayBuffer;
}

export type BenchResponse =
	| { id: number; type: 'progress'; done: number; total: number }
	| { id: number; type: 'done'; js: EngineReport; wasm: EngineReport; initMs: number }
	| { id: number; type: 'error'; error: string };

let kernelInitMs = 0;
let kernel: Kernel | null = null;

async function getKernel(): Promise<Kernel> {
	if (!kernel) {
		// First-run cost is real adoption cost: fetch + compile + instantiate is
		// measured once and reported so the page can show it instead of hiding it.
		const t0 = performance.now();
		kernel = await loadKernel();
		kernelInitMs = performance.now() - t0;
	}
	return kernel;
}

function runJsRound(
	filter: BenchFilter,
	src: Uint8ClampedArray,
	work: Uint8ClampedArray,
	dst: Uint8ClampedArray,
	width: number,
	height: number,
	radius: number,
): RoundTiming {
	let compute: number;
	if (filter === 'grayscale') {
		// In-place filter: the fresh copy is harness bookkeeping, not boundary
		// cost, so it stays outside the timed region.
		work.set(src);
		const t0 = performance.now();
		grayscale(work);
		compute = performance.now() - t0;
		dst.set(work);
	} else {
		const t0 = performance.now();
		boxBlur(src, dst, width, height, radius);
		compute = performance.now() - t0;
	}
	return { copyIn: 0, compute, copyOut: 0 };
}

function runWasmRound(
	k: Kernel,
	pixelKernel: InstanceType<Kernel['mod']['PixelKernel']>,
	filter: BenchFilter,
	src: Uint8ClampedArray,
	dst: Uint8ClampedArray,
	radius: number,
): RoundTiming {
	const len = pixelKernel.byte_len();

	// Fresh view every round: box_blur swaps the kernel's internal buffers, so
	// pixels_ptr() moves between calls — a cached view would read the wrong Vec.
	const tIn0 = performance.now();
	new Uint8Array(k.memory.buffer, pixelKernel.pixels_ptr(), len).set(src);
	const copyIn = performance.now() - tIn0;

	const tC0 = performance.now();
	if (filter === 'grayscale') pixelKernel.grayscale();
	else pixelKernel.box_blur(radius);
	const compute = performance.now() - tC0;

	const tOut0 = performance.now();
	dst.set(new Uint8Array(k.memory.buffer, pixelKernel.pixels_ptr(), len));
	const copyOut = performance.now() - tOut0;

	return { copyIn, compute, copyOut };
}

self.addEventListener('message', async (event: MessageEvent<BenchRequest>) => {
	const { id, filter, width, height, radius, warmup, rounds } = event.data;
	try {
		const k = await getKernel();
		const initMs = kernelInitMs;
		kernelInitMs = 0;

		const src = new Uint8ClampedArray(event.data.pixels);
		const len = src.length;
		const jsWork = new Uint8ClampedArray(len);
		const jsDst = new Uint8ClampedArray(len);
		const wasmDst = new Uint8ClampedArray(len);
		const pixelKernel = new k.mod.PixelKernel(width, height);

		const jsRounds: RoundTiming[] = [];
		const wasmRounds: RoundTiming[] = [];
		const total = (warmup + rounds) * 2;
		let done = 0;

		const step = () => {
			done++;
			self.postMessage({ id, type: 'progress', done, total } satisfies BenchResponse);
		};

		try {
			for (let i = 0; i < warmup + rounds; i++) {
				// Counterbalanced: the engine that goes first alternates each round.
				let js: RoundTiming;
				let wasm: RoundTiming;
				if (i % 2 === 0) {
					js = runJsRound(filter, src, jsWork, jsDst, width, height, radius);
					step();
					wasm = runWasmRound(k, pixelKernel, filter, src, wasmDst, radius);
					step();
				} else {
					wasm = runWasmRound(k, pixelKernel, filter, src, wasmDst, radius);
					step();
					js = runJsRound(filter, src, jsWork, jsDst, width, height, radius);
					step();
				}
				if (i >= warmup) {
					jsRounds.push(js);
					wasmRounds.push(wasm);
				}
			}
		} finally {
			pixelKernel.free();
		}

		const response: BenchResponse = {
			id,
			type: 'done',
			js: { rounds: jsRounds, checksum: checksum(jsDst), pixels: jsDst.buffer },
			wasm: { rounds: wasmRounds, checksum: checksum(wasmDst), pixels: wasmDst.buffer },
			initMs,
		};
		self.postMessage(response, { transfer: [jsDst.buffer, wasmDst.buffer] });
	} catch (err) {
		const response: BenchResponse = {
			id,
			type: 'error',
			error: err instanceof Error ? err.message : String(err),
		};
		self.postMessage(response);
	}
});
