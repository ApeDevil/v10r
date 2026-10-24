/**
 * Unsaved work: what exists only on this device and a sign-out would destroy.
 *
 * The server answers sign-out with `Clear-Site-Data: "cache", "cookies", "storage"`
 * (hooks.server.ts), which erases localStorage — and localStorage is exactly where the
 * spreadsheet keeps the drafts it could not save yet. So the interactive sign-out (the
 * user menu) runs three steps around `signOutAndFlush`:
 *
 * 1. drain — try to deliver every source's work, bounded by `DRAIN_TIMEOUT_MS`;
 * 2. confirm — whatever is still unsaved is named in the sign-out dialog, and the user
 *    either cancels (stays signed in, work kept) or discards it explicitly;
 * 3. discard — after a successful sign-out each source erases its local copy, so a shared
 *    device is clean even where a browser ignores `Clear-Site-Data` (the header stays as
 *    the backstop).
 *
 * Forced exits never come here. A revoked or expired session sends the user to the login
 * page without a sign-out request, so no `Clear-Site-Data` arrives and nothing is
 * discarded: the drafts stay under that user's key and the spreadsheet offers them for
 * recovery after the same user signs in again. There is no choice to offer there, and
 * keeping the work is the reversible default.
 *
 * Sources load on demand: this module sits in the shell on every page, and a sign-out on
 * a page that never opened the desk must still see what an earlier page left in storage.
 */
export interface UnsavedWork {
	/** Try to deliver the work; settles once every attempt has. */
	drain(): Promise<void>;
	/** Items that would still be lost now — 0 means nothing to lose. */
	count(): number;
	/** Erase this device's copy. Only ever called after a successful sign-out. */
	discard(): void;
}

type UnsavedWorkSource = (userId: string) => Promise<UnsavedWork>;

const SOURCES: readonly UnsavedWorkSource[] = [
	(userId) =>
		import('#lib/components/desk/panels/spreadsheet/spreadsheet-unsaved-work.ts').then((source) =>
			source.spreadsheetUnsavedWork(userId),
		),
];

/** Long enough for a normal save round-trip; short enough that the dialog never feels stuck. */
export const DRAIN_TIMEOUT_MS = 3000;

/** A source that fails to load is skipped: sign-out must stay possible. */
export async function collectUnsavedWork(
	userId: string,
	sources: readonly UnsavedWorkSource[] = SOURCES,
): Promise<UnsavedWork[]> {
	const loaded = await Promise.allSettled(sources.map((source) => source(userId)));
	return loaded.flatMap((result) => {
		if (result.status === 'fulfilled') return [result.value];
		console.warn('[unsaved-work] source failed to load:', result.reason);
		return [];
	});
}

export function countUnsavedWork(work: readonly UnsavedWork[]): number {
	return work.reduce((total, source) => total + source.count(), 0);
}

/** Drain every source, waiting at most `timeoutMs`; returns what is still unsaved. */
export async function drainUnsavedWork(work: readonly UnsavedWork[], timeoutMs = DRAIN_TIMEOUT_MS): Promise<number> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const deadline = new Promise<void>((resolve) => {
		timer = setTimeout(resolve, timeoutMs);
	});
	try {
		// Microtask start: a drain that throws synchronously is a failed attempt, not a crash.
		const drains = work.map((source) => Promise.resolve().then(() => source.drain()));
		await Promise.race([Promise.allSettled(drains), deadline]);
	} finally {
		clearTimeout(timer);
	}
	return countUnsavedWork(work);
}

/**
 * The confirm click proceeds only when the user has been shown at least what is unsaved
 * now. Work can appear between dialog and click (another tab's save just failed); then
 * the dialog is shown again with the new count instead of signing out.
 */
export function signOutVerdict(unsaved: number, acknowledged: number): 'proceed' | 'confirm' {
	return unsaved > acknowledged ? 'confirm' : 'proceed';
}

/** Cleanup must never block the sign-out that already happened. */
export function discardUnsavedWork(work: readonly UnsavedWork[]): void {
	for (const source of work) {
		try {
			source.discard();
		} catch (err) {
			console.warn('[unsaved-work] discard failed:', err);
		}
	}
}
