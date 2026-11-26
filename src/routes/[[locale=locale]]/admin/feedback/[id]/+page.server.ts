import { error, fail } from '@sveltejs/kit';
import { getAuditContext } from '#lib/server/admin/index.ts';
import {
	allowedTriageActions,
	applyTriageAction,
	deleteFeedback,
	findRelatedFeedback,
	getFeedback,
	getFeedbackJourney,
	isEngineeringStatus,
	setTriageNote,
	type TriageAction,
} from '#lib/server/feedback/index.ts';
import { requireAdmin } from '#lib/server/http/guards.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	requireAdmin(locals);

	const item = await getFeedback(params.id);
	if (!item) error(404, 'Not Found');

	// Opening an item no longer changes its status: a status records a decision, not a view.
	const [journey, related] = await Promise.all([getFeedbackJourney(item.sessionId), findRelatedFeedback(item)]);

	return {
		title: `${item.subject || item.id} · Feedback · Admin`,
		item,
		journey,
		related,
		allowedActions: allowedTriageActions(item.status),
		canDelete: !isEngineeringStatus(item.status),
	};
};

/** The posted form → one triage action, or null when the form is malformed. */
function readTriageAction(data: FormData): TriageAction | null {
	const kind = String(data.get('kind') ?? '');
	if (kind === 'accept' || kind === 'defer' || kind === 'reopen') return { kind };
	if (kind === 'close') {
		const reason = String(data.get('reason') ?? '');
		return reason === 'rejected' || reason === 'archived' ? { kind, reason } : null;
	}
	if (kind === 'mark_duplicate') {
		const duplicateOf = String(data.get('duplicateOf') ?? '').trim();
		return duplicateOf ? { kind, duplicateOf } : null;
	}
	return null;
}

export const actions: Actions = {
	transition: async (event) => {
		const { user } = requireAdmin(event.locals);
		const action = readTriageAction(await event.request.formData());
		if (!action) return fail(400, { refusal: 'malformed' as const });
		const result = await applyTriageAction(event.params.id, action, getAuditContext(user, event.getClientAddress()));
		if (!result.ok) return fail(409, { refusal: result.refusal });
		return { ok: true };
	},
	note: async (event) => {
		const { user } = requireAdmin(event.locals);
		const note = String((await event.request.formData()).get('note') ?? '');
		if (note.length > 2000) return fail(400, { refusal: 'note_too_long' as const });
		const result = await setTriageNote(event.params.id, note, getAuditContext(user, event.getClientAddress()));
		if (!result.ok) return fail(404, { refusal: result.refusal });
		return { ok: true, noteSaved: true };
	},
	delete: async (event) => {
		const { user } = requireAdmin(event.locals);
		const result = await deleteFeedback(event.params.id, getAuditContext(user, event.getClientAddress()));
		if (!result.ok) return fail(409, { refusal: result.refusal });
		return { ok: true };
	},
};
