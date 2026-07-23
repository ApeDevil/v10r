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
import { integer, pgSchema, text, timestamp } from 'drizzle-orm/pg-core';

export const mcpSchema = pgSchema('mcp');

/** There is exactly one row; this is its fixed primary key. */
export const MCP_DEMO_STATE_ID = 'singleton';

export const mcpDemoState = mcpSchema.table('demo_state', {
	/** Fixed singleton key — always MCP_DEMO_STATE_ID. */
	id: text('id').primaryKey().default(MCP_DEMO_STATE_ID),

	/** Plain-text message. Never interpreted as HTML; bounded to 500 chars at the service layer. */
	message: text('message').notNull().default('Hello, Velociraptor.'),

	/** Semantic color name from the validated allowlist (see demo/constants.ts). */
	color: text('color').notNull().default('blue'),

	/** Monotonic version — incremented by every accepted mutation. */
	version: integer('version').notNull().default(1),

	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),

	/** Who last changed it (no FK — a machine identity like "admin-mcp" is valid here). */
	updatedBy: text('updated_by'),
});

export type McpDemoStateRow = typeof mcpDemoState.$inferSelect;
