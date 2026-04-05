/**
 * Standardized API response helpers.
 *
 * Success with data:  { data: T }         → 200 or 201
 * Success no content: (empty body)        → 204
 * Error:              { error: { code, message, fields? } }
 *
 * RULE: Never use SvelteKit error() in +server.ts files — it produces
 * { message } shape. Always use these helpers for consistent contracts.
 */
import { json } from '@sveltejs/kit';
import type { BaseIssue } from 'valibot';

export function apiOk<T>(data: T, status = 200) {
	return json({ data }, { status });
}

export function apiCreated<T>(data: T) {
	return json({ data }, { status: 201 });
}

export function apiNoContent() {
	return new Response(null, { status: 204 });
}

export function apiError(
	status: number,
	code: string,
	message: string,
	fields?: Record<string, string>,
) {
	return json(
		{ error: { code, message, ...(fields && { fields }) } },
		{ status },
	);
}

export function apiValidationError(issues: BaseIssue<unknown>[]) {
	const fields: Record<string, string> = {};
	for (const issue of issues) {
		const path = issue.path?.map((p) => p.key).join('.') ?? 'unknown';
		fields[path] = issue.message;
	}
	return apiError(400, 'validation_failed', 'Invalid request.', fields);
}
