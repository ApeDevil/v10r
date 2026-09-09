/**
 * Optimistic mutation — apply the intent now, reconcile with the server after.
 *
 * The wait a user actually feels is the gap between acting and seeing the result, not
 * the round trip behind it. For a rename, a toggle, a reorder or a move, the outcome
 * is predictable, failure is uncommon and the change is reversible — so the interface
 * can show it immediately and let the authoritative write catch up.
 *
 * WHAT MUST NEVER GO THROUGH HERE: payments, deletions that cannot be undone,
 * permission and security changes, or anything whose server-side outcome the client
 * cannot predict. Authorization is never optimistic — the server stays the authority
 * and a rollback that "restores" a privilege the user never had is worse than a wait.
 * This module cannot tell those cases apart; the call site can, which is why the
 * judgement lives there.
 *
 * The confirmed value and the pending intents are stored SEPARATELY, and what the UI
 * reads is the fold of one over the other. That is what makes rollback exact: a
 * failed mutation is removed from the list and the next read simply does not include
 * it, even when later mutations were applied on top of it. Keeping a mutated copy and
 * trying to undo it in place is where optimistic UIs drift permanently out of sync.
 *
 * `apply` is therefore re-run on every read and MUST be pure — no fetches, no
 * mutation of `base`, no dependence on when it runs.
 *
 * Note for anyone changing the pending list: `$state.raw` is not an optimisation here,
 * it is the correctness of the rollback. See the field's own comment — and note that the
 * unit suite cannot catch a regression on it, because vitest's node environment does not
 * reproduce the proxying. That one is a browser check.
 *
 * Duplicate protection is the `key`. Two mutations with the same key are the same
 * intent: the second joins the first instead of running again, so a double-clicked
 * button, a retried submit and a replayed action all execute once.
 */

export type OptimisticStatus = 'idle' | 'pending' | 'error';

export interface OptimisticMutation<T> {
	/**
	 * Stable identity for this intent — the client-side idempotency key.
	 *
	 * Derive it from what the mutation MEANS (`rename:file-7`), not from when it was
	 * issued: a timestamp makes every double-click a distinct intent, which is exactly
	 * the thing this prevents. Pass the same value as the request's idempotency header
	 * and the protection extends across the network.
	 */
	key: string;
	/** Produce the optimistic value from the confirmed one. Pure; re-run on every read. */
	apply: (base: T) => T;
	/**
	 * The authoritative write.
	 *
	 * Resolve with the server's confirmed value to reconcile against it — that is how a
	 * server-assigned id replaces a temporary one. Resolve with nothing to accept the
	 * optimistic value as confirmed.
	 */
	// `undefined` cannot express this: the common case is `async () => {}`, whose type is
	// Promise<void>, and it would not typecheck against Promise<T | undefined>.
	// biome-ignore lint/suspicious/noConfusingVoidType: "resolve with nothing" is the contract
	commit: () => Promise<T | void>;
}

export type OptimisticOutcome = { ok: true } | { ok: false; error: Error };

interface PendingIntent<T> {
	/** Monotonic within one OptimisticValue. Identity by primitive, never by object reference. */
	seq: number;
	key: string;
	apply: (base: T) => T;
}

/** Temporary client-side id for a row the server has not assigned one to yet. */
export function temporaryId(prefix = 'tmp'): string {
	return `${prefix}_${crypto.randomUUID()}`;
}

export function isTemporaryId(id: string): boolean {
	return /^[a-z0-9-]+_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export class OptimisticValue<T> {
	/** Last value the server confirmed. Never speculative. */
	#base = $state.raw<T>(undefined as T);
	/**
	 * `$state.raw`, not `$state`, and the distinction is load-bearing.
	 *
	 * A deep `$state` proxies the array AND the intents inside it, so an intent read back
	 * out is a PROXY of the object that went in, and `p !== intent` is true for the very
	 * entry it is meant to match. The intent then never leaves the list: it keeps folding
	 * on top of a base that has already absorbed it, and a successful toggle lands back
	 * where it started. Svelte only warns (`state_proxy_equality_mismatch`) and the code
	 * runs on, which is the worst kind of failure — this was caught in a browser, not by
	 * the unit tests.
	 *
	 * The list is always REPLACED, never mutated in place, so raw is the honest
	 * declaration anyway. Entries are matched by `seq` regardless: identity by a primitive
	 * survives a future change of mind about the rune.
	 */
	#pending = $state.raw<PendingIntent<T>[]>([]);
	#nextSeq = 0;
	#error = $state<Error | null>(null);
	/** Key → in-flight commit, so the same intent is never executed twice. */
	#inFlight = new Map<string, Promise<OptimisticOutcome>>();

	constructor(initial: T) {
		this.#base = initial;
	}

	/** What the interface shows: confirmed state with every pending intent folded on top. */
	get current(): T {
		return this.#pending.reduce((value, intent) => intent.apply(value), this.#base);
	}

	/** What the server last confirmed, with nothing speculative applied. */
	get confirmed(): T {
		return this.#base;
	}

	get status(): OptimisticStatus {
		if (this.#pending.length > 0) return 'pending';
		return this.#error ? 'error' : 'idle';
	}

	/** The last failure, until the next mutation starts. Null when nothing has failed. */
	get error(): Error | null {
		return this.#error;
	}

	/** Keys of the intents currently in flight — for per-row pending affordances. */
	get pendingKeys(): string[] {
		return this.#pending.map((intent) => intent.key);
	}

	isPending(key: string): boolean {
		return this.#inFlight.has(key);
	}

	/**
	 * Replace the confirmed value — a fresh load, an invalidation, a pushed update.
	 *
	 * Pending intents are deliberately KEPT and re-folded on top. A reconcile that
	 * dropped them would make an in-flight rename flicker back to the old name the
	 * moment an unrelated refresh landed.
	 */
	reconcile(next: T): void {
		this.#base = next;
	}

	/** Discard the recorded failure without touching state. */
	clearError(): void {
		this.#error = null;
	}

	async mutate(mutation: OptimisticMutation<T>): Promise<OptimisticOutcome> {
		const running = this.#inFlight.get(mutation.key);
		if (running) return running;

		this.#error = null;
		const intent: PendingIntent<T> = { seq: this.#nextSeq++, key: mutation.key, apply: mutation.apply };
		this.#pending = [...this.#pending, intent];

		const settle = (async (): Promise<OptimisticOutcome> => {
			try {
				const confirmed = await mutation.commit();
				// Fold the intent into the base BEFORE dropping it from the pending list, so
				// `current` never briefly loses the change between the two assignments.
				this.#base = confirmed === undefined ? mutation.apply(this.#base) : (confirmed as T);
				this.#pending = this.#pending.filter((p) => p.seq !== intent.seq);
				return { ok: true };
			} catch (cause) {
				// Rollback: dropping the intent is the whole undo. Later intents stay applied
				// because they are folded over the unchanged base.
				this.#pending = this.#pending.filter((p) => p.seq !== intent.seq);
				const error = cause instanceof Error ? cause : new Error(String(cause));
				this.#error = error;
				return { ok: false, error };
			} finally {
				this.#inFlight.delete(mutation.key);
			}
		})();

		this.#inFlight.set(mutation.key, settle);
		return settle;
	}
}
