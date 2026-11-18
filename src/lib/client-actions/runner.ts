/**
 * Client action runner — the client half of the client action contract (`./contract.ts`).
 *
 * Framework-free: it knows contracts, handlers and results, nothing about Svelte, the Desk
 * or how a call arrived. An interface registers a handler while the thing the handler
 * operates is mounted and takes it back when it unmounts; `available()` is therefore the
 * truthful list of what this client can do right now, and it is what the client advertises
 * with each turn. The agent can only be offered — and can only reach — a registered,
 * validated operation. There is no "run this script" and no selector-driven DOM access.
 *
 * `run()` never rejects and never throws: every way a call can go wrong is a
 * `ClientActionResult` with a status and a code, so the model always gets an honest answer.
 */
import * as v from 'valibot';
import { type ClientActionContract, type ClientActionResult, parseClientActionResult } from './contract';

/** What a handler is given beside its validated input. */
export interface ClientActionRun {
	/** Aborted when the call times out: stop work whose result nobody will read. */
	signal: AbortSignal;
}

export type ClientActionHandler<TInput = unknown> = (
	input: TInput,
	run: ClientActionRun,
) => ClientActionResult | Promise<ClientActionResult>;

/** One call as the agent issued it. `callId` is the tool call's id — the dedup key. */
export interface ClientActionRequest {
	callId: string;
	name: string;
	input: unknown;
}

export interface ClientActionRunner {
	/** Mount a handler for a declared action. Returns the function that takes it back. */
	register<TInput>(contract: ClientActionContract<TInput>, handler: ClientActionHandler<TInput>): () => void;
	/** The actions that have a handler mounted right now, in contract order. */
	available(): string[];
	/** Execute one call. A `callId` seen before returns the first run's result — never a second run. */
	run(request: ClientActionRequest): Promise<ClientActionResult>;
}

export interface ClientActionRunnerOptions {
	/**
	 * How long a call waits for its handler to be mounted before it is `unavailable`. A
	 * layout move unmounts and remounts the owning component within a frame; a call that
	 * lands in that gap should not be reported as a missing capability.
	 */
	handlerWaitMs?: number;
}

/** Results kept for dedup. A turn issues a handful of calls; this only bounds a long session. */
const REMEMBERED_CALLS = 200;

export function createClientActionRunner(
	contracts: readonly ClientActionContract[],
	options: ClientActionRunnerOptions = {},
): ClientActionRunner {
	const handlerWaitMs = options.handlerWaitMs ?? 0;
	const byName = new Map(contracts.map((contract) => [contract.name, contract]));
	const handlers = new Map<string, ClientActionHandler>();
	const waiters = new Map<string, Set<() => void>>();
	const settled = new Map<string, Promise<ClientActionResult>>();

	function awaitHandler(name: string): Promise<ClientActionHandler | null> {
		const mounted = handlers.get(name);
		if (mounted || handlerWaitMs <= 0) return Promise.resolve(mounted ?? null);
		return new Promise((resolve) => {
			const waiting = waiters.get(name) ?? new Set();
			waiters.set(name, waiting);
			const done = () => {
				clearTimeout(timer);
				waiting.delete(done);
				resolve(handlers.get(name) ?? null);
			};
			const timer = setTimeout(done, handlerWaitMs);
			waiting.add(done);
		});
	}

	async function execute(request: ClientActionRequest): Promise<ClientActionResult> {
		const contract = byName.get(request.name);
		if (!contract) {
			return {
				status: 'unavailable',
				code: 'unknown_action',
				message: `"${request.name.slice(0, 60)}" is not a client action. Known: ${[...byName.keys()].join(', ')}.`,
			};
		}
		// Validate before looking for a handler: a malformed call is refused whether or not
		// anything could have run it, and a handler only ever sees input its contract accepts.
		const input = v.safeParse(contract.input, request.input);
		if (!input.success) {
			return {
				status: 'refused',
				code: 'invalid_input',
				message:
					`Invalid input for ${contract.name}: ${input.issues[0]?.message ?? 'does not match the contract'}`.slice(
						0,
						300,
					),
			};
		}
		const handler = await awaitHandler(contract.name);
		if (!handler) {
			return {
				status: 'unavailable',
				code: 'no_handler',
				message: `Nothing in the interface can run ${contract.name} right now.`,
			};
		}

		const abort = new AbortController();
		let timer: ReturnType<typeof setTimeout> | undefined;
		const timeout = new Promise<ClientActionResult>((resolve) => {
			timer = setTimeout(() => {
				abort.abort();
				resolve({
					status: 'timed_out',
					code: 'timeout',
					message: `${contract.name} did not finish within ${contract.timeoutMs} ms; the interface state is unknown.`,
				});
			}, contract.timeoutMs);
		});
		try {
			// The handler's answer is read through the contract too: a handler that returns
			// something else has not reported a result.
			const ran = Promise.resolve()
				.then(() => handler(input.output, { signal: abort.signal }))
				.then(parseClientActionResult);
			return await Promise.race([ran, timeout]);
		} catch (err) {
			return {
				status: 'failed',
				code: 'handler_error',
				message: (err instanceof Error ? err.message : String(err)).slice(0, 300),
			};
		} finally {
			clearTimeout(timer);
		}
	}

	return {
		register(contract, handler) {
			if (byName.get(contract.name) !== contract) {
				throw new Error(`Client action "${contract.name}" is not declared on this runner.`);
			}
			handlers.set(contract.name, handler as ClientActionHandler);
			for (const wake of [...(waiters.get(contract.name) ?? [])]) wake();
			return () => {
				// A remount registers the new handler before the old cleanup runs; only the
				// handler that is still the mounted one is taken back.
				if (handlers.get(contract.name) === handler) handlers.delete(contract.name);
			};
		},

		available() {
			return contracts.filter((contract) => handlers.has(contract.name)).map((contract) => contract.name);
		},

		run(request) {
			const seen = settled.get(request.callId);
			if (seen) return seen;
			const result = execute(request);
			settled.set(request.callId, result);
			if (settled.size > REMEMBERED_CALLS) {
				const oldest = settled.keys().next().value;
				if (oldest !== undefined) settled.delete(oldest);
			}
			return result;
		},
	};
}
