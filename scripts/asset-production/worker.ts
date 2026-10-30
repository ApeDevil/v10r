#!/usr/bin/env bun
/**
 * The isolated asset production worker: one run per process. Reads `{ input, budget, runMs }`
 * as JSON on stdin, writes one `IsolatedWorkerAnswer` as JSON on stdout, exits.
 *
 * Started by `createIsolatedProcessEnvironment` (`src/lib/server/asset-production/`), which
 * kills it at its deadline. It is also the entrypoint a CPU worker container would run —
 * nothing here reads the network, the filesystem or an environment variable.
 */
import type { AssetBudget } from '../../src/lib/asset-production/index.ts';
import { type IsolatedWorkerAnswer, inProcessEnvironment } from '../../src/lib/server/asset-production/index.ts';

const { input, budget, runMs } = JSON.parse(await new Response(Bun.stdin.stream()).text()) as {
	input: unknown;
	budget: AssetBudget;
	runMs: number;
};
const { run, measurements, runtime } = await inProcessEnvironment.execute(input, { budget, runMs });
const { glb, ...rest } = run;
const answer: IsolatedWorkerAnswer = {
	run: rest,
	runtime,
	measurements,
	glbBase64: glb ? Buffer.from(glb).toString('base64') : undefined,
};
process.stdout.write(JSON.stringify(answer));
