/**
 * The engine in a child process, one per run: the CPU worker shape.
 *
 * The parent writes `{ input, budget, runMs }` to the worker's stdin and reads one JSON
 * answer from its stdout. What the child cannot do to the parent is the point:
 *
 * - it is killed (SIGKILL) at the deadline or on cancel, whatever it is doing — a cooperative
 *   checkpoint is not needed for this one to stop;
 * - it is killed when its output passes `maxOutputBytes`;
 * - it inherits no environment but `PATH`, so no secret reaches generator code;
 * - its exit is awaited before the run resolves, so no process outlives its job.
 *
 * The entrypoint (`scripts/asset-production/worker.ts`) is what a container would run with
 * `--network=none --memory=… --cpus=… --read-only`; the protocol does not change.
 */
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { type AssetDiagnostic, assetDiagnostic } from '#lib/asset-production/index.ts';
import { ISOLATED_MAX_OUTPUT_BYTES } from './config.ts';
import type { AssetEnvironmentRun, AssetExecutionEnvironment } from './environment.ts';

export interface IsolatedProcessOptions {
	/** The program and arguments that start the worker. Default: `bun scripts/asset-production/worker.ts`. */
	command?: readonly [string, ...string[]];
	maxOutputBytes?: number;
}

/** The worker's answer on stdout: the engine run with the GLB as base64. */
export interface IsolatedWorkerAnswer extends Omit<AssetEnvironmentRun, 'run'> {
	run: Omit<AssetEnvironmentRun['run'], 'glb'>;
	glbBase64?: string;
}

export function createIsolatedProcessEnvironment(options: IsolatedProcessOptions = {}): AssetExecutionEnvironment {
	const [program, ...args] = options.command ?? ['bun', join(process.cwd(), 'scripts/asset-production/worker.ts')];
	const maxOutputBytes = options.maxOutputBytes ?? ISOLATED_MAX_OUTPUT_BYTES;

	return {
		id: 'isolated-process',
		execute(input, context) {
			const started = performance.now();
			const stopped = (diagnostic: AssetDiagnostic, outcome: 'cancelled' | 'failed'): AssetEnvironmentRun => ({
				run: { outcome, diagnostics: [diagnostic], stageMs: {} },
				runtime: program,
				measurements: { totalMs: performance.now() - started },
			});

			return new Promise((resolve) => {
				const child = spawn(program, args, { env: { PATH: process.env.PATH ?? '' }, stdio: ['pipe', 'pipe', 'pipe'] });
				const chunks: Buffer[] = [];
				let size = 0;
				let verdict: AssetEnvironmentRun | undefined;
				const kill = (reason: AssetEnvironmentRun) => {
					verdict ??= reason;
					child.kill('SIGKILL');
				};
				const timer = setTimeout(
					() =>
						kill(
							stopped(
								assetDiagnostic('run.deadline', 'run', 'The worker passed its deadline and was killed.'),
								'cancelled',
							),
						),
					context.runMs,
				);
				const onAbort = () =>
					kill(
						stopped(
							assetDiagnostic('run.cancelled', 'run', 'The run was cancelled; the worker was killed.'),
							'cancelled',
						),
					);
				if (context.signal?.aborted) onAbort();
				context.signal?.addEventListener('abort', onAbort, { once: true });

				child.stdout.on('data', (chunk: Buffer) => {
					size += chunk.byteLength;
					if (size > maxOutputBytes) {
						kill(
							stopped(
								assetDiagnostic(
									'run.failed',
									'run',
									`The worker wrote more than ${maxOutputBytes} bytes and was killed.`,
								),
								'failed',
							),
						);
						return;
					}
					chunks.push(chunk);
				});
				child.stderr.resume();
				child.on('error', () =>
					kill(stopped(assetDiagnostic('run.failed', 'run', `The worker could not start (${program}).`), 'failed')),
				);
				child.on('close', (code) => {
					clearTimeout(timer);
					context.signal?.removeEventListener('abort', onAbort);
					if (verdict) return resolve(verdict);
					try {
						const answer = JSON.parse(Buffer.concat(chunks).toString('utf8')) as IsolatedWorkerAnswer;
						const { glbBase64, ...rest } = answer;
						const glb = glbBase64 ? new Uint8Array(Buffer.from(glbBase64, 'base64')) : undefined;
						resolve({
							...rest,
							run: { ...rest.run, glb },
							measurements: { ...rest.measurements, totalMs: performance.now() - started },
						});
					} catch {
						resolve(
							stopped(assetDiagnostic('run.failed', 'run', `The worker exited (${code}) without an answer.`), 'failed'),
						);
					}
				});
				child.stdin.on('error', () => {});
				child.stdin.end(JSON.stringify({ input, budget: context.budget, runMs: context.runMs }));
			});
		},
	};
}
