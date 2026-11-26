/**
 * The one-time production change `scripts/db/changes/feedback-lifecycle.sql`, run against
 * the table as it stands on `main` before Slice 1 (the old three-label status enum), with
 * rows in every old state. Two claims: every existing row survives with the mapped status,
 * and the migrated table is structurally the table the Drizzle schema builds — same columns,
 * defaults, constraints, indexes and enum labels — so the next `db:push` finds no drift.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb } from '#lib/server/test/db.ts';

const MIGRATION = readFileSync(join(process.cwd(), 'scripts/db/changes/feedback-lifecycle.sql'), 'utf8');

/** `feedback.feedback` exactly as the schema on main (50da2f7) creates it. */
const MAIN_SHAPE = `
CREATE SCHEMA auth;
CREATE TABLE auth."user" (id text PRIMARY KEY);
CREATE SCHEMA feedback;
CREATE TYPE feedback.feedback_status AS ENUM ('new', 'read', 'archived');
CREATE TABLE feedback.feedback (
	id text PRIMARY KEY NOT NULL,
	subject text NOT NULL,
	body text NOT NULL,
	rating smallint,
	contact_email text,
	page_of_origin text DEFAULT '' NOT NULL,
	session_id text,
	status feedback.feedback_status DEFAULT 'new' NOT NULL,
	submitted_at timestamp with time zone DEFAULT now() NOT NULL,
	nonce text NOT NULL,
	CONSTRAINT feedback_rating_range CHECK (rating IS NULL OR (rating BETWEEN 1 AND 5)),
	CONSTRAINT feedback_subject_len CHECK (char_length(subject) <= 120),
	CONSTRAINT feedback_body_len CHECK (char_length(body) <= 4000),
	CONSTRAINT feedback_source_len CHECK (char_length(page_of_origin) <= 512)
);
CREATE UNIQUE INDEX feedback_nonce_idx ON feedback.feedback USING btree (nonce);
CREATE INDEX feedback_status_submitted_idx ON feedback.feedback USING btree (status, submitted_at);
CREATE INDEX feedback_submitted_idx ON feedback.feedback USING btree (submitted_at);
`;

const COLUMNS = `
	SELECT column_name, data_type, udt_name, is_nullable, column_default
	FROM information_schema.columns WHERE table_schema = 'feedback' AND table_name = 'feedback'
	ORDER BY column_name`;
const CONSTRAINTS = `
	SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
	WHERE conrelid = 'feedback.feedback'::regclass ORDER BY conname`;
const INDEXES = `
	SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'feedback' AND tablename = 'feedback'
	ORDER BY indexname`;
const ENUMS = `
	SELECT t.typname, string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder) AS labels
	FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid JOIN pg_namespace n ON n.oid = t.typnamespace
	WHERE n.nspname = 'feedback' GROUP BY t.typname ORDER BY t.typname`;

let migrated: PGlite;
let reference: PGlite;

beforeAll(async () => {
	migrated = new PGlite();
	await migrated.exec(MAIN_SHAPE);
	await migrated.exec(`
		INSERT INTO feedback.feedback (id, subject, body, contact_email, session_id, status, nonce) VALUES
			('fbk_new', 'New one', 'body', 'a@example.com', 's1', 'new', 'n1'),
			('fbk_read', 'Read one', 'body', NULL, NULL, 'read', 'n2'),
			('fbk_archived', 'Archived one', 'body', NULL, NULL, 'archived', 'n3');
	`);
	await migrated.exec(MIGRATION);
	reference = (await createTestDb()).client;
	// Catalog functions print type names relative to the search_path; compare like with like.
	const { rows } = await reference.query<{ search_path: string }>('SHOW search_path');
	await migrated.exec(`SET search_path TO ${rows[0].search_path}`);
});

afterAll(async () => {
	await migrated?.close();
	await reference?.close();
});

describe('feedback-lifecycle.sql', () => {
	it('preserves every existing row and maps its status', async () => {
		const { rows } = await migrated.query<{
			id: string;
			subject: string;
			contact_email: string | null;
			status: string;
			close_reason: string | null;
			category: string;
		}>('SELECT id, subject, contact_email, status, close_reason, category FROM feedback.feedback ORDER BY id');
		expect(rows).toEqual([
			{
				id: 'fbk_archived',
				subject: 'Archived one',
				contact_email: null,
				status: 'closed',
				close_reason: 'archived',
				category: 'general',
			},
			{
				id: 'fbk_new',
				subject: 'New one',
				contact_email: 'a@example.com',
				status: 'received',
				close_reason: null,
				category: 'general',
			},
			{
				id: 'fbk_read',
				subject: 'Read one',
				contact_email: null,
				status: 'received',
				close_reason: null,
				category: 'general',
			},
		]);
	});

	it('leaves no trace of the retired enum', async () => {
		const { rows } = await migrated.query(`SELECT 1 FROM pg_type WHERE typname = 'feedback_status_retired'`);
		expect(rows).toHaveLength(0);
	});

	for (const [name, sql] of [
		['columns', COLUMNS],
		['constraints', CONSTRAINTS],
		['indexes', INDEXES],
		['enums', ENUMS],
	] as const) {
		it(`matches the Drizzle schema: ${name}`, async () => {
			const [after, expected] = await Promise.all([migrated.query(sql), reference.query(sql)]);
			expect(after.rows).toEqual(expected.rows);
		});
	}
});
