/**
 * Running the golden set against a live dev server. The turn is obtained through the same
 * owner-guarded routes the app and `scripts/ai/record-turn-fixture.ts` use — POST the
 * question to the surface's endpoint, then read the conversation and the recorded turn
 * trace — so an eval grades exactly what a user's turn would record. Nothing here reaches
 * the database or a provider directly; credentials stay with the running server.
 *
 * A case may script follow-up turns in the same conversation (`followUps`): typed text, or a
 * Button press on the surface the thread shows (`surface-press.ts` builds the press the
 * browser would send, with a fresh event id). Each follow-up sends the persisted thread back
 * as its history, the way the chat client does, and is graded on its own recorded turn.
 *
 * Alias-free (`scripts/ai/eval.ts` runs it under bare Bun).
 */
import type { TurnSummary, TurnTrace } from '../../../types/turn-trace';
import type { EvalCase, FollowUp } from './eval-case';
import { type GradedTurn, renderedSurfaceIds } from './graders';
import { type CaseResult, failedCase, type Scorecard, scoreCase, scorecard } from './scorecard';
import { historyOf, type StoredThreadMessage, scriptedSurfacePress } from './surface-press';

/** Obtains the recorded turns a case produces: the question's, then one per follow-up. */
export interface EvalClient {
	turnsFor(evalCase: EvalCase): Promise<GradedTurn[]>;
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

type Thread = { messages: StoredThreadMessage[]; turns: TurnSummary[] };

export function createHttpEvalClient({
	base,
	cookie,
	fetchImpl = fetch,
	keep = false,
	sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}: HttpEvalClientOptions): EvalClient {
	const root = base.replace(/\/$/, '');
	const post = (surface: string, body: unknown) =>
		fetchImpl(`${root}/api/ai/${surface}`, {
			method: 'POST',
			headers: { cookie, origin: root, 'X-Requested-With': 'sveltekit', 'content-type': 'application/json' },
			body: JSON.stringify(body),
		});

	/** The thread once a turn after `turnsBefore` has been recorded, and that turn's trace. */
	async function recordedTurn(conversationId: string, evalCase: EvalCase, turnsBefore: number) {
		let thread: Thread = { messages: [], turns: [] };
		let messageId: string | undefined;
		for (let attempt = 0; attempt < TURN_READ_ATTEMPTS && !messageId; attempt++) {
			if (attempt > 0) await sleep(TURN_READ_DELAY_MS);
			thread = await fetchEnvelope<Thread>(root, `/api/ai/conversations/${conversationId}`, cookie, fetchImpl);
			const turns = thread.turns.filter((t) => t.surface === evalCase.surface);
			messageId = turns.length > turnsBefore ? turns.at(-1)?.messageId : undefined;
		}
		if (!messageId) throw new Error(`Conversation ${conversationId} recorded no new ${evalCase.surface} turn.`);
		const trace = await fetchEnvelope<TurnTrace>(
			root,
			`/api/ai/conversations/${conversationId}/turns/${messageId}`,
			cookie,
			fetchImpl,
		);
		return { thread, turn: { answer: thread.messages.find((m) => m.id === messageId)?.content ?? '', trace } };
	}

	/** One scripted follow-up: the request body it sends, and the press it made, if any. */
	function followUpRequest(followUp: FollowUp, conversationId: string, thread: Thread) {
		const history = historyOf(thread.messages);
		if (followUp.question !== undefined) {
			const message = { id: crypto.randomUUID(), role: 'user', parts: [{ type: 'text', text: followUp.question }] };
			return { body: { conversationId, messages: [...history, message] }, press: null };
		}
		const press = scriptedSurfacePress(thread.messages, followUp.press ?? {});
		if (!press) throw new Error(`No Button declaring "${followUp.press?.event ?? 'any event'}" is on screen.`);
		const message = {
			id: crypto.randomUUID(),
			role: 'user',
			parts: [{ type: 'data-surface-action', data: press }],
		};
		return { body: { conversationId, messages: [...history, message], surfaceAction: press }, press };
	}

	return {
		async turnsFor(evalCase) {
			// A fresh conversation per case: no case grades another's history.
			const res = await post(evalCase.surface, {
				messages: [{ id: crypto.randomUUID(), role: 'user', parts: [{ type: 'text', text: evalCase.question }] }],
				...evalCase.request,
			});
			if (!res.ok)
				throw new Error(`POST /api/ai/${evalCase.surface} → ${res.status} ${await res.text().catch(() => '')}`);
			// The turn is persisted when the stream ends; drain it before reading the trace.
			await res.text();
			const conversationId = res.headers.get('X-Conversation-Id');
			if (!conversationId) throw new Error('The response carried no X-Conversation-Id.');

			try {
				const first = await recordedTurn(conversationId, evalCase, 0);
				const turns: GradedTurn[] = [first.turn];
				let thread = first.thread;
				const shown = new Set(renderedSurfaceIds(first.turn));
				for (const followUp of evalCase.followUps ?? []) {
					const { body, press } = followUpRequest(followUp, conversationId, thread);
					const next = await post(evalCase.surface, body);
					if (!next.ok)
						throw new Error(
							`follow-up ${turns.length + 1}: POST → ${next.status} ${await next.text().catch(() => '')}`,
						);
					await next.text();
					const recorded = await recordedTurn(conversationId, evalCase, turns.length);
					// A network retry: the same request, same event id. It must start no turn.
					let repeatedPress: { status: number; body: string } | undefined;
					if (press && followUp.press?.resend) {
						const again = await post(evalCase.surface, body);
						repeatedPress = { status: again.status, body: await again.text().catch(() => '') };
					}
					turns.push({ ...recorded.turn, conversation: { shownSurfaceIds: [...shown], repeatedPress } });
					for (const id of renderedSurfaceIds(recorded.turn)) shown.add(id);
					thread = recorded.thread;
				}
				return turns;
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
			results.push(scoreCase(evalCase, await client.turnsFor(evalCase)));
		} catch (err) {
			results.push(failedCase(evalCase, err instanceof Error ? err.message : String(err)));
		}
	}
	return scorecard(results);
}
