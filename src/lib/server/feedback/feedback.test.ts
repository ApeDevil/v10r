/**
 * Feedback domain — the public write path behind the FeedbackBand CTA.
 *
 * Real PGlite so the nonce idempotency (partial-unique + onConflictDoNothing)
 * and the count()::int aggregations run the actual SQL, not mocks.
 */
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { feedback } from '$lib/server/db/schema/feedback';

let testClient: PGlite;

vi.mock('$lib/server/db', async () => {
	const { createTestDb } = await import('$lib/server/test/db');
	const { db, client } = await createTestDb();
	testClient = client;
	return { db };
});

// Dynamic imports AFTER the mock declaration: `./index` imports `$lib/server/db`
// at module scope, so a static import would run the (hoisted) mock factory
// before `testClient` is initialized — the retention.test.ts pattern.
const { db } = await import('$lib/server/db');
const { getFeedbackCounts, listFeedback, setFeedbackStatus, submitFeedback } = await import('./index');

afterAll(async () => {
	await testClient?.close();
});

function input(overrides: Partial<Parameters<typeof submitFeedback>[0]> = {}) {
	return {
		subject: 'A subject',
		body: 'A body',
		rating: null,
		contactEmail: null,
		pageOfOrigin: '',
		sessionId: null,
		nonce: crypto.randomUUID(),
		...overrides,
	};
}

beforeEach(async () => {
	await db.delete(feedback);
});

describe('submitFeedback — nonce idempotency', () => {
	it('a replayed nonce returns the ORIGINAL id with deduplicated=true and inserts no second row', async () => {
		const nonce = crypto.randomUUID();
		const first = await submitFeedback(input({ nonce }));
		const second = await submitFeedback(input({ nonce, subject: 'Different content, same nonce' }));

		expect(first.deduplicated).toBe(false);
		expect(second.deduplicated).toBe(true);
		expect(second.id).toBe(first.id);

		const rows = await db.select().from(feedback);
		expect(rows).toHaveLength(1);
		expect(rows[0].subject).toBe('A subject');
	});

	it('distinct nonces create distinct rows', async () => {
		await submitFeedback(input());
		await submitFeedback(input());
		expect(await db.select().from(feedback)).toHaveLength(2);
	});
});

describe('listFeedback — limit/offset clamping', () => {
	beforeEach(async () => {
		await submitFeedback(input({ subject: 'one' }));
		await submitFeedback(input({ subject: 'two' }));
		await submitFeedback(input({ subject: 'three' }));
	});

	it('clamps a non-positive limit to 1 and an oversized limit to 200', async () => {
		const low = await listFeedback({ limit: -5 });
		expect(low.limit).toBe(1);
		expect(low.items).toHaveLength(1);

		const zero = await listFeedback({ limit: 0 });
		expect(zero.limit).toBe(1);

		const high = await listFeedback({ limit: 500 });
		expect(high.limit).toBe(200);
		expect(high.items).toHaveLength(3);
	});

	it('clamps a negative offset to 0 and reports the full total', async () => {
		const res = await listFeedback({ offset: -1 });
		expect(res.offset).toBe(0);
		expect(res.total).toBe(3);
		expect(res.items).toHaveLength(3);
	});
});

/** Drizzle wraps driver errors; the violated constraint's name lives on the
 * pg error one level down the `.cause` chain, never in `err.message`. */
function violatedConstraint(e: unknown): string | null {
	let current: unknown = e;
	for (let depth = 0; depth < 5 && current; depth++) {
		if (typeof current === 'object' && current !== null) {
			const name =
				(current as { constraint?: unknown; constraint_name?: unknown }).constraint ??
				(current as { constraint_name?: unknown }).constraint_name;
			if (typeof name === 'string') return name;
			current = (current as { cause?: unknown }).cause;
		} else {
			break;
		}
	}
	return null;
}

describe('DB CHECK backstops — the constraints hold even when valibot is bypassed', () => {
	it('rejects an overlong subject at the database layer', async () => {
		const err = await db
			.insert(feedback)
			.values({
				id: 'fb_check_subject',
				subject: 'x'.repeat(121),
				body: 'body',
				pageOfOrigin: '',
				nonce: crypto.randomUUID(),
			})
			.then(() => null)
			.catch((e: unknown) => e);
		expect(violatedConstraint(err)).toBe('feedback_subject_len');
	});

	it('rejects an overlong page_of_origin and applies its DB default', async () => {
		const err = await db
			.insert(feedback)
			.values({
				id: 'fb_check_source',
				subject: 'ok',
				body: 'body',
				pageOfOrigin: `/${'a'.repeat(600)}`,
				nonce: crypto.randomUUID(),
			})
			.then(() => null)
			.catch((e: unknown) => e);
		expect(violatedConstraint(err)).toBe('feedback_source_len');

		// Omitting pageOfOrigin entirely uses the DB default '' — no NOT NULL trap.
		await db.insert(feedback).values({
			id: 'fb_check_default',
			subject: 'ok',
			body: 'body',
			nonce: crypto.randomUUID(),
		});
		const [row] = await db.select().from(feedback);
		expect(row.pageOfOrigin).toBe('');
	});
});

describe('getFeedbackCounts — zero-fill', () => {
	it('reports zero for every status on an empty table', async () => {
		expect(await getFeedbackCounts()).toEqual({ new: 0, read: 0, archived: 0 });
	});

	it('counts by status and keeps absent statuses at zero', async () => {
		const { id } = await submitFeedback(input());
		await submitFeedback(input());
		await setFeedbackStatus(id, 'read');

		expect(await getFeedbackCounts()).toEqual({ new: 1, read: 1, archived: 0 });
	});
});
