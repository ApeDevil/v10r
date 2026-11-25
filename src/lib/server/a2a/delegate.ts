/**
 * Delegating an architecture review to an independent peer agent over A2A.
 *
 * The result is a CLAIM. A peer is another implementation, possibly another organisation's: its
 * findings are what it asserts about the model, not evidence v10r produced or checked. The type
 * says so — `verified` is the literal `false` on every outcome — so no caller can promote a
 * remote finding into a local `ArchitectureFinding` by accident.
 *
 * Bounded on every axis: the peer must pass the A2A peer policy (`peer-policy.ts`) for the card
 * fetch AND for the interface URL the card names, over the shared pinned egress; one deadline
 * covers the whole delegation; every response is size-capped before parsing; a streamed answer
 * is capped in events; malformed findings are dropped and counted (`remote-findings.ts`).
 *
 * Streaming when the card offers it: the first event names the remote task, so a timeout or an
 * abort after that point sends `CancelTask` (its own short budget) and records whether the peer
 * confirmed it. A blocking peer cannot be cancelled — no task id comes back before the answer.
 * Every outcome carries the remote task and context ids it learnt (trace correlation) and, for
 * a refusal, whether the task request may have reached the peer.
 */
import { type AgentCard, type Artifact, type Message, type Part, Role, type Task, TaskState } from '@a2a-js/sdk';
import { type Client, ClientFactory, DefaultAgentCardResolver, JsonRpcTransportFactory } from '@a2a-js/sdk/client';
import type { ExternalDelivery, ExternalRemoteTask } from '#lib/server/external-operations/index.ts';
import { provablyNotSent } from '#lib/server/http/pinned-fetch.ts';
import type { ArchitectureModel } from '#patterns/architecture-engineering/index.ts';
import { A2A_CLIENT_LIMITS, A2A_DELEGATION_DEPTH_KEY } from './config.ts';
import {
	type A2aTransportOptions,
	createA2aPeerFetch,
	type FetchRefusalCode,
	PRE_SEND_REFUSALS,
} from './guarded-fetch.ts';
import { dataPart } from './message-parts.ts';
import { cut, type PeerAgentIdentity, peerAgentIdentity, peerCardDigest } from './peer-card.ts';
import type { PeerPolicy } from './peer-policy.ts';
import { type RemoteFinding, readRemoteFindings } from './remote-findings.ts';

export interface RemoteReviewClaim {
	status: 'claimed';
	/** Never true: a peer's findings are its assertion, not evidence. */
	verified: false;
	peer: string;
	agent: PeerAgentIdentity;
	taskId: string;
	correlation: ExternalRemoteTask;
	findings: RemoteFinding[];
	/** Entries the peer sent that failed validation and were left out. */
	dropped: number;
	summary: string | null;
	/** The peer's report data part, serialized and cut to `A2A_CLIENT_LIMITS.rawChars`. */
	raw: string;
}

/** The peer answered, but did not complete the review (rejected, failed, input-required, …). */
export interface DelegationDeclined {
	status: 'declined';
	verified: false;
	peer: string;
	agent: PeerAgentIdentity;
	correlation: ExternalRemoteTask;
	taskState: string;
	reason: string;
}

export type DelegationRefusalCode =
	| FetchRefusalCode
	| 'timeout'
	| 'aborted'
	| 'transport'
	| 'invalid_answer'
	| 'card_changed'
	| 'skill_not_offered';

/**
 * What became of the remote task after a timeout or abort: the peer confirmed `CancelTask`
 * (`confirmed`), did not (`not_confirmed` — refused, failed, or no answer in time), or no task
 * id was known to cancel (`no_task`).
 */
export type DelegationCancellation = 'confirmed' | 'not_confirmed' | 'no_task';

/** v10r did not get a usable answer: the guard refused, the deadline passed, or the answer was malformed. */
export interface DelegationRefused {
	status: 'refused';
	verified: false;
	peer: string;
	code: DelegationRefusalCode;
	message: string;
	/** Whether the task request (the model) may have reached the peer. */
	delivery: ExternalDelivery;
	correlation: ExternalRemoteTask;
	/** Set after a timeout or abort. */
	cancellation?: DelegationCancellation;
}

export type DelegationOutcome = RemoteReviewClaim | DelegationDeclined | DelegationRefused;

export interface DelegationOptions extends A2aTransportOptions {
	policy: PeerPolicy;
	/** The peer skill to ask for, sent as message metadata `skill`. */
	skill?: string;
	signal?: AbortSignal;
	timeoutMs?: number;
	/** The peer's bearer secret, by the operator's reference; absent for none. */
	bearerSecret?: () => string | undefined;
	/**
	 * The card digest an approval bound (`peerCardDigest`). When set, a card that differs — or
	 * that no longer offers `skill` — refuses the delegation before the task is sent.
	 */
	cardDigest?: string;
}

