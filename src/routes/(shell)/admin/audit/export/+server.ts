import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { exportAuditLogCsv } from '$lib/server/admin';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user || !locals.session) {
		error(401, 'Authentication required');
	}
	const adminEmail = env.ADMIN_EMAIL;
	if (!adminEmail || locals.user.email.toLowerCase() !== adminEmail.toLowerCase()) {
		error(404, 'Not Found');
	}

	const action = url.searchParams.get('action') || undefined;
	const actor = url.searchParams.get('actor') || undefined;
	const targetType = url.searchParams.get('target_type') || undefined;
	const dateFrom = url.searchParams.get('from') || undefined;
	const dateTo = url.searchParams.get('to') || undefined;

	const csv = await exportAuditLogCsv({ action, actorId: actor, targetType, dateFrom, dateTo });

	return new Response(csv, {
		headers: {
			'Content-Type': 'text/csv',
			'Content-Disposition': 'attachment; filename="audit-log.csv"',
		},
	});
};
