/**
 * Constants for the MCP demo state — the two user-facing values (a message and a color)
 * plus their validation bounds. Shared by the validation schema, the domain service,
 * the admin MCP tools, and the protected admin page so there is one source of truth.
 */
import { MCP_DEMO_STATE_ID } from '$lib/server/db/schema/mcp';

export { MCP_DEMO_STATE_ID };

/** Plain-text message upper bound. Documented default from the task contract. */
export const MAX_MESSAGE_LENGTH = 500;

/**
 * Semantic color allowlist for the MVP. The color box is driven by these names, never by
 * an arbitrary CSS value — this keeps the surface injection-proof and the palette curated.
 */
export const DEMO_COLORS = ['blue', 'red', 'green', 'yellow', 'orange', 'purple'] as const;
export type DemoColor = (typeof DEMO_COLORS)[number];

/** Seed values for a freshly provisioned singleton. Mirrors the DB column defaults. */
export const INITIAL_DEMO_STATE = {
	message: 'Hello, Velociraptor.',
	color: 'blue',
} as const satisfies { message: string; color: DemoColor };
