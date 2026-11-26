import { error, fail } from '@sveltejs/kit';
import { getAuditContext } from '#lib/server/admin/index.ts';
import {
	allowedTriageActions,
	applyTriageAction,
	approveDevelopment,
	approveRelease,
	confirmRelease,
	DEVELOPMENT_AGENTS,
	type DevelopmentAgent,
	type DevelopmentResult,
	deleteFeedback,
	findRelatedFeedback,
	getActiveDevelopmentId,
	getDevelopment,
	getFeedback,
	getFeedbackJourney,
	isEngineeringStatus,
	recordImplementationReport,
	releaseBlockers,
	renderDevelopmentBrief,
	renderReleaseHandoff,
	requestRework,
	returnForAnalysis,
	setTriageNote,
	type TriageAction,
} from '#lib/server/feedback/index.ts';
import { requireAdmin } from '#lib/server/http/guards.ts';
import { VERCEL_GIT_COMMIT_SHA } from '$app/env/private';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	requireAdmin(locals);

	const item = await getFeedback(params.id);
	if (!item) error(404, 'Not Found');

	// Opening an item no longer changes its status: a status records a decision, not a view.
	const [journey, related, development, activeDevelopmentId] = await Promise.all([
		getFeedbackJourney(item.sessionId),
		findRelatedFeedback(item),
		getDevelopment(item.id),
		item.status === 'accepted' ? getActiveDevelopmentId() : Promise.resolve(null),
	]);

	// Both texts are rendered for reading and copying; neither is stored or sent anywhere.
	const brief = development ? renderDevelopmentBrief(item, development) : null;
	const handoff =
		development?.releaseApprovedSha != null
			? renderReleaseHandoff({
					feedbackId: item.id,
					branch: development.branch,
					approvedSha: development.releaseApprovedSha,
					scope: development.scope,
				})
			: null;

	// What in the current report rules a release out; shown instead of the Gate 2 button.
	const blockers = development?.report ? releaseBlockers(development.report) : [];

	return {
		title: `${item.subject || item.id} · Feedback · Admin`,
		releaseBlockers: blockers,
		item,
		journey,
		related,
		allowedActions: allowedTriageActions(item.status),
		canDelete: !isEngineeringStatus(item.status) && development === null,
		development,
		activeDevelopmentId,
		brief,
		handoff,
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

/** A development refusal → the action's failure payload (409: the item's state said no). */
function developmentOutcome(result: DevelopmentResult) {
	if (result.ok) return { ok: true as const };
	return fail(result.refusal === 'not_found' ? 404 : 409, { ...result });
}

const isAgent = (value: string): value is DevelopmentAgent => (DEVELOPMENT_AGENTS as readonly string[]).includes(value);

export const actions: Actions = {
	approveDevelopment: async (event) => {
		const { user } = requireAdmin(event.locals);
		const data = await event.request.formData();
		const agent = String(data.get('agent') ?? '');
		if (!isAgent(agent)) return fail(400, { refusal: 'invalid_branch' as const });
		const result = await approveDevelopment(
			event.params.id,
			{
				scope: String(data.get('scope') ?? ''),
				agent,
				slug: String(data.get('slug') ?? '').trim(),
				includeSubmitterText: data.get('includeSubmitterText') === 'on',
			},
			getAuditContext(user, event.getClientAddress()),
		);
		return developmentOutcome(result);
	},
	recordReport: async (event) => {
		const { user } = requireAdmin(event.locals);
		const paste = String((await event.request.formData()).get('report') ?? '');
		const result = await recordImplementationReport(
			event.params.id,
			paste,
			getAuditContext(user, event.getClientAddress()),
		);
		return developmentOutcome(result);
	},
	approveRelease: async (event) => {
		const { user } = requireAdmin(event.locals);
		const form = await event.request.formData();
		const reviewed = {
			sha: String(form.get('reviewedSha') ?? ''),
			revision: Number(form.get('reviewedRevision') ?? Number.NaN),
		};
		const result = await approveRelease(event.params.id, reviewed, getAuditContext(user, event.getClientAddress()));
		return developmentOutcome(result);
	},
	rework: async (event) => {
		const { user } = requireAdmin(event.locals);
		return developmentOutcome(await requestRework(event.params.id, getAuditContext(user, event.getClientAddress())));
	},
	returnForAnalysis: async (event) => {
		const { user } = requireAdmin(event.locals);
		return developmentOutcome(
			await returnForAnalysis(event.params.id, getAuditContext(user, event.getClientAddress())),
		);
	},
	confirmRelease: async (event) => {
		const { user } = requireAdmin(event.locals);
		const data = await event.request.formData();
		const result = await confirmRelease(
			event.params.id,
			{
				receipt: String(data.get('receipt') ?? ''),
				// The deployment answering this request; absent off Vercel.
				runningSha: VERCEL_GIT_COMMIT_SHA || null,
				maintainerConfirmed: data.get('maintainerConfirmed') === 'on',
			},
			getAuditContext(user, event.getClientAddress()),
		);
		return developmentOutcome(result);
	},
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
