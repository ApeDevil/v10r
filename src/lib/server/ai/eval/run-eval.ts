/**
 * Running the golden set against a live dev server. The turn is obtained through the same
 * owner-guarded routes the app and `scripts/ai/record-turn-fixture.ts` use — POST the
 * question to the surface's endpoint, then read the conversation and the recorded turn
 * trace — so an eval grades exactly what a user's turn would record. Nothing here reaches
 * the database or a provider directly; credentials stay with the running server.
 *
 * Alias-free (`scripts/ai/eval.ts` runs it under bare Bun).
 */
import type { TurnSummary, TurnTrace } from '../../../types/turn-trace';
import type { EvalCase } from './eval-case';
import type { GradedTurn } from './graders';
import { type CaseResult, failedCase, type Scorecard, scoreCase, scorecard } from './scorecard';

/** Obtains the recorded turn a case's question produces. */
export interface EvalClient {
	turnFor(evalCase: EvalCase): Promise<GradedTurn>;
}

export interface HttpEvalClientOptions {
	base: string;
	cookie: string;
	fetchImpl?: typeof fetch;
	/** Keep each case's conversation instead of deleting it after grading. */
	keep?: boolean;
	/** How long to wait between reads while a failed turn's trace is still being persisted. */
	sleep?: (ms: number) => Promise<void>;
}

/** A turn that ends in an error persists its trace after the response; read a few times. */
const TURN_READ_ATTEMPTS = 5;
const TURN_READ_DELAY_MS = 400;

/** A `{ data }` envelope route of the app, as the signed-in session. */
export async function fetchEnvelope<T>(
	base: string,
	path: string,
	cookie: string,
	fetchImpl: typeof fetch = fetch,
): Promise<T> {
	const res = await fetchImpl(`${base}${path}`, {
		headers: { cookie, 'X-Requested-With': 'sveltekit', accept: 'application/json' },
	});
	if (!res.ok) throw new Error(`GET ${path} → ${res.status} ${await res.text().catch(() => '')}`);
	return ((await res.json()) as { data: T }).data;
}

export function createHttpEvalClient({
	base,
	cookie,
	fetchImpl = fetch,
	keep = false,
	sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}: HttpEvalClientOptions): EvalClient {
	const root = base.replace(/\/$/, '');
	return {
		async turnFor(evalCase) {
			// A fresh conversation per case: no case grades another's history.
			const res = await fetchImpl(`${root}/api/ai/${evalCase.surface}`, {
				method: 'POST',
				headers: {
					cookie,
					origin: root,
					'X-Requested-With': 'sveltekit',
					'content-type': 'application/json',
				},
				body: JSON.stringify({
					messages: [{ id: crypto.randomUUID(), role: 'user', parts: [{ type: 'text', text: evalCase.question }] }],
					...evalCase.request,
				}),
			});
			if (!res.ok)
				throw new Error(`POST /api/ai/${evalCase.surface} → ${res.status} ${await res.text().catch(() => '')}`);
			// The turn is persisted when the stream ends; drain it before reading the trace.
			await res.text();
			const conversationId = res.headers.get('X-Conversation-Id');
			if (!conversationId) throw new Error('The response carried no X-Conversation-Id.');

			try {
				type Thread = { messages: { id: string; content: string }[]; turns: TurnSummary[] };
				let thread: Thread = { messages: [], turns: [] };
				let messageId: string | undefined;
				for (let attempt = 0; attempt < TURN_READ_ATTEMPTS && !messageId; attempt++) {
					if (attempt > 0) await sleep(TURN_READ_DELAY_MS);
					thread = await fetchEnvelope<Thread>(root, `/api/ai/conversations/${conversationId}`, cookie, fetchImpl);
					messageId = thread.turns.filter((t) => t.surface === evalCase.surface).at(-1)?.messageId;
				}
				if (!messageId) throw new Error(`Conversation ${conversationId} recorded no ${evalCase.surface} turn.`);
				const trace = await fetchEnvelope<TurnTrace>(
					root,
					`/api/ai/conversations/${conversationId}/turns/${messageId}`,
					cookie,
					fetchImpl,
				);
				return { answer: thread.messages.find((m) => m.id === messageId)?.content ?? '', trace };
			} finally {
				// Every case opens a conversation and an account holds a capped number; an eval run
				// must not use them up. Best effort — a failed delete never fails the case.
				if (!keep) {
					await fetchImpl(`${root}/api/ai/conversations/${conversationId}`, {
						method: 'DELETE',
						headers: { cookie, origin: root, 'X-Requested-With': 'sveltekit' },
					}).catch(() => undefined);
				}
			}
		},
	};
}

/** Every case in order; a case whose turn cannot be obtained fails with the reason, the run goes on. */
export async function runEval(cases: readonly EvalCase[], client: EvalClient): Promise<Scorecard> {
	const results: CaseResult[] = [];
	for (const evalCase of cases) {
		try {
			results.push(scoreCase(evalCase, await client.turnFor(evalCase)));
		} catch (err) {
			results.push(failedCase(evalCase, err instanceof Error ? err.message : String(err)));
		}
	}
	return scorecard(results);
}
