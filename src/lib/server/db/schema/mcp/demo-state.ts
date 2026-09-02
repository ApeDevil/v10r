/**
 * MCP DEMO STATE — Singleton row that backs the two-trust-level MCP demonstration.
 *
 * The private admin MCP (`/api/mcp/admin`) mutates this row; the protected admin page
 * (`/admin/mcp`) and the same MCP read it. It is deliberately tiny: one plain-text
 * message and one semantic color, plus the metadata a caller needs to verify a change
 * landed (monotonic version, timestamp, attribution).
 *
 * Attribution / history reuses the existing admin audit log (see
 * `$lib/server/admin/audit`) rather than a bespoke history table — every accepted
 * mutation records an `admin.audit_log` row with before/after detail.
 */
import { sql } from 'drizzle-orm';
import { check, integer, pgSchema, text, timestamp } from 'drizzle-orm/pg-core';

export const mcpSchema = pgSchema('mcp');

/** There is exactly one row; this is its fixed primary key. */
export const MCP_DEMO_STATE_ID = 'singleton';

export const mcpDemoState = mcpSchema.table(
	'demo_state',
	{
		/** Fixed singleton key — always MCP_DEMO_STATE_ID. */
		id: text('id').primaryKey().default(MCP_DEMO_STATE_ID),

		/** Plain-text message. Never interpreted as HTML; ≤500 chars (valibot + DB CHECK). */
		message: text('message').notNull().default('Hello, Velociraptor.'),

		/** Semantic color name from the validated allowlist (see demo/config.ts). */
		color: text('color').notNull().default('blue'),

		/** Monotonic version — incremented by every accepted mutation. */
		version: integer('version').notNull().default(1),

		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),

		/** Who last changed it (no FK — a machine identity like "admin-mcp" is valid here). */
		updatedBy: text('updated_by'),
	},
	(table) => [
		// The service layer validates via valibot; these CHECKs are the backstop for
		// any bypass (future caller, SQL console) — same doctrine as mcp.call_log,
		// which treats its text bounds as load-bearing DB facts. Keep the color list
		// in sync with DEMO_COLORS in $lib/server/mcp/demo/config.ts.
		check('mcp_demo_state_singleton', sql`${table.id} = 'singleton'`),
		check('mcp_demo_color_allowed', sql`${table.color} IN ('blue', 'red', 'green', 'yellow', 'orange', 'purple')`),
		check('mcp_demo_message_len', sql`char_length(${table.message}) <= 500`),
	],
);

export type McpDemoStateRow = typeof mcpDemoState.$inferSelect;
