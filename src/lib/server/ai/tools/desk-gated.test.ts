/**
 * The approval-gated desk tools, and the read tool they sit beside.
 *
 * One theme, one mock graph: a gated tool VALIDATES the target with the closure
 * `userId` and returns a `requiresApproval` sentinel — it never mutates in-loop.
 * The real write runs only through the approve-route replay (`executeDeskToolCall`,
 * covered in `desk-execute.test.ts`, which is the other door and keeps its own file).
 *
 * These were four files repeating three near-identical `vi.mock` preambles for the
 * same modules. The `deleteFile` spy is the load-bearing part of that preamble:
 * `desk-create.ts` does not import it today, and the `not.toHaveBeenCalled()`
 * assertions below are what fails if a regression re-adds the old self-serve
 * `confirmed` handshake the model could satisfy by itself.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({ db: {} }));

const mockGetFile = vi.fn();
const mockGetSpreadsheet = vi.fn();
const mockGetMarkdown = vi.fn();
vi.mock('$lib/server/db/desk/queries', () => ({
	listFiles: vi.fn(),
	getFile: mockGetFile,
	getSpreadsheetByFileId: mockGetSpreadsheet,
	getMarkdownByFileId: mockGetMarkdown,
}));
vi.mock('$lib/server/desk/file-tree', () => ({
	getFileTree: vi.fn(),
	renderFileTreeWithIndex: vi.fn(),
}));

const mockDeleteFile = vi.fn();
vi.mock('$lib/server/db/desk/mutations', () => ({
	createMarkdownFile: vi.fn(),
	createSpreadsheetFile: vi.fn(),
	deleteFile: mockDeleteFile,
}));

const { createReadTools } = await import('./desk-read');
const { createWriteTools } = await import('./desk-write');
const { createDeleteTools } = await import('./desk-create');
const { createProposePlanTool } = await import('./propose-plan');

const USER_ID = 'usr_test_gated';
const ctx = { toolCallId: 'tc1', messages: [] as never[], abortSignal: new AbortController().signal };
const UPDATED_AT = new Date('2026-09-12T08:00:00.000Z');

/** A stored file as `getFile` returns it, with the detail row's version behind it. */
function fileExists(row: { id: string; name: string; type: 'markdown' | 'spreadsheet' }, version = 3) {
	mockGetFile.mockResolvedValueOnce({ ...row, updatedAt: UPDATED_AT });
	if (row.type === 'spreadsheet') mockGetSpreadsheet.mockResolvedValueOnce({ spreadsheet: { version } });
	else mockGetMarkdown.mockResolvedValueOnce({ markdown: { version } });
}

describe('desk_get_open_panels', () => {
	it('maps the injected deskLayout to panels + total', async () => {
		const layout = [
			{ panelId: 'spreadsheet-f1', fileId: 'f1', fileType: 'spreadsheet', label: 'Budget' },
			{ panelId: 'editor-f2', fileId: 'f2', fileType: 'markdown', label: 'Notes' },
		];
		const result = await createReadTools(USER_ID, layout).desk_get_open_panels.execute?.({}, ctx);

		expect(result).toEqual({ panels: layout, total: 2 });
	});

	it.each([
		{ label: 'no deskLayout provided', layout: undefined },
		{ label: 'an empty deskLayout array', layout: [] },
	])('returns an empty result for $label', async ({ layout }) => {
		const result = await createReadTools(USER_ID, layout).desk_get_open_panels.execute?.({}, ctx);
		expect(result).toEqual({ panels: [], total: 0 });
	});

	it('nulls an absent fileId and fileType rather than omitting them', async () => {
		const result = await createReadTools(USER_ID, [
			{ panelId: 'explorer', label: 'Explorer' },
		]).desk_get_open_panels.execute?.({}, ctx);

		expect(result).toEqual({
			panels: [{ panelId: 'explorer', fileId: null, fileType: null, label: 'Explorer' }],
			total: 1,
		});
	});
});

