/**
 * EXPLORER INTENTS — the optimistic layer of the Explorer tree, as pure functions.
 *
 * The tree the user sees is `foldIntents(confirmed, pending)`: the last server-confirmed
 * nodes with every in-flight intent (a move, an AI-context pin) folded on top in issue
 * order. A failure removes only its own intent and the next read simply does not include
 * it, so rollback is exact even when later intents on the same node already landed. The
 * capture-and-restore it replaces ("remember the parent before the move, put it back on
 * failure") discarded a later confirmed move whenever an earlier one failed after it.
 * The pattern and its reasoning: `docs/blueprint/velocity/interaction.md`, "Optimistic
 * mutation"; the generic single-value form is `$lib/state/optimistic.svelte.ts`.
 *
 * Two rules the generic form does not have, because a tree of independently-moved nodes
 * needs them:
 *
 * - Supersession. Intents with the same `target` (node + kind) are ordered by `seq`. When
 *   one confirms, the earlier ones on that target stop folding — the later issue is what
 *   the user asked for last. If one of those earlier intents then ALSO reports success,
 *   the client cannot know which write the server applied last (the per-owner advisory
 *   lock serializes them, but not necessarily in issue order), so `confirmIntent` reports
 *   it `superseded` and the caller re-reads the server.
 * - Cycle safety. A fold of a SUBSET of intents (one failed) can describe a tree no drag
 *   ever validated — e.g. a child moved out, its old parent moved under it, then the first
 *   move fails. A move that would make a node its own ancestor is skipped by the fold, so
 *   the displayed tree is always a forest and ancestor walks terminate.
 *
 * Every function here is pure and copy-on-write; intents are matched by `seq`, never by
 * object reference (a `$state` proxy of an intent is not `===` the intent).
 */
import type { ExplorerNode } from './node';

/** What the user asked for, before the state numbers it. */
export type ExplorerIntentInput =
	| { kind: 'move'; nodeId: string; parentId: string | null }
	| { kind: 'ai-context'; nodeId: string; aiContext: boolean };

/** `seq` is monotonic per state: issue order, and the identity intents are matched by. */
export type ExplorerIntent = ExplorerIntentInput & { seq: number };

export type ExplorerNodeMap = ReadonlyMap<string, ExplorerNode>;

/** Two intents compete when they set the same field of the same node. */
function sameTarget(a: Pick<ExplorerIntent, 'kind' | 'nodeId'>, b: Pick<ExplorerIntent, 'kind' | 'nodeId'>): boolean {
	return a.kind === b.kind && a.nodeId === b.nodeId;
}

/** True when `ancestorId` is `nodeId` itself or above it. Bounded, so a malformed input cannot hang it. */
function isSelfOrAncestor(nodes: ExplorerNodeMap, ancestorId: string, nodeId: string | null): boolean {
	let current = nodeId;
	for (let steps = 0; current !== null && steps <= nodes.size; steps++) {
		if (current === ancestorId) return true;
		current = nodes.get(current)?.parentId ?? null;
	}
	return false;
}

/** True when applying the intent to `nodes` would change nothing — the duplicate-submit guard. */
export function isNoOpIntent(nodes: ExplorerNodeMap, intent: ExplorerIntentInput): boolean {
	const node = nodes.get(intent.nodeId);
	if (!node) return true;
	if (intent.kind === 'move') return node.parentId === intent.parentId;
	return (node.aiContext ?? false) === intent.aiContext;
}

/** Apply one intent. Returns `nodes` itself when the intent cannot apply (missing node, cycle). */
export function applyIntent(nodes: ExplorerNodeMap, intent: ExplorerIntentInput): ExplorerNodeMap {
	const node = nodes.get(intent.nodeId);
	if (!node) return nodes;
	let next: ExplorerNode;
	if (intent.kind === 'move') {
		if (node.parentId === intent.parentId) return nodes;
		if (isSelfOrAncestor(nodes, node.id, intent.parentId)) return nodes;
		next = { ...node, parentId: intent.parentId };
	} else {
		if ((node.aiContext ?? false) === intent.aiContext) return nodes;
		next = { ...node, aiContext: intent.aiContext };
	}
	const copy = new Map(nodes);
	copy.set(node.id, next);
	return copy;
}

/** The displayed tree: confirmed nodes with the pending intents applied in issue order. */
export function foldIntents(confirmed: ExplorerNodeMap, pending: readonly ExplorerIntent[]): ExplorerNodeMap {
	return pending.reduce<ExplorerNodeMap>((nodes, intent) => applyIntent(nodes, intent), confirmed);
}

export interface IntentSettlement {
	confirmed: ExplorerNodeMap;
	pending: ExplorerIntent[];
}

/**
 * The server accepted intent `seq`. It moves into `confirmed`, and it plus every earlier
 * intent on the same target leave the fold. `superseded` means the intent had already
 * left the fold because a LATER intent on its target confirmed first — nothing is
 * applied, and the caller should re-read the server, which alone knows the final order.
 */
export function confirmIntent(
	confirmed: ExplorerNodeMap,
	pending: readonly ExplorerIntent[],
	seq: number,
): IntentSettlement & { superseded: boolean } {
	const intent = pending.find((p) => p.seq === seq);
	if (!intent) return { confirmed, pending: [...pending], superseded: true };
	return {
		confirmed: applyIntent(confirmed, intent),
		pending: pending.filter((p) => !(p.seq <= seq && sameTarget(p, intent))),
		superseded: false,
	};
}

/** The server refused intent `seq`. Dropping it is the whole rollback. */
export function rejectIntent(pending: readonly ExplorerIntent[], seq: number): ExplorerIntent[] {
	return pending.filter((p) => p.seq !== seq);
}
