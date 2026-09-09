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
vi.mock('$lib/server/db/desk/queries', () => ({
	listFiles: vi.fn(),
	getFile: mockGetFile,
	getSpreadsheetByFileId: vi.fn(),
	getMarkdownByFileId: vi.fn(),
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
		mockGetFile.mockResolvedValueOnce({ id: 'f1', name: 'Notes.md', type: 'markdown' });
		const result = await createWriteTools(USER_ID).desk_update_markdown.execute?.(
			{ file_id: 'f1', content: '# Updated' },
			ctx,
		);

		expect(result).toMatchObject({ requiresApproval: true, fileId: 'f1', fileName: 'Notes.md' });
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
		mockGetFile.mockResolvedValueOnce({ id: 'f1', name: 'Sheet', type: 'spreadsheet' });
		const result = await createWriteTools(USER_ID).desk_update_markdown.execute?.(
			{ file_id: 'f1', content: '# x' },
			ctx,
		);

		expect(result).toEqual({ error: 'That file is not a markdown document.' });
	});

	it('passes the userId from closure to the ownership check', async () => {
		mockGetFile.mockResolvedValueOnce({ id: 'f1', name: 'Notes', type: 'markdown' });
		await createWriteTools(USER_ID).desk_update_markdown.execute?.({ file_id: 'f1', content: 'x' }, ctx);

		expect(mockGetFile).toHaveBeenCalledWith('f1', USER_ID);
	});
});

describe('desk_update_cells (approval-gated)', () => {
	it('returns a requiresApproval sentinel for a spreadsheet target', async () => {
		mockGetFile.mockResolvedValueOnce({ id: 's1', name: 'Budget', type: 'spreadsheet' });
		const result = await createWriteTools(USER_ID).desk_update_cells.execute?.(
			{ file_id: 's1', updates: [{ cell: 'A1', value: 1 }] },
			ctx,
		);

		expect(result).toMatchObject({ requiresApproval: true, fileId: 's1', fileName: 'Budget' });
	});

	it('returns error when the target is not a spreadsheet', async () => {
		mockGetFile.mockResolvedValueOnce({ id: 'm1', name: 'Notes', type: 'markdown' });
		const result = await createWriteTools(USER_ID).desk_update_cells.execute?.(
			{ file_id: 'm1', updates: [{ cell: 'A1', value: 1 }] },
			ctx,
		);

		expect(result).toEqual({ error: 'That file is not a spreadsheet.' });
	});
});

describe('desk_rename_file (approval-gated)', () => {
	it('returns a requiresApproval sentinel', async () => {
		mockGetFile.mockResolvedValueOnce({ id: 'f1', name: 'Old', type: 'markdown' });
		const result = await createWriteTools(USER_ID).desk_rename_file.execute?.({ file_id: 'f1', name: 'New' }, ctx);

		expect(result).toMatchObject({ requiresApproval: true, fileId: 'f1', fileName: 'Old' });
	});

	it('returns error when file not found', async () => {
		mockGetFile.mockResolvedValueOnce(null);
		const result = await createWriteTools(USER_ID).desk_rename_file.execute?.({ file_id: 'nope', name: 'New' }, ctx);

		expect(result).toEqual({ error: 'File not found or not accessible.' });
	});
});

describe('desk_delete_file (approval-gated, never deletes in-loop)', () => {
	it('returns a requiresApproval sentinel and does NOT call deleteFile', async () => {
		mockGetFile.mockResolvedValueOnce({ id: 'f1', name: 'Report.md', type: 'markdown' });
		const result = await createDeleteTools(USER_ID).desk_delete_file.execute?.({ file_id: 'f1' }, ctx);

		expect(result).toMatchObject({ requiresApproval: true, fileId: 'f1', fileName: 'Report.md' });
		expect(mockDeleteFile).not.toHaveBeenCalled();
	});

	it('verifies ownership with the closure userId', async () => {
		mockGetFile.mockResolvedValueOnce({ id: 'f1', name: 'X', type: 'markdown' });
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
 * the approve-route replay needs, and approved plans persist with empty args —
 * the exact gap that left destructive plans un-executable (and silently re-run
 * by the resume turn instead).
 */
describe('desk_propose_plan input schema', () => {
	it('requires per-step args so approved plans carry execution arguments', () => {
		const tool = createProposePlanTool().desk_propose_plan;
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
	});
});