describe('desk_update_markdown (approval-gated)', () => {
	it('returns a requiresApproval sentinel without mutating', async () => {
		fileExists({ id: 'f1', name: 'Notes.md', type: 'markdown' }, 5);
		const result = await createWriteTools(USER_ID).desk_update_markdown.execute?.(
			{ file_id: 'f1', content: '# Updated' },
			ctx,
		);

		// The sentinel carries the reviewed baseline the replay will CAS on.
		expect(result).toMatchObject({
			requiresApproval: true,
			target: { fileId: 'f1', fileType: 'markdown', name: 'Notes.md', version: 5, updatedAt: UPDATED_AT.toISOString() },
		});
	});

	it('returns error when file not found', async () => {
		mockGetFile.mockResolvedValueOnce(null);
		const result = await createWriteTools(USER_ID).desk_update_markdown.execute?.(
			{ file_id: 'nonexistent', content: '# x' },
			ctx,
		);

		expect(result).toEqual({ error: 'Markdown file not found or not accessible.' });
	});

	it('returns error when the target is not a markdown document', async () => {
		fileExists({ id: 'f1', name: 'Sheet', type: 'spreadsheet' });
		const result = await createWriteTools(USER_ID).desk_update_markdown.execute?.(
			{ file_id: 'f1', content: '# x' },
			ctx,
		);

		expect(result).toEqual({ error: 'That file is not a markdown document.' });
	});

	it('passes the userId from closure to the ownership check', async () => {
		fileExists({ id: 'f1', name: 'Notes', type: 'markdown' });
		await createWriteTools(USER_ID).desk_update_markdown.execute?.({ file_id: 'f1', content: 'x' }, ctx);

		expect(mockGetFile).toHaveBeenCalledWith('f1', USER_ID);
	});
});

describe('desk_edit_markdown (approval-gated)', () => {
	it('checks the edits against the document now and returns a sentinel with the reviewed baseline', async () => {
		fileExists({ id: 'f1', name: 'Notes.md', type: 'markdown' }, 2);
		mockGetMarkdown.mockResolvedValueOnce({ markdown: { content: 'fix teh typo', version: 2 } });
		const result = await createWriteTools(USER_ID).desk_edit_markdown.execute?.(
			{ file_id: 'f1', edits: [{ find: 'teh', replace: 'the' }] },
			ctx,
		);
		expect(result).toMatchObject({
			requiresApproval: true,
			action: 'Edit 1 passage in "Notes.md"',
			target: { fileId: 'f1', version: 2 },
		});
	});

	it('refuses an edit whose passage is missing or ambiguous before any card is shown', async () => {
		fileExists({ id: 'f1', name: 'Notes.md', type: 'markdown' }, 2);
		mockGetMarkdown.mockResolvedValueOnce({ markdown: { content: 'a b a', version: 2 } });
		const result = await createWriteTools(USER_ID).desk_edit_markdown.execute?.(
			{ file_id: 'f1', edits: [{ find: 'a', replace: 'c' }] },
			ctx,
		);
		expect(result).toEqual({ error: expect.stringContaining('occurs more than once') });
	});
});

describe('desk_update_markdown refuses to rewrite what one read cannot show', () => {
	it('points the model at desk_edit_markdown for a long document', async () => {
		fileExists({ id: 'f1', name: 'Long.md', type: 'markdown' }, 2);
		mockGetMarkdown.mockResolvedValueOnce({ markdown: { content: 'x'.repeat(8_001), version: 2 } });
		const result = await createWriteTools(USER_ID).desk_update_markdown.execute?.(
			{ file_id: 'f1', content: 'short' },
			ctx,
		);
		expect(result).toEqual({ error: expect.stringContaining('desk_edit_markdown') });
	});
});

