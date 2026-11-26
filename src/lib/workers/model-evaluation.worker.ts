/**
 * Worker shell for the model viewer — message plumbing only; the work is
 * `model-evaluation.ts`. The handler is installed synchronously and the kernel is loaded inside
 * it, so a message posted while the module compiles is never dropped. Cancelling a run is
 * `Worker.terminate()` on the page's side: a WebAssembly call cannot be interrupted from inside.
 */
import wasmUrl from 'manifold-3d/manifold.wasm?url';
import { evaluateInBrowser, type ModelEvaluation } from './model-evaluation';

export interface ModelEvaluationRequest {
	id: number;
	model: unknown;
}

export type ModelEvaluationResponse =
	| { id: number; ok: true; evaluation: ModelEvaluation }
	| { id: number; ok: false; error: string };

self.onmessage = async (event: MessageEvent<ModelEvaluationRequest>) => {
	const { id, model } = event.data;
	try {
		const evaluation = await evaluateInBrowser(model, wasmUrl);
		const transfer = [evaluation.glb?.buffer, evaluation.stl?.buffer].filter(
			(buffer): buffer is ArrayBuffer => buffer instanceof ArrayBuffer,
		);
		const response: ModelEvaluationResponse = { id, ok: true, evaluation };
		self.postMessage(response, { transfer });
	} catch (err) {
		const response: ModelEvaluationResponse = {
			id,
			ok: false,
			error: err instanceof Error ? err.message : String(err),
		};
		self.postMessage(response);
	}
};
