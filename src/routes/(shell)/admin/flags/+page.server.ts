import { fail } from '@sveltejs/kit';
import * as v from 'valibot';
import { requireAdmin } from '$lib/server/auth/guards';
import { getAllFlags, setFlag, deleteFlag, recordAuditEvent, getAuditContext } from '$lib/server/admin';
import { flagCreateSchema } from '$lib/schemas/admin/flags';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requireAdmin(locals);
	const flags = await getAllFlags();
	return { flags };
};

export const actions: Actions = {
	toggle: async (event) => {
		requireAdmin(event.locals);
		const formData = await event.request.formData();
		const key = formData.get('key');
		const enabled = formData.get('enabled') === 'true';

		if (typeof key !== 'string' || !key) {
			return fail(400, { message: 'Flag key required' });
		}

		const ctx = getAuditContext(event);

		await setFlag(key, enabled, { updatedBy: ctx.actorId });
		await recordAuditEvent({
			...ctx,
			action: 'flag.toggle',
			targetType: 'feature_flag',
			targetId: key,
			detail: { enabled },
		});

		return { success: true, message: `Flag "${key}" ${enabled ? 'enabled' : 'disabled'}.` };
	},

	create: async (event) => {
		requireAdmin(event.locals);
		const formData = await event.request.formData();
		const raw = {
			key: formData.get('key') as string,
			description: (formData.get('description') as string) || undefined,
			enabled: formData.get('enabled') === 'on',
		};

		let data: v.InferOutput<typeof flagCreateSchema>;
		try {
			data = v.parse(flagCreateSchema, raw);
		} catch (e) {
			if (e instanceof v.ValiError) {
				return fail(400, { message: e.issues[0]?.message ?? 'Invalid input' });
			}
			return fail(400, { message: 'Invalid input' });
		}

		const ctx = getAuditContext(event);

		await setFlag(data.key, data.enabled ?? false, {
			description: data.description,
			updatedBy: ctx.actorId,
		});
		await recordAuditEvent({
			...ctx,
			action: 'flag.create',
			targetType: 'feature_flag',
			targetId: data.key,
			detail: { enabled: data.enabled, description: data.description },
		});

		return { success: true, message: `Flag "${data.key}" created.` };
	},

	delete: async (event) => {
		requireAdmin(event.locals);
		const formData = await event.request.formData();
		const key = formData.get('key');

		if (typeof key !== 'string' || !key) {
			return fail(400, { message: 'Flag key required' });
		}

		const ctx = getAuditContext(event);

		await deleteFlag(key);
		await recordAuditEvent({
			...ctx,
			action: 'flag.delete',
			targetType: 'feature_flag',
			targetId: key,
		});

		return { success: true, message: `Flag "${key}" deleted.` };
	},
};
