import { proceduralEngine } from '#lib/asset-production/index.ts';
import { assetExtras } from './derivation.ts';
import { type AssetExecutionEnvironment, runtimeLabel } from './environment.ts';

/** The engine in the calling process: no spawn cost, no isolation beyond the budget and checkpoints. */
export const inProcessEnvironment: AssetExecutionEnvironment = {
	id: 'in-process',
	async execute(input, context) {
		const started = performance.now();
		const cpu = process.cpuUsage();
		const heap = process.memoryUsage().heapUsed;
		const run = await proceduralEngine.produce(input, {
			budget: context.budget,
			signal: context.signal,
			deadlineAt: started + context.runMs,
			extras: assetExtras,
		});
		const used = process.cpuUsage(cpu);
		return {
			run,
			runtime: runtimeLabel(),
			measurements: {
				totalMs: performance.now() - started,
				cpuUserMs: used.user / 1000,
				cpuSystemMs: used.system / 1000,
				rssBytes: process.memoryUsage().rss,
				heapUsedDeltaBytes: process.memoryUsage().heapUsed - heap,
			},
		};
	},
};
