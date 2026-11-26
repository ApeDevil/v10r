/**
 * The page's handle on the model-evaluation worker: one run at a time, the latest wins, and
 * cancel means terminate — the kernel cannot be interrupted mid-operation, so a stuck or
 * superseded run is ended by discarding its worker (the next run starts a fresh one and pays
 * the kernel compile again).
 */
import type { ModelEvaluation } from './model-evaluation';
import type { ModelEvaluationRequest, ModelEvaluationResponse } from './model-evaluation.worker';

export interface ModelEvaluator {
	evaluate(model: unknown): Promise<ModelEvaluation>;
	cancel(): void;
	dispose(): void;
}

export class EvaluationCancelled extends Error {
	constructor() {
		super('cancelled');
		this.name = 'EvaluationCancelled';
	}
}

export async function createModelEvaluator(): Promise<ModelEvaluator> {
	const { default: EvaluationWorker } = await import('./model-evaluation.worker.ts?worker');
	let worker: Worker | null = null;
	let nextId = 1;
	let pending: { id: number; resolve: (value: ModelEvaluation) => void; reject: (error: Error) => void } | null = null;

	function spawn(): Worker {
		const created = new EvaluationWorker();
		created.onmessage = (event: MessageEvent<ModelEvaluationResponse>) => {
			const answer = event.data;
			if (!pending || answer.id !== pending.id) return;
			const { resolve, reject } = pending;
			pending = null;
			if (answer.ok) resolve(answer.evaluation);
			else reject(new Error(answer.error));
		};
		created.onerror = (event) => {
			if (!pending) return;
			const { reject } = pending;
			pending = null;
			reject(new Error(event.message || 'The model worker failed.'));
		};
		return created;
	}

	function cancel(): void {
		if (!pending) return;
		worker?.terminate();
		worker = null;
		const { reject } = pending;
		pending = null;
		reject(new EvaluationCancelled());
	}

	return {
		evaluate(model) {
			cancel();
			worker ??= spawn();
			const id = nextId++;
			return new Promise<ModelEvaluation>((resolve, reject) => {
				pending = { id, resolve, reject };
				const request: ModelEvaluationRequest = { id, model };
				worker?.postMessage(request);
			});
		},
		cancel,
		dispose() {
			cancel();
			worker?.terminate();
			worker = null;
		},
	};
}
