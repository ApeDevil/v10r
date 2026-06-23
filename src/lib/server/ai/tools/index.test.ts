/**
 * Tests for createDeskTools scope gating.
 *
 * The factory assembles tool objects based on granted scopes.
 * DB modules are mocked — we only test which tools are returned, not their execute().
 */
import { describe, expect, it, vi } from 'vitest';

// Mock the DB connection so modules can import without NEON_DATABASE_URL_PROD
vi.mock('$lib/server/db', () => ({ db: {} }));
vi.mock('$lib/server/db/desk/queries', () => ({
	listFiles: vi.fn(),
	getFile: vi.fn(),
	getSpreadsheetByFileId: vi.fn(),
	getMarkdownByFileId: vi.fn(),
}));
vi.mock('$lib/server/db/desk/mutations', () => ({
	updateSpreadsheetByFileId: vi.fn(),
	updateMarkdownByFileId: vi.fn(),
	renameFile: vi.fn(),
	createSpreadsheetFile: vi.fn(),
	createMarkdownFile: vi.fn(),
	deleteFile: vi.fn(),
}));

const { createDeskTools, stepsForScopes, deskbotToolMeta } = await import('./index');
const { DESK_EXECUTABLE_TOOLS } = await import('./desk-execute');

const USER_ID = 'usr_test_scope_gating';

describe('createDeskTools scope gating', () => {
	it('returns no tools for empty scopes', () => {
		const tools = createDeskTools(USER_ID, []);
		expect(Object.keys(tools)).toHaveLength(0);
	});

	it('returns only read tools for ["desk:read"]', () => {
		const tools = createDeskTools(USER_ID, ['desk:read']);
		const keys = Object.keys(tools);
		expect(keys).toContain('desk_list_files');
		expect(keys).toContain('desk_read_file');
		expect(keys).toContain('desk_search_files');
		expect(keys).not.toContain('desk_update_cells');
		expect(keys).not.toContain('desk_rename_file');
		expect(keys).not.toContain('desk_create_spreadsheet');
		expect(keys).not.toContain('desk_create_markdown');
		expect(keys).not.toContain('desk_delete_file');
	});

	it('returns read + write tools for ["desk:write"]', () => {
		const tools = createDeskTools(USER_ID, ['desk:write']);
		const keys = Object.keys(tools);
		expect(keys).toContain('desk_list_files');
		expect(keys).toContain('desk_read_file');
		expect(keys).toContain('desk_search_files');
		expect(keys).toContain('desk_update_cells');
		expect(keys).toContain('desk_rename_file');
		expect(keys).not.toContain('desk_create_spreadsheet');
		expect(keys).not.toContain('desk_delete_file');
	});

	it('returns read + create tools for ["desk:create"]', () => {
		const tools = createDeskTools(USER_ID, ['desk:create']);
		const keys = Object.keys(tools);
		expect(keys).toContain('desk_list_files');
		expect(keys).toContain('desk_create_spreadsheet');
		expect(keys).toContain('desk_create_markdown');
		expect(keys).not.toContain('desk_update_cells');
		expect(keys).not.toContain('desk_delete_file');
	});

	it('returns read + delete tools for ["desk:delete"]', () => {
		const tools = createDeskTools(USER_ID, ['desk:delete']);
		const keys = Object.keys(tools);
		expect(keys).toContain('desk_list_files');
		expect(keys).toContain('desk_delete_file');
		expect(keys).not.toContain('desk_update_cells');
		expect(keys).not.toContain('desk_create_spreadsheet');
	});

	it('returns read + ask (nRAG) tool for ["desk:ask"], without mounting the plan tool', () => {
		const tools = createDeskTools(USER_ID, ['desk:ask']);
		const keys = Object.keys(tools);
		expect(keys).toContain('desk_search_knowledge');
		// desk:ask is read-only — it must NOT pull in the plan-before-execute primitive.
		expect(keys).not.toContain('desk_propose_plan');
		expect(keys).not.toContain('desk_update_cells');
		expect(keys).not.toContain('desk_delete_file');
	});

	it('does not include desk_search_knowledge without desk:ask scope', () => {
		const tools = createDeskTools(USER_ID, ['desk:write']);
		expect(Object.keys(tools)).not.toContain('desk_search_knowledge');
	});

	it('returns all tools for all scopes', () => {
		const tools = createDeskTools(USER_ID, ['desk:read', 'desk:write', 'desk:create', 'desk:delete']);
		const keys = Object.keys(tools);
		expect(keys).toContain('desk_list_files');
		expect(keys).toContain('desk_read_file');
		expect(keys).toContain('desk_search_files');
		expect(keys).toContain('desk_update_cells');
		expect(keys).toContain('desk_rename_file');
		expect(keys).toContain('desk_create_spreadsheet');
		expect(keys).toContain('desk_create_markdown');
		expect(keys).toContain('desk_delete_file');
	});

	it('each tool object has an execute function', () => {
		const tools = createDeskTools(USER_ID, ['desk:read', 'desk:write', 'desk:create', 'desk:delete']);
		for (const [name, t] of Object.entries(tools)) {
			expect(typeof (t as Record<string, unknown>).execute, `${name}.execute should be a function`).toBe('function');
		}
	});

	it('each tool object has a description string', () => {
		const tools = createDeskTools(USER_ID, ['desk:read']);
		for (const [name, t] of Object.entries(tools)) {
			const tool = t as Record<string, unknown>;
			expect(typeof tool.description, `${name}.description should be a string`).toBe('string');
			expect((tool.description as string).length, `${name}.description should be non-empty`).toBeGreaterThan(0);
		}
	});

	it('includes desk_get_open_panels when any scope is enabled', () => {
		const tools = createDeskTools(USER_ID, ['desk:read']);
		expect(Object.keys(tools)).toContain('desk_get_open_panels');
	});

	it('includes desk_update_markdown with desk:write scope', () => {
		const tools = createDeskTools(USER_ID, ['desk:write']);
		expect(Object.keys(tools)).toContain('desk_update_markdown');
	});

	it('does not include desk_update_markdown without desk:write scope', () => {
		const tools = createDeskTools(USER_ID, ['desk:read']);
		expect(Object.keys(tools)).not.toContain('desk_update_markdown');
	});
});