const MAX_REASON = 500;
const NO_CORRELATION: ExternalRemoteTask = { taskId: null, contextId: null };

function textOf(parts: readonly Part[] | undefined): string | null {
	const text = parts?.find((part) => part.content?.$case === 'text')?.content;
	return text?.$case === 'text' ? text.value : null;
}

function reviewMessage(model: ArchitectureModel, skill: string | undefined): Message {
	return {
		messageId: crypto.randomUUID(),
		contextId: '',
		taskId: '',
		role: Role.ROLE_USER,
		parts: [dataPart(model)],
		metadata: { ...(skill ? { skill } : {}), [A2A_DELEGATION_DEPTH_KEY]: 1 },
		extensions: [],
		referenceTaskIds: [],
	};
}

function isTask(result: Message | Task): result is Task {
	return 'status' in result && 'artifacts' in result;
}

/** Folds a stream into the task it describes; a message-only answer stays a message. */
class StreamedTask {
	task: Task | null = null;
	message: Message | null = null;
	events = 0;
	correlation: ExternalRemoteTask = { ...NO_CORRELATION };

	private learn(taskId: string | undefined, contextId: string | undefined) {
		if (taskId && !this.correlation.taskId) this.correlation.taskId = cut(taskId, 100);
		if (contextId && !this.correlation.contextId) this.correlation.contextId = cut(contextId, 100);
	}

	private ensure(taskId: string, contextId: string): Task {
		this.task ??= { id: taskId, contextId, status: undefined, artifacts: [], history: [], metadata: undefined };
		return this.task;
	}

	add(event: Awaited<ReturnType<Client['sendMessageStream']> extends AsyncGenerator<infer E> ? E : never>) {
		this.events++;
		const payload = event.payload;
		if (!payload) return;
		if (payload.$case === 'task') {
			this.task = payload.value;
			this.learn(payload.value.id, payload.value.contextId);
		} else if (payload.$case === 'statusUpdate') {
			this.learn(payload.value.taskId, payload.value.contextId);
			this.ensure(payload.value.taskId, payload.value.contextId).status = payload.value.status;
		} else if (payload.$case === 'artifactUpdate') {
			this.learn(payload.value.taskId, payload.value.contextId);
			const task = this.ensure(payload.value.taskId, payload.value.contextId);
			const incoming = payload.value.artifact;
			if (!incoming) return;
			const existing = task.artifacts.find((a: Artifact) => a.artifactId === incoming.artifactId);
			if (existing && payload.value.append) existing.parts = [...existing.parts, ...incoming.parts];
			else if (existing) Object.assign(existing, incoming);
			else task.artifacts.push(incoming);
		} else if (payload.$case === 'message') {
			this.message ??= payload.value;
		}
	}
}

function transportFactory(fetchImpl: typeof fetch): ClientFactory {
	// Only the JSON-RPC transport, and only over the guarded fetch: the SDK's default factory
	// options would add a REST transport on the global fetch — an unguarded path to whatever
	// URL the card names.
	return new ClientFactory({ transports: [new JsonRpcTransportFactory({ fetchImpl })] });
}

async function cancelRemoteTask(
	card: AgentCard,
	taskId: string | null,
	options: DelegationOptions,
): Promise<DelegationCancellation> {
	if (!taskId) return 'no_task';
	const guarded = createA2aPeerFetch({
		...options,
		signal: AbortSignal.timeout(A2A_CLIENT_LIMITS.cancelMs),
		responseBytes: A2A_CLIENT_LIMITS.responseBytes,
	});
	try {
		const client = await transportFactory(guarded.fetch).createFromAgentCard(card);
		const task = await client.cancelTask({ tenant: '', id: taskId, metadata: undefined });
		return task.status?.state === TaskState.TASK_STATE_CANCELED ? 'confirmed' : 'not_confirmed';
	} catch {
		return 'not_confirmed';
	}
}

