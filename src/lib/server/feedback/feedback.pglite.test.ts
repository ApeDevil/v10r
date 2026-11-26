/**
 * Feedback domain — the public write path behind the FeedbackBand CTA.
 *
 * Real PGlite so the nonce idempotency (partial-unique + onConflictDoNothing)
 * and the count()::int aggregations run the actual SQL, not mocks.
 */
import type { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { FEEDBACK_STATUSES } from '#lib/feedback/status.ts';
import { adminAuditLog } from '#lib/server/db/schema/admin/index.ts';
import { user } from '#lib/server/db/schema/auth/_better-auth.ts';
import { ACTIVE_DEVELOPMENT_STATUSES, feedback } from '#lib/server/db/schema/feedback/index.ts';

let testClient: PGlite;

vi.mock('#lib/server/db/index.ts', async () => {
	const { createTestDb } = await import('#lib/server/test/db.ts');
	const { db, client } = await createTestDb();
	testClient = client;
	return { db };
});

// Dynamic imports AFTER the mock declaration: `./index` imports `#lib/server/db/index.ts`
// at module scope, so a static import would run the (hoisted) mock factory
// before `testClient` is initialized — the retention.pglite.test.ts pattern.
const { db } = await import('#lib/server/db/index.ts');
const {
	applyTriageAction,
	deleteFeedback,
	findRelatedFeedback,
	getFeedbackCounts,
	INBOX_CAPACITY,
	STORAGE_CEILING,
	listFeedback,
	listOwnFeedback,
	purgeClosedFeedback,
	setTriageNote,
	submitFeedback,
} = await import('./index');

afterAll(async () => {
	await testClient?.close();
});

type SubmitInput = Parameters<typeof submitFeedback>[0];

function input(overrides: Partial<SubmitInput> = {}): SubmitInput {
	return {
		category: 'general',
		subject: 'A subject',
		body: 'A body',
		rating: null,
		contactEmail: null,
		userId: null,
		technicalContext: null,
		nonce: crypto.randomUUID(),
		...overrides,
	};
}

/** Submit and return the new id — every caller here expects the inbox to accept. */
async function submit(overrides: Partial<SubmitInput> = {}): Promise<string> {
	const result = await submitFeedback(input(overrides));
	if (!result.ok) throw new Error(`refused: ${result.refusal}`);
	return result.id;
}

const ADMIN = { actorId: 'usr_admin', actorEmail: 'admin@example.com', ipAddress: '203.0.113.9' };

beforeEach(async () => {
	await db.delete(adminAuditLog);
	await db.delete(feedback);
	await db.delete(user);
});

describe('submitFeedback — nonce idempotency', () => {
	it('a replayed nonce returns the ORIGINAL id with deduplicated=true and inserts no second row', async () => {
		const nonce = crypto.randomUUID();
		const first = await submitFeedback(input({ nonce }));
		const second = await submitFeedback(input({ nonce, subject: 'Different content, same nonce' }));

		expect(first).toMatchObject({ ok: true, deduplicated: false });
		expect(second).toMatchObject({ ok: true, deduplicated: true });
		expect(second.ok && first.ok && second.id === first.id).toBe(true);

		const rows = await db.select().from(feedback);
		expect(rows).toHaveLength(1);
		expect(rows[0].subject).toBe('A subject');
	});

	it('distinct nonces create distinct rows', async () => {
		await submit();
		await submit();
		expect(await db.select().from(feedback)).toHaveLength(2);
	});
});

describe('listFeedback — limit/offset clamping', () => {
	beforeEach(async () => {
		await submit({ subject: 'one' });
		await submit({ subject: 'two' });
		await submit({ subject: 'three' });
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
	it('reports zero for every lifecycle state on an empty table', async () => {
		const counts = await getFeedbackCounts();
		expect(Object.keys(counts)).toHaveLength(8);
		expect(Object.values(counts).every((n) => n === 0)).toBe(true);
	});

	it('counts by status and keeps absent statuses at zero', async () => {
		const id = await submit();
		await submit();
		await applyTriageAction(id, { kind: 'accept' }, ADMIN);

		const counts = await getFeedbackCounts();
		expect(counts.received).toBe(1);
		expect(counts.accepted).toBe(1);
		expect(counts.closed).toBe(0);
	});
});

describe('submitFeedback — what is stored is what the submitter chose', () => {
	it('stores no technical context at all when the box was unticked', async () => {
		const id = await submit({ technicalContext: null, category: 'bug' });
		const [row] = await db.select().from(feedback).where(eq(feedback.id, id));
		expect(row).toMatchObject({
			category: 'bug',
			status: 'received',
			pageOfOrigin: '',
			routeId: null,
			appVersion: null,
			errorId: null,
			sessionId: null,
		});
	});

	it('stores exactly the context fields when ticked, blanks as null', async () => {
		const id = await submit({
			technicalContext: {
				pageOfOrigin: '/blog/x',
				routeId: '/blog/[slug]',
				appVersion: 'abc123',
				errorId: '',
				sessionId: 's1',
			},
		});
		const [row] = await db.select().from(feedback).where(eq(feedback.id, id));
		expect(row).toMatchObject({
			pageOfOrigin: '/blog/x',
			routeId: '/blog/[slug]',
			appVersion: 'abc123',
			errorId: null,
			sessionId: 's1',
		});
	});

	it('refuses new submissions once INBOX_CAPACITY items wait untriaged', async () => {
		await db.insert(feedback).values(
			Array.from({ length: INBOX_CAPACITY }, (_, i) => ({
				id: `fbk_cap_${i}`,
				subject: 's',
				body: 'b',
				nonce: crypto.randomUUID(),
			})),
		);
		expect(await submitFeedback(input())).toEqual({ ok: false, refusal: 'inbox_full' });

		// Triaging one frees a place.
		await applyTriageAction('fbk_cap_0', { kind: 'accept' }, ADMIN);
		expect((await submitFeedback(input())).ok).toBe(true);
	});

	it('refuses new submissions at STORAGE_CEILING whatever state the stored items are in', async () => {
		await db.insert(feedback).values(
			Array.from({ length: STORAGE_CEILING }, (_, i) => ({
				id: `fbk_store_${i}`,
				subject: 's',
				body: 'b',
				status: 'accepted' as const,
				nonce: crypto.randomUUID(),
			})),
		);
		expect(await submitFeedback(input())).toEqual({ ok: false, refusal: 'inbox_full' });
		await deleteFeedback('fbk_store_0', ADMIN);
		expect((await submitFeedback(input())).ok).toBe(true);
	});
});

describe('listOwnFeedback — My feedback', () => {
	it('lists only the account’s own rows, with the coarse submitter status', async () => {
		await db.insert(user).values([
			{ id: 'usr_a', name: 'a', email: 'a@example.com' },
			{ id: 'usr_b', name: 'b', email: 'b@example.com' },
		]);
		const mine = await submit({ userId: 'usr_a', subject: 'mine' });
		await submit({ userId: 'usr_b', subject: 'theirs' });
		await submit({ subject: 'anonymous' });
		await applyTriageAction(mine, { kind: 'defer' }, ADMIN);

		const list = await listOwnFeedback('usr_a');
		expect(list.total).toBe(1);
		expect(list.items).toEqual([expect.objectContaining({ id: mine, subject: 'mine', status: 'considering' })]);
		expect(list.items[0]).not.toHaveProperty('triageNote');
	});
});

async function auditRows() {
	return db.select().from(adminAuditLog).orderBy(adminAuditLog.occurredAt);
}

describe('applyTriageAction — transitions, audit, races', () => {
	it('moves through the triage states and audits each transition with ids and states only', async () => {
		const id = await submit({ subject: 'Secret subject', body: 'Secret body words' });
		expect(await applyTriageAction(id, { kind: 'defer' }, ADMIN)).toEqual({
			ok: true,
			from: 'received',
			to: 'deferred',
		});
		expect(await applyTriageAction(id, { kind: 'accept' }, ADMIN)).toEqual({
			ok: true,
			from: 'deferred',
			to: 'accepted',
		});
		expect(await applyTriageAction(id, { kind: 'close', reason: 'rejected' }, ADMIN)).toEqual({
			ok: true,
			from: 'accepted',
			to: 'closed',
		});
		const [closed] = await db.select().from(feedback).where(eq(feedback.id, id));
		expect(closed).toMatchObject({ status: 'closed', closeReason: 'rejected' });

		expect(await applyTriageAction(id, { kind: 'reopen' }, ADMIN)).toEqual({
			ok: true,
			from: 'closed',
			to: 'received',
		});
		const [reopened] = await db.select().from(feedback).where(eq(feedback.id, id));
		expect(reopened).toMatchObject({ status: 'received', closeReason: null, duplicateOf: null });

		const rows = await auditRows();
		expect(rows.map((r) => r.action)).toEqual([
			'feedback.defer',
			'feedback.accept',
			'feedback.close',
			'feedback.reopen',
		]);
		expect(rows.every((r) => r.targetId === id && r.actorId === ADMIN.actorId)).toBe(true);
		const serialized = JSON.stringify(rows);
		expect(serialized).not.toContain('Secret');
	});

	it('refuses a transition from a state the action does not start from, and writes nothing', async () => {
		const id = await submit();
		expect(await applyTriageAction(id, { kind: 'reopen' }, ADMIN)).toEqual({
			ok: false,
			refusal: 'invalid_transition',
			current: 'received',
		});
		expect(await auditRows()).toHaveLength(0);
	});

	it('a double click changes the row once and leaves one audit entry', async () => {
		const id = await submit();
		const first = await applyTriageAction(id, { kind: 'accept' }, ADMIN);
		const second = await applyTriageAction(id, { kind: 'accept' }, ADMIN);
		expect(first.ok).toBe(true);
		expect(second).toEqual({ ok: false, refusal: 'invalid_transition', current: 'accepted' });
		expect(await auditRows()).toHaveLength(1);
	});

	// PGlite has one connection, so the two transactions run one after the other: this pins
	// the from-state check each one makes after taking its lock. On Postgres the `FOR UPDATE`
	// lock is what makes the second wait for the first and then see the new state.
	it('two concurrent, mutually exclusive decisions on one item: exactly one wins', async () => {
		const original = await submit();
		const id = await submit();
		const results = await Promise.all([
			applyTriageAction(id, { kind: 'close', reason: 'archived' }, ADMIN),
			applyTriageAction(id, { kind: 'mark_duplicate', duplicateOf: original }, ADMIN),
		]);
		expect(results.filter((r) => r.ok)).toHaveLength(1);
		expect(await auditRows()).toHaveLength(1);
	});

	it('refuses to touch an item in development — triage cannot free the slot', async () => {
		const id = await submit();
		await db.update(feedback).set({ status: 'in_development' }).where(eq(feedback.id, id));
		for (const action of [
			{ kind: 'close', reason: 'rejected' },
			{ kind: 'defer' },
			{ kind: 'reopen' },
			{ kind: 'accept' },
		] as const) {
			expect(await applyTriageAction(id, action, ADMIN)).toMatchObject({ ok: false, refusal: 'invalid_transition' });
		}
	});

	it('reports a missing item', async () => {
		expect(await applyTriageAction('fbk_missing', { kind: 'accept' }, ADMIN)).toEqual({
			ok: false,
			refusal: 'not_found',
		});
	});
});

describe('mark_duplicate — consistent links, no chains', () => {
	it('links to an existing original and records reason duplicate', async () => {
		const original = await submit();
		const dup = await submit();
		expect((await applyTriageAction(dup, { kind: 'mark_duplicate', duplicateOf: original }, ADMIN)).ok).toBe(true);
		const [row] = await db.select().from(feedback).where(eq(feedback.id, dup));
		expect(row).toMatchObject({ status: 'closed', closeReason: 'duplicate', duplicateOf: original });
	});

	it('refuses a missing target, itself, and a target that is itself a duplicate', async () => {
		const a = await submit();
		const b = await submit();
		const c = await submit();
		await applyTriageAction(b, { kind: 'mark_duplicate', duplicateOf: a }, ADMIN);
		for (const target of ['fbk_missing', c, b]) {
			expect(await applyTriageAction(c, { kind: 'mark_duplicate', duplicateOf: target }, ADMIN)).toEqual({
				ok: false,
				refusal: 'invalid_duplicate_target',
			});
		}
	});

	it('refuses to make an original into a duplicate: no chains, so no cycles', async () => {
		const a = await submit();
		const b = await submit();
		const c = await submit();
		await applyTriageAction(b, { kind: 'mark_duplicate', duplicateOf: a }, ADMIN);
		// a → c would make b → a → c a chain; c → b is refused as b is a duplicate.
		expect(await applyTriageAction(a, { kind: 'mark_duplicate', duplicateOf: c }, ADMIN)).toEqual({
			ok: false,
			refusal: 'has_duplicates',
		});
		// a → b would close the cycle a ↔ b.
		expect(await applyTriageAction(a, { kind: 'mark_duplicate', duplicateOf: b }, ADMIN)).toMatchObject({ ok: false });
		const links = await db.select({ id: feedback.id, duplicateOf: feedback.duplicateOf }).from(feedback);
		expect(links.filter((row) => row.duplicateOf !== null)).toEqual([{ id: b, duplicateOf: a }]);
	});

	it('reopening a duplicate clears its link; the original can then become a duplicate', async () => {
		const a = await submit();
		const b = await submit();
		const c = await submit();
		await applyTriageAction(b, { kind: 'mark_duplicate', duplicateOf: a }, ADMIN);
		expect(await applyTriageAction(b, { kind: 'reopen' }, ADMIN)).toMatchObject({ ok: true, to: 'received' });
		const [reopened] = await db.select().from(feedback).where(eq(feedback.id, b));
		expect(reopened).toMatchObject({ status: 'received', closeReason: null, duplicateOf: null });
		expect(await applyTriageAction(a, { kind: 'mark_duplicate', duplicateOf: c }, ADMIN)).toMatchObject({ ok: true });
	});

	it('deleting the original leaves the duplicate closed as a duplicate with no target', async () => {
		const original = await submit();
		const dup = await submit();
		await applyTriageAction(dup, { kind: 'mark_duplicate', duplicateOf: original }, ADMIN);
		expect(await deleteFeedback(original, ADMIN)).toEqual({ ok: true });
		const [row] = await db.select().from(feedback).where(eq(feedback.id, dup));
		expect(row).toMatchObject({ status: 'closed', closeReason: 'duplicate', duplicateOf: null });
	});
});

describe('the single development slot', () => {
	it('the database refuses a second item in any active development state', async () => {
		const a = await submit();
		const b = await submit();
		const c = await submit();
		await db.update(feedback).set({ status: 'in_development' }).where(eq(feedback.id, a));
		// Iterates the code list, so the index's literal predicate cannot drift from it.
		for (const status of ACTIVE_DEVELOPMENT_STATUSES) {
			const err = await db
				.update(feedback)
				.set({ status })
				.where(eq(feedback.id, b))
				.then(() => null)
				.catch((e: unknown) => e);
			expect(violatedConstraint(err)).toBe('feedback_one_active_development_idx');
		}
		// Every other state stays outside the slot.
		for (const status of FEEDBACK_STATUSES) {
			if ((ACTIVE_DEVELOPMENT_STATUSES as readonly string[]).includes(status)) continue;
			const closeReason = status === 'closed' ? ('archived' as const) : null;
			await db.update(feedback).set({ status, closeReason }).where(eq(feedback.id, b));
			await db.update(feedback).set({ status, closeReason }).where(eq(feedback.id, c));
		}
	});
});

describe('deleteFeedback and purgeClosedFeedback', () => {
	it('refuses to delete an item holding engineering state', async () => {
		const id = await submit();
		for (const status of ['in_development', 'released'] as const) {
			await db.update(feedback).set({ status }).where(eq(feedback.id, id));
			expect(await deleteFeedback(id, ADMIN)).toEqual({ ok: false, refusal: 'engineering_state', current: status });
		}
		expect(await db.select().from(feedback)).toHaveLength(1);
	});

	it('purges only closed rows whose last change is older than the window, and audits once', async () => {
		const oldClosed = await submit();
		const recentClosed = await submit();
		const oldOpen = await submit();
		await applyTriageAction(oldClosed, { kind: 'close', reason: 'archived' }, ADMIN);
		await applyTriageAction(recentClosed, { kind: 'close', reason: 'rejected' }, ADMIN);
		const longAgo = new Date(Date.now() - 400 * 86_400_000);
		await db.update(feedback).set({ statusChangedAt: longAgo }).where(eq(feedback.id, oldClosed));
		await db.update(feedback).set({ statusChangedAt: longAgo }).where(eq(feedback.id, oldOpen));
		await db.delete(adminAuditLog);

		expect(await purgeClosedFeedback(ADMIN)).toEqual({ deleted: 1 });
		const ids = (await db.select({ id: feedback.id }).from(feedback)).map((r) => r.id).sort();
		expect(ids).toEqual([recentClosed, oldOpen].sort());
		const rows = await auditRows();
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ action: 'feedback.purge', detail: expect.objectContaining({ deleted: 1 }) });

		// Nothing left to purge: no second audit row.
		expect(await purgeClosedFeedback(ADMIN)).toEqual({ deleted: 0 });
		expect(await auditRows()).toHaveLength(1);
	});
});

describe('setTriageNote', () => {
	it('saves, audits the length only, and ignores an unchanged note', async () => {
		const id = await submit();
		expect(await setTriageNote(id, '  Customer quoted: hello  ', ADMIN)).toEqual({ ok: true, changed: true });
		expect(await setTriageNote(id, 'Customer quoted: hello', ADMIN)).toEqual({ ok: true, changed: false });
		const rows = await auditRows();
		expect(rows).toHaveLength(1);
		expect(JSON.stringify(rows)).not.toContain('hello');
		const [row] = await db.select().from(feedback).where(eq(feedback.id, id));
		expect(row.triageNote).toBe('Customer quoted: hello');
	});

	it('rejects an overlong note at the database layer', async () => {
		const id = await submit();
		const err = await setTriageNote(id, 'x'.repeat(2001), ADMIN)
			.then(() => null)
			.catch((e: unknown) => e);
		expect(violatedConstraint(err)).toBe('feedback_note_len');
	});
});

describe('findRelatedFeedback — deterministic duplicate hints', () => {
	it('finds shared subject words and the same error reference, never itself or closed duplicates', async () => {
		const item = await submit({ subject: 'Navigation overflows on mobile' });
		const wordMatch = await submit({ subject: 'Mobile menu is cut off' });
		const errorMatch = await submit({
			subject: 'Something broke',
			technicalContext: { pageOfOrigin: '', routeId: '', appVersion: '', errorId: 'err-42', sessionId: null },
		});
		const unrelated = await submit({ subject: 'Love the colors' });
		const closedDup = await submit({ subject: 'Mobile navigation again' });
		await applyTriageAction(closedDup, { kind: 'mark_duplicate', duplicateOf: wordMatch }, ADMIN);

		const related = await findRelatedFeedback({
			id: item,
			subject: 'Navigation overflows on mobile',
			errorId: 'err-42',
		});
		const ids = related.map((r) => r.id);
		expect(ids).toContain(wordMatch);
		expect(ids).toContain(errorMatch);
		expect(ids).not.toContain(item);
		expect(ids).not.toContain(unrelated);
		expect(ids).not.toContain(closedDup);
		expect(related.find((r) => r.id === errorMatch)?.sameError).toBe(true);
	});
});
