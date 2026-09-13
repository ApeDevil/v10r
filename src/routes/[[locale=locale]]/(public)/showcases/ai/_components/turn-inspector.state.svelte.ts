/**
 * Turn inspector state — which turn is on the page, how it is viewed, which node is open.
 *
 * Two sources, one viewer, one surface: the committed fixtures (`recorded` — rendered
 * signed-out, cost nothing) and the viewer's own turns of that surface (`live` — the
 * persisted trace of a real turn, read through the owner-guarded routes; never a second
 * run). Nothing here is derived from a fixture the server could not have produced: the
 * live path fetches exactly the persisted contract, and a fixture is the same shape written
 * down. A live turn that is not there yet — loading, failed, none picked — shows as exactly
 * that; the fixture never stands in for it.
 *
 * On the chatbot page the inspector FOLLOWS the thread: while a turn streams, its snapshot
 * (the trace on the message, bodies withheld) is the turn on the page; once it finishes, the
 * persisted trace replaces it. A turn the viewer picked by hand stays until they ask to
 * follow again.
 */

import { SvelteSet } from 'svelte/reactivity';
import { apiFetch } from '$lib/api';
import { type TraceMetadata, traceSnapshotOf, turnFinished } from '$lib/components/composites/chatbot/turn-progress';
import {
	ancestorIds,
	expandableIds,
	type InspectedTurn,
	inspectedFromSnapshot,
	inspectorTree,
	NODE_IDS,
	profileDrifted,
	type ThreadMessage,
	type TurnOption,
	turnOptions,
} from '$lib/showcases/ai/inspector';
import { defaultGraphExpanded, graphAncestorIds, type TurnGraph, turnGraph } from '$lib/showcases/ai/turn-graph';
import type { AssistantProfileManifest } from '$lib/types/assistant-profile';
import type { AiSurface } from '$lib/types/db-enums';
import type { TurnSummary, TurnTrace } from '$lib/types/turn-trace';

export type InspectorSource = 'recorded' | 'live';

export type InspectorError = 'auth' | 'rate' | 'failed';

/** How the turn is laid out: the graph, the tree (the accessible alternative), the timing. */
export type InspectorView = 'graph' | 'tree' | 'timeline';

/**
 * Where the live turn stands: `recorded` (a fixture is on the page), `idle` (live source,
 * nothing picked), `streaming` (the snapshot of a running turn), `loading` (reading the
 * persisted trace), `ready`, `error`.
 */
export type InspectorStatus = 'recorded' | 'idle' | 'streaming' | 'loading' | 'ready' | 'error';

/** What the page hands `observeThread()`: the thread's last message, as the singleton shows it. */
export interface ObservedThread {
	conversationId?: string;
	messageId?: string;
	role?: string;
	trace: TraceMetadata | null;
	question: string;
	answer: string;
}

/** A conversation as the picker lists it. */
export interface ConversationOption {
	id: string;
	title: string | null;
	surface: AiSurface | null;
	updatedAt: string;
}

/** The groups open on first render: the request's own facts, not the profile's. */
const INITIAL_EXPANDED = [
	NODE_IDS.group('considered'),
	NODE_IDS.group('prompt'),
	NODE_IDS.group('calls'),
	NODE_IDS.group('proposal'),
];

/** The persisted row lands before the `finish` frame; a miss is read again, briefly. */
export const TURN_READ_RETRY_MS = 500;

type ReadResult<T> = { ok: true; data: T } | { ok: false; error: InspectorError; status: number };

