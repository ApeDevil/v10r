/**
 * Web Worker shell — message plumbing only.
 *
 * All the real work is in image-analysis.ts (browser APIs) and palette.ts (pure).
 * Keeping this file trivial is deliberate: `self`/`postMessage` cannot be exercised
 * by the node-environment vitest harness, so nothing that needs testing may live
 * here. Same reasoning as src/service-worker.ts ↔ $lib/pwa/sw-policy.ts.
 */
import { type AnalysisRequest, type AnalysisResult, analyseImage } from './image-analysis';

export interface WorkerRequest extends AnalysisRequest {
	id: number;
}

export type WorkerResponse =
	| { id: number; ok: true; result: AnalysisResult }
	| { id: number; ok: false; error: string };

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
	const { id, ...request } = event.data;

	try {
		const result = await analyseImage(request);
		const response: WorkerResponse = { id, ok: true, result };
		self.postMessage(response);
	} catch (err) {
		const response: WorkerResponse = {
			id,
			ok: false,
			error: err instanceof Error ? err.message : String(err),
		};
		self.postMessage(response);
	}
};