export async function delegateArchitectureReview(
	peer: string,
	model: ArchitectureModel,
	options: DelegationOptions,
): Promise<DelegationOutcome> {
	const deadline = AbortSignal.timeout(options.timeoutMs ?? A2A_CLIENT_LIMITS.timeoutMs);
	const signal = options.signal ? AbortSignal.any([deadline, options.signal]) : deadline;
	const guarded = createA2aPeerFetch({ ...options, signal, responseBytes: A2A_CLIENT_LIMITS.responseBytes });
	const streamed = new StreamedTask();
	const refused = (
		code: DelegationRefusalCode,
		message: string,
		delivery: ExternalDelivery,
		cancellation?: DelegationCancellation,
	): DelegationRefused => ({
		status: 'refused',
		verified: false,
		peer,
		code,
		message: cut(message, MAX_REASON),
		delivery,
		correlation: { ...streamed.correlation },
		...(cancellation ? { cancellation } : {}),
	});

	let card: AgentCard | null = null;
	let agent: PeerAgentIdentity;
	let result: Message | Task;
	let sending = false;
	try {
		card = await new DefaultAgentCardResolver({ fetchImpl: guarded.fetch }).resolve(peer);
		agent = peerAgentIdentity(card);
		if (options.cardDigest !== undefined) {
			if (options.skill && !card.skills?.some((s) => s.id === options.skill)) {
				return refused('skill_not_offered', `the peer card no longer offers ${options.skill}`, 'not_sent');
			}
			if (peerCardDigest(card, options.skill ?? '') !== options.cardDigest) {
				return refused('card_changed', 'the peer card changed since the delegation was approved', 'not_sent');
			}
		}
		const client = await transportFactory(guarded.fetch).createFromAgentCard(card);
		const params = {
			tenant: '',
			message: reviewMessage(model, options.skill),
			configuration: undefined,
			metadata: undefined,
		};
		sending = true;
		if (card.capabilities?.streaming) {
			for await (const event of client.sendMessageStream(params, { signal })) {
				streamed.add(event);
				if (streamed.events > A2A_CLIENT_LIMITS.streamEvents) {
					return refused(
						'invalid_answer',
						`the peer streamed more than ${A2A_CLIENT_LIMITS.streamEvents} events`,
						'sent',
					);
				}
			}
			const answer = streamed.task ?? streamed.message;
			if (!answer) return refused('invalid_answer', 'the peer stream carried no task', 'sent');
			result = answer;
		} else {
			result = await client.sendMessage(params, { signal });
		}
	} catch (error) {
		const refusal = guarded.refusal();
		const timedOut = deadline.aborted;
		const aborted = !timedOut && options.signal?.aborted === true;
		const notSent = !sending || (refusal !== null && PRE_SEND_REFUSALS.has(refusal.code)) || provablyNotSent(error);
		// A redirect or an oversized answer is a response: the request arrived.
		const answered = refusal !== null || streamed.correlation.taskId !== null;
		const delivery: ExternalDelivery = notSent ? 'not_sent' : answered ? 'sent' : 'possibly_sent';
		if (refusal && !(timedOut || aborted)) return refused(refusal.code, refusal.message, delivery);
		if (timedOut || aborted) {
			const cancellation =
				sending && card ? await cancelRemoteTask(card, streamed.correlation.taskId, options) : undefined;
			return timedOut
				? refused('timeout', 'the peer did not answer within the deadline', delivery, cancellation)
				: refused('aborted', 'the delegation was aborted', delivery, cancellation);
		}
		return refused('transport', error instanceof Error ? error.message : String(error), delivery);
	}

	if (!isTask(result)) return refused('invalid_answer', 'the peer answered with a message, not a task', 'sent');
	const correlation: ExternalRemoteTask = {
		taskId: cut(String(result.id ?? ''), 100) || streamed.correlation.taskId,
		contextId: cut(String(result.contextId ?? ''), 100) || streamed.correlation.contextId,
	};
	const state = result.status?.state ?? TaskState.TASK_STATE_UNSPECIFIED;
	if (state !== TaskState.TASK_STATE_COMPLETED) {
		return {
			status: 'declined',
			verified: false,
			peer,
			agent,
			correlation,
			taskState: TaskState[state] ?? 'UNRECOGNIZED',
			reason: cut(textOf(result.status?.message?.parts) ?? 'no reason given', MAX_REASON),
		};
	}

	for (const artifact of result.artifacts ?? []) {
		const data = artifact.parts?.find((part) => part.content?.$case === 'data')?.content;
		if (data?.$case !== 'data') continue;
		const read = readRemoteFindings(data.value);
		if (!read.ok) return { ...refused('invalid_answer', read.message, 'sent'), correlation };
		const summary = textOf(artifact.parts);
		return {
			status: 'claimed',
			verified: false,
			peer,
			agent,
			taskId: correlation.taskId ?? '',
			correlation,
			findings: read.findings,
			dropped: read.dropped,
			summary: summary === null ? null : cut(summary, A2A_CLIENT_LIMITS.findingText),
			raw: cut(JSON.stringify(data.value) ?? '', A2A_CLIENT_LIMITS.rawChars),
		};
	}
	return { ...refused('invalid_answer', 'the completed task carries no data artifact', 'sent'), correlation };
}
