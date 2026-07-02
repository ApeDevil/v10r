import { streamAuditLogCsv } from '$lib/server/admin';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { apiError } from '$lib/server/api/response';
import { requireAdmin } from '$lib/server/auth/guards';
import type { RequestHandler } from './$types';

// The audit log is an unbounded growth table; stream the export so it bypasses
// Vercel's 4.5MB buffered-body cap and has time to finish.
export const config = { runtime: 'nodejs22.x', maxDuration: 60 };

const limiter = createLimiter('rl:admin:audit-export', 10, '1 m');

export const GET: RequestHandler = async ({ url, locals }) => {
	const { user } = requireAdmin(locals);

	const { success, reset } = await limiter.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const action = url.searchParams.get('action') || undefined;
	const actor = url.searchParams.get('actor') || undefined;
	const targetType = url.searchParams.get('target_type') || undefined;
	const dateFrom = url.searchParams.get('from') || undefined;
	const dateTo = url.searchParams.get('to') || undefined;

	if (dateFrom && !/^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) {
		return apiError(400, 'invalid_date', 'Invalid from date format. Use YYYY-MM-DD.');
	}
	if (dateTo && !/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
		return apiError(400, 'invalid_date', 'Invalid to date format. Use YYYY-MM-DD.');
	}

	const iterator = streamAuditLogCsv({ action, actorId: actor, targetType, dateFrom, dateTo })[Symbol.asyncIterator]();
	const encoder = new TextEncoder();
	const stream = new ReadableStream<Uint8Array>({
		async pull(controller) {
			const { value, done } = await iterator.next();
			if (done) {
				controller.close();
				return;
			}
			controller.enqueue(encoder.encode(value));
		},
		async cancel() {
			await iterator.return?.(undefined);
		},
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': 'attachment; filename="audit-log.csv"',
			'Cache-Control': 'no-store',
		},
	});
};
