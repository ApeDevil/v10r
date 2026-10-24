/**
 * Ask before leaving a page that still holds work that would be lost — and only then.
 *
 * One `beforeNavigate` covers both doors: an in-app navigation gets a `confirm`, and a
 * navigation that leaves the document (`type === 'leave'`: closing the tab, reloading, an
 * external link) is cancelled, which makes the browser show its own unload prompt. No
 * `beforeunload` listener of our own, so nothing extra keeps the page out of the bfcache.
 *
 * Pass the predicate for work that would really be lost. A form whose draft was saved
 * (`form-draft.svelte.ts`) loses nothing on leave, so its predicate is "tainted AND the draft
 * write failed" — a prompt that guards nothing is friction people learn to click through.
 */
import { beforeNavigate } from '$app/navigation';

export type LeaveDecision = 'allow' | 'cancel';

/** The decision itself, framework-free so it can be tested without a router. */
export function leaveDecision(dirty: boolean, type: string, confirmLeave: () => boolean): LeaveDecision {
	if (!dirty) return 'allow';
	if (type === 'leave') return 'cancel';
	return confirmLeave() ? 'allow' : 'cancel';
}

export function guardUnsavedChanges(isDirty: () => boolean, message: () => string): void {
	beforeNavigate((navigation) => {
		// A shallow navigation stays on the page, edits and all.
		if (navigation.shallow) return;
		if (leaveDecision(isDirty(), navigation.type, () => window.confirm(message())) === 'cancel') {
			navigation.cancel();
		}
	});
}