describe('one-door: desk-execute drift guard', () => {
	// Mutating deskbot tools (risk !== 'read'); excludes desk_propose_plan (read) and
	// resolve_ref (not in the meta registry — compaction infra, never replayed).
	const mutatingDeskTools = Object.entries(deskbotToolMeta)
		.filter(([, meta]) => meta.risk !== 'read')
		.map(([name]) => name);

	it('every mutating deskbot tool has a replay executor case', () => {
		for (const name of mutatingDeskTools) {
			expect(
				DESK_EXECUTABLE_TOOLS as readonly string[],
				`${name} is a mutating desk tool but missing from DESK_EXECUTABLE_TOOLS — proposal replay would silently fail`,
			).toContain(name);
		}
	});

	it('every executor tool is a known mutating deskbot tool (no orphan cases)', () => {
		for (const name of DESK_EXECUTABLE_TOOLS) {
			const meta = deskbotToolMeta[name];
			expect(meta, `${name} is in DESK_EXECUTABLE_TOOLS but not in deskbotToolMeta`).toBeDefined();
			expect(meta.risk, `${name} executor maps to a non-mutating tool`).not.toBe('read');
		}
	});
});

describe('stepsForScopes', () => {
	it('returns 3 for read-only scopes', () => {
		expect(stepsForScopes(['desk:read'])).toBe(3);
	});

	it('returns 5 when any mutation scope is present', () => {
		expect(stepsForScopes(['desk:read', 'desk:write'])).toBe(5);
		expect(stepsForScopes(['desk:create'])).toBe(5);
		expect(stepsForScopes(['desk:delete'])).toBe(5);
	});

	it('returns 3 for empty scopes', () => {
		expect(stepsForScopes([])).toBe(3);
	});

	it('returns 3 for desk:ask (read-only nRAG grounding, not a mutation)', () => {
		expect(stepsForScopes(['desk:ask'])).toBe(3);
		expect(stepsForScopes(['desk:read', 'desk:ask'])).toBe(3);
	});
});