describe('desk_update_cells (approval-gated)', () => {
	it('returns a requiresApproval sentinel for a spreadsheet target', async () => {
		fileExists({ id: 's1', name: 'Budget', type: 'spreadsheet' }, 9);
		const result = await createWriteTools(USER_ID).desk_update_cells.execute?.(
			{ file_id: 's1', updates: [{ cell: 'A1', value: 1 }] },
			ctx,
		);

		expect(result).toMatchObject({
			requiresApproval: true,
			target: { fileId: 's1', fileType: 'spreadsheet', name: 'Budget', version: 9 },
		});
	});

	it('returns error when the target is not a spreadsheet', async () => {
		fileExists({ id: 'm1', name: 'Notes', type: 'markdown' });
		const result = await createWriteTools(USER_ID).desk_update_cells.execute?.(
			{ file_id: 'm1', updates: [{ cell: 'A1', value: 1 }] },
			ctx,
		);

		expect(result).toEqual({ error: 'That file is not a spreadsheet.' });
	});
});

describe('desk_rename_file (approval-gated)', () => {
	it('returns a requiresApproval sentinel', async () => {
		fileExists({ id: 'f1', name: 'Old', type: 'markdown' });
		const result = await createWriteTools(USER_ID).desk_rename_file.execute?.({ file_id: 'f1', name: 'New' }, ctx);

		expect(result).toMatchObject({
			requiresApproval: true,
			action: 'Rename "Old" → "New"',
			target: { fileId: 'f1', name: 'Old', updatedAt: UPDATED_AT.toISOString() },
		});
	});

	it('returns error when file not found', async () => {
		mockGetFile.mockResolvedValueOnce(null);
		const result = await createWriteTools(USER_ID).desk_rename_file.execute?.({ file_id: 'nope', name: 'New' }, ctx);

		expect(result).toEqual({ error: 'File not found or not accessible.' });
	});
});

describe('desk_delete_file (approval-gated, never deletes in-loop)', () => {
	it('returns a requiresApproval sentinel and does NOT call deleteFile', async () => {
		fileExists({ id: 'f1', name: 'Report.md', type: 'markdown' });
		const result = await createDeleteTools(USER_ID).desk_delete_file.execute?.({ file_id: 'f1' }, ctx);

		expect(result).toMatchObject({ requiresApproval: true, target: { fileId: 'f1', name: 'Report.md' } });
		expect(mockDeleteFile).not.toHaveBeenCalled();
	});

	it('verifies ownership with the closure userId', async () => {
		fileExists({ id: 'f1', name: 'X', type: 'markdown' });
		await createDeleteTools(USER_ID).desk_delete_file.execute?.({ file_id: 'f1' }, ctx);

		expect(mockGetFile).toHaveBeenCalledWith('f1', USER_ID);
	});

	it('returns an error and does NOT call deleteFile when the target is not found/owned', async () => {
		mockGetFile.mockResolvedValueOnce(null);
		const result = await createDeleteTools(USER_ID).desk_delete_file.execute?.({ file_id: 'nope' }, ctx);

		expect(result).toEqual({ error: 'File not found or not accessible.' });
		expect(mockDeleteFile).not.toHaveBeenCalled();
	});
});

/**
 * Guards the plan-replay arg contract at the schema layer: each proposed step
 * MUST carry an `args` object. Without it the model never supplies the file ids
 * the approve replay needs, and approved plans persist with empty args —
 * the exact gap that left destructive plans un-executable.
 */
describe('desk_propose_plan input schema', () => {
	it('requires per-step args so approved plans carry execution arguments', () => {
		const tool = createProposePlanTool(USER_ID).desk_propose_plan;
		// AI SDK wraps the raw JSON Schema under `.jsonSchema`; fall back to the
		// object itself if a future version exposes it directly.
		const raw =
			(tool.inputSchema as { jsonSchema?: Record<string, unknown> }).jsonSchema ??
			(tool.inputSchema as Record<string, unknown>);
		const stepItem = (
			raw as { properties: { steps: { items: { properties: Record<string, unknown>; required: string[] } } } }
		).properties.steps.items;
		expect(stepItem.properties).toHaveProperty('args');
		expect(stepItem.required).toContain('args');
		// Risk and recovery are the server's to derive, never the model's to declare.
		expect(stepItem.properties).not.toHaveProperty('risk');
		expect(raw).not.toHaveProperty(['properties', 'rollback']);
	});
});