async function readJson<T>(url: string): Promise<ReadResult<T>> {
	try {
		const res = await apiFetch(url);
		if (!res.ok) {
			return {
				ok: false,
				error: res.status === 401 ? 'auth' : res.status === 429 ? 'rate' : 'failed',
				status: res.status,
			};
		}
		const envelope = (await res.json()) as { data: T };
		return { ok: true, data: envelope.data };
	} catch {
		return { ok: false, error: 'failed', status: 0 };
	}
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class TurnInspectorState {
	readonly surface: AiSurface;
	/** The committed fixtures of this surface, in page order; one of them is the recorded source. */
	readonly fixtures: readonly InspectedTurn[];
	fixtureIndex = $state(0);
	source = $state<InspectorSource>('recorded');
	view = $state<InspectorView>('graph');
	selectedId = $state<string | null>(null);
	/** The selected model call (the selector); null reads every call alike. */
	callId = $state<string | null>(null);
	readonly expanded = new SvelteSet<string>(INITIAL_EXPANDED);
	/** The graph's own expansion (documents, omitted groups); the tree's defaults are group ids. */
	readonly graphExpanded = new SvelteSet<string>();

	conversations = $state<ConversationOption[]>([]);
	conversationId = $state('');
	turns = $state<TurnOption[]>([]);
	messageId = $state('');
	live = $state<InspectedTurn | null>(null);
	/** The running turn, from the snapshot on its message; cleared when the persisted read lands. */
	streaming = $state<InspectedTurn | null>(null);
	profile = $state<AssistantProfileManifest | null>(null);
	loading = $state(false);
	retrying = $state(false);
	error = $state<InspectorError | null>(null);
	/** Chatbot page: the inspector tracks the thread's newest turn until the viewer picks one by hand. */
	follow = $state(true);

	#answers = new Map<string, string>();
	/** Every fetch path takes a token; a response whose token is stale is dropped. */
	#request = 0;
	#lastObserved: ObservedThread | null = null;

	constructor(surface: AiSurface, fixtures: readonly InspectedTurn[]) {
		if (fixtures.length === 0) throw new Error('The inspector needs at least one recorded turn');
		this.surface = surface;
		this.fixtures = fixtures;
	}

	/** The fixture the recorded source shows. */
	get recorded(): InspectedTurn {
		return this.fixtures[this.fixtureIndex] ?? (this.fixtures[0] as InspectedTurn);
	}

	/**
	 * The turn on the page: the fixture on the recorded source; on the live source the
	 * running turn, else the loaded one — and null while nothing is there to show.
	 */
	get current(): InspectedTurn | null {
		if (this.source === 'recorded') return this.recorded;
		return this.streaming ?? this.live;
	}

	get status(): InspectorStatus {
		if (this.source === 'recorded') return 'recorded';
		if (this.loading) return 'loading';
		if (this.streaming) return 'streaming';
		if (this.error) return 'error';
		return this.live ? 'ready' : 'idle';
	}

	/** The declared side is today's profile; a turn whose recorded texts differ from it says so. */
	get profileDrift(): boolean {
		const current = this.current;
		return !!current && !!this.profile && profileDrifted(current, this.profile);
	}

	get tree() {
		const current = this.current;
		return current ? inspectorTree(current) : [];
	}

	get graph(): TurnGraph | null {
		const current = this.current;
		return current
			? turnGraph(current.trace, { callId: this.callId, answer: current.answer, profile: current.profile })
			: null;
	}

	/** Selecting reveals: a timeline bar may name a node whose parent is collapsed, in either view. */
	select(id: string | null): void {
		this.selectedId = id;
		if (!id) return;
		for (const ancestor of ancestorIds(this.tree, id)) this.expanded.add(ancestor);
		const graph = this.graph;
		if (graph) for (const ancestor of graphAncestorIds(graph, id)) this.graphExpanded.add(ancestor);
	}

	toggle(id: string): void {
		if (this.expanded.has(id)) this.expanded.delete(id);
		else this.expanded.add(id);
	}

	toggleGraph(id: string): void {
		if (this.graphExpanded.has(id)) this.graphExpanded.delete(id);
		else this.graphExpanded.add(id);
	}

	expandAll(): void {
		for (const id of expandableIds(this.tree)) this.expanded.add(id);
	}

	collapseAll(): void {
		this.expanded.clear();
	}

	/** Open the live source; lists the viewer's conversations on first use. */
	async showLive(): Promise<void> {
		this.source = 'live';
		if (this.conversations.length === 0) await this.loadConversations();
	}

	/** Open the recorded source — one of the fixtures, the current one by default. */
	showRecorded(index = this.fixtureIndex): void {
		this.source = 'recorded';
		this.fixtureIndex = index;
		this.#reset();
	}

	/** The viewer's conversations of this surface (a conversation stamped for the other one is not listed). */
	async loadConversations(): Promise<void> {
		this.loading = true;
		this.error = null;
		const result = await readJson<{ items: ConversationOption[] }>('/api/ai/conversations?pageSize=25');
		this.loading = false;
		if (!result.ok) {
			this.error = result.error;
			return;
		}
		this.conversations = result.data.items.filter((c) => c.surface === null || c.surface === this.surface);
	}

	/** Pick a conversation by hand: lists its recorded turns, then opens the newest one. */
	async pickConversation(id: string): Promise<void> {
		this.follow = false;
		const token = ++this.#request;
		this.conversationId = id;
		this.turns = [];
		this.messageId = '';
		this.live = null;
		this.streaming = null;
		if (!id) return;
		this.loading = true;
		this.error = null;
		const result = await readJson<{ messages: ThreadMessage[]; turns: TurnSummary[] }>(`/api/ai/conversations/${id}`);
		if (token !== this.#request) return;
		this.loading = false;
		if (!result.ok) {
			this.error = result.error;
			return;
		}
		this.#thread(result.data);
		const newest = this.turns[this.turns.length - 1];
		if (newest) await this.pickTurn(newest.messageId);
	}

	/**
	 * Pick a turn: fetches its persisted trace and, once, the viewer's profile of this
	 * surface. A 404 is read again up to `retries` times — the row may still be landing.
	 */
	async pickTurn(messageId: string, retries = 0): Promise<void> {
		const token = ++this.#request;
		this.messageId = messageId;
		this.live = null;
		this.#reset();
		if (!messageId || !this.conversationId) return;
		this.loading = true;
		this.error = null;
		const url = `/api/ai/conversations/${this.conversationId}/turns/${messageId}`;
		let trace = await readJson<TurnTrace>(url);
		for (let attempt = 0; !trace.ok && trace.status === 404 && attempt < retries; attempt++) {
			if (token !== this.#request) return;
			this.retrying = true;
			await wait(TURN_READ_RETRY_MS);
			if (token !== this.#request) return;
			trace = await readJson<TurnTrace>(url);
		}
		const profile = this.profile ? null : await readJson<AssistantProfileManifest>(`/api/ai/profiles/${this.surface}`);
		if (token !== this.#request) return;
		this.loading = false;
		this.retrying = false;
		this.streaming = null;
		if (!trace.ok) {
			this.error = trace.error;
			return;
		}
		if (profile?.ok) this.profile = profile.data;
		// The question and the answer are message rows, not trace fields: read them from the thread.
		this.live = {
			provenance: { kind: 'live', recordedAt: trace.data.createdAt.slice(0, 10) },
			question: this.turns.find((t) => t.messageId === messageId)?.question ?? '',
			answer: this.#answers.get(messageId) ?? '',
			trace: trace.data,
			profile: this.profile,
		};
	}

	/**
	 * Jump straight to one turn by its ids — the "Inspect this turn" link on an answer, or a
	 * turn the thread just finished. The thread is always re-read: a new turn lands in a
	 * conversation that may already be the selected one.
	 */
	async inspect(
		conversationId: string,
		messageId: string,
		options: { follow?: boolean; retries?: number } = {},
	): Promise<void> {
		this.follow = options.follow ?? false;
		this.source = 'live';
		const token = ++this.#request;
		if (this.conversations.length === 0) await this.loadConversations();
		if (token !== this.#request) return;
		this.conversationId = conversationId;
		this.loading = true;
		this.error = null;
		const result = await readJson<{ messages: ThreadMessage[]; turns: TurnSummary[] }>(
			`/api/ai/conversations/${conversationId}`,
		);
		if (token !== this.#request) return;
		if (!result.ok) {
			this.loading = false;
			this.error = result.error;
			return;
		}
		this.#thread(result.data);
		await this.pickTurn(messageId, options.retries ?? 0);
	}

	/**
	 * The chatbot page reports the thread's last message on every change. While following,
	 * a running turn becomes the turn on the page from its snapshot; a finished one — or a
	 * resumed thread's last turn, which carries only its summary — is read from its persisted
	 * trace. A plain method — the page's `$effect` calls it — so the decision is testable
	 * where effects never run.
	 */
	observeThread(observed: ObservedThread): void {
		this.#lastObserved = observed;
		if (!this.follow || this.surface !== 'chatbot') return;
		if (observed.role !== 'assistant' || !observed.conversationId || !observed.messageId || !observed.trace) return;
		const { conversationId, messageId } = observed;
		// A reloaded thread carries the turn's summary, not its snapshot — it exists only for a
		// finished turn, so the persisted trace is what to read.
		const snapshot = traceSnapshotOf(observed.trace);
		if (snapshot && !turnFinished(snapshot)) {
			this.source = 'live';
			if (this.messageId !== messageId) {
				this.#request += 1;
				this.messageId = messageId;
				this.conversationId = conversationId;
				this.live = null;
				this.loading = false;
				this.retrying = false;
				this.error = null;
				this.#reset();
			}
			this.streaming = inspectedFromSnapshot(
				snapshot,
				{ question: observed.question, answer: observed.answer, at: new Date().toISOString() },
				this.profile,
			);
			return;
		}
		const alreadyRead = this.messageId === messageId && (this.live !== null || this.loading);
		if (alreadyRead) return;
		void this.inspect(conversationId, messageId, { follow: true, retries: 3 });
	}

	/** Back to the thread's newest turn. */
	followLatest(): void {
		this.follow = true;
		if (this.#lastObserved) this.observeThread(this.#lastObserved);
	}

	/** A new turn on the page starts with nothing selected and the graph folded. */
	#reset(): void {
		this.selectedId = null;
		this.callId = null;
		this.graphExpanded.clear();
		const graph = this.graph;
		if (graph) for (const id of defaultGraphExpanded(graph)) this.graphExpanded.add(id);
	}

	/** Keep a loaded thread's turn rows of this surface and its assistant texts (the answers) at hand. */
	#thread(conversation: { messages: ThreadMessage[]; turns: TurnSummary[] }): void {
		this.turns = turnOptions(
			conversation.messages,
			conversation.turns.filter((t) => t.surface === this.surface),
		);
		this.#answers.clear();
		for (const message of conversation.messages) {
			if (message.role === 'assistant') this.#answers.set(message.id, message.content);
		}
	}
}
