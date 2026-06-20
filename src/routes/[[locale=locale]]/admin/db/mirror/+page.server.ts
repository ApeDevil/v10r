import { fail } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms';
import { valibot } from 'sveltekit-superforms/adapters';
import { startOperationSchema } from '$lib/schemas/dbops/operation';
import { getAuditContext, recordAuditEvent } from '$lib/server/admin';
import { requireAdmin } from '$lib/server/auth/guards';
import { createId } from '$lib/server/db/id';
import { ConflictError, listRuns, NotConfiguredError, RefusedError, startOperation } from '$lib/server/dbops';
import { fetchBranchStatus, neonConfigured, TargetsError } from '$lib/server/neon';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ depends, locals }) => {
	requireAdmin(locals);
	depends('admin:dbops');
	const configured = neonConfigured();
	const form = await superValidate(valibot(startOperationSchema));

	// Resume the monitor if a run is still in flight (e.g. after a reload).
	const recent = configured ? await listRuns(5, null) : [];
	const inFlight = recent.filter((r) => r.status === 'running' || r.status === 'queued');

	return {
		form,
		configured,
		// Streamed: a live Neon Management API call — rendered via {#await}.
		branchStatus: configured ? fetchBranchStatus() : null,
		inFlight,
	};
};

export const actions: Actions = {
	refresh: async (event) => {
		requireAdmin(event.locals);

		const form = await superValidate(event.request, valibot(startOperationSchema));
		if (!form.valid) return fail(400, { form });

		const ctx = getAuditContext(event);
		try {
			const { run } = await startOperation({
				kind: form.data.kind,
				trigger: 'manual',
				actorId: ctx.actorId,
				actorEmail: ctx.actorEmail,
				idempotencyKey: createId.uuid(),
			});
			await recordAuditEvent({
				...ctx,
				action: 'dbops.start',
				targetType: 'dbops_run',
				targetId: run.id,
				detail: { kind: run.kind, trigger: 'manual' },
			});
			return message(form, { ok: true, runId: run.id });
		} catch (err) {
			if (err instanceof NotConfiguredError) {
				return message(form, { ok: false, error: err.message }, { status: 503 });
			}
			if (err instanceof ConflictError) {
				return message(form, { ok: false, error: err.message }, { status: 409 });
			}
			if (err instanceof RefusedError || err instanceof TargetsError) {
				return message(form, { ok: false, error: err.message }, { status: 422 });
			}
			throw err;
		}
	},
};
