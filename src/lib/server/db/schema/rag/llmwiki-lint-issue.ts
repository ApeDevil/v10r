/**
 * LLMWIKI_LINT_ISSUE — persistent lint findings across runs.
 *
 * Nightly lint upserts by (llmwikiPageId, code, fingerprint) and bumps
 * `lastSeenAt`. Issues not seen in the current run get `resolvedAt = now()`.
 * This gives both "open issues for this page" and "historical drift" queries.
 *
 * Codes are a stable contract — never rename. Add new codes, never mutate.
 *   - WIKI_CONTRADICTION     : body claim conflicts with another page
 *   - WIKI_ORPHAN_PAGE       : no inbound wikilinks and not the overview
 *   - WIKI_STALE_TLDR        : tldr hash drifted from body edits
 *   - WIKI_COMPILE_DRIFT     : cited chunk.content_hash changed since compile
 *   - WIKI_BROKEN_WIKILINK   : [[slug]] target does not exist
 *   - INJECTION_SUSPECTED    : source chunk contained imperative injection text
 */

import { sql } from 'drizzle-orm';
import { index, jsonb, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { ragSchema } from './embedding-model';
import { llmwikiPage } from './llmwiki-page';

export const llmwikiLintCodeEnum = ragSchema.enum('llmwiki_lint_code', [
	'WIKI_CONTRADICTION',
	'WIKI_ORPHAN_PAGE',
	'WIKI_STALE_TLDR',
	'WIKI_COMPILE_DRIFT',
	'WIKI_BROKEN_WIKILINK',
	'INJECTION_SUSPECTED',
]);

export const llmwikiLintSeverityEnum = ragSchema.enum('llmwiki_lint_severity', ['info', 'warn', 'error']);

export interface LlmwikiLintDetail {
	line?: number;
	target?: string;
	message: string;
	[key: string]: unknown;
}

export const llmwikiLintIssue = ragSchema.table(
	'llmwiki_lint_issue',
	{
		id: text('id').primaryKey(),
		llmwikiPageId: text('llmwiki_page_id')
			.notNull()
			.references(() => llmwikiPage.id, { onDelete: 'cascade' }),
		code: llmwikiLintCodeEnum('code').notNull(),
		severity: llmwikiLintSeverityEnum('severity').notNull().default('warn'),
		fingerprint: text('fingerprint').notNull(),
		detail: jsonb('detail').$type<LlmwikiLintDetail>().notNull(),
		firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
		lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
		resolvedAt: timestamp('resolved_at', { withTimezone: true }),
	},
	(t) => [
		uniqueIndex('llmwiki_lint_uq').on(t.llmwikiPageId, t.code, t.fingerprint),
		index('llmwiki_lint_open_idx').on(t.llmwikiPageId).where(sql`resolved_at IS NULL`),
		index('llmwiki_lint_code_idx').on(t.code).where(sql`resolved_at IS NULL`),
	],
);
