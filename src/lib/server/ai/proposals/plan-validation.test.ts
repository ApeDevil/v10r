/**
 * A plan the user is asked to approve must be one the door can run: every step a known
 * mutation with parseable args and an owned target of the right kind, baselines captured
 * at proposal time. One bad step refuses the whole plan and names it for the model.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({ db: {} }));

const mockGetFile = vi.fn();
const mockGetSpreadsheet = vi.fn();
const mockGetMarkdown = vi.fn();
vi.mock('$lib/server/db/desk/queries', () => ({
	getFile: mockGetFile,
	getSpreadsheetByFileId: mockGetSpreadsheet,
	getMarkdownByFileId: mockGetMarkdown,
}));
vi.mock('$lib/server/db/desk/mutations', () => ({}));

const { validateProposedPlan, MAX_PLAN_STEPS } = await import('./plan-validation');

const USER = 'usr_plan';
const AT = new Date('2026-09-12T08:00:00.000Z');

function sheet(id: string, name: string, version = 2) {
	mockGetFile.mockResolvedValueOnce({ id, name, type: 'spreadsheet', updatedAt: AT });
	mockGetSpreadsheet.mockResolvedValueOnce({ spreadsheet: { version } });
}
function doc(id: string, name: string, version = 1) {
	mockGetFile.mockResolvedValueOnce({ id, name, type: 'markdown', updatedAt: AT });
	mockGetMarkdown.mockResolvedValueOnce({ markdown: { version } });
}

beforeEach(() => vi.clearAllMocks());

describe('validateProposedPlan', () => {
	it("captures each step's reviewed baseline and keeps the parsed args", async () => {
		sheet('fil_s', 'Budget', 4);
		doc('fil_d', 'Notes', 1);
		const result = await validateProposedPlan(
			{
				goal: 'tidy',
				steps: [
					{
						action: 'Set A1',
						tool: 'desk_update_cells',
						args: { file_id: 'fil_s', updates: [{ cell: 'a1', value: 1 }] },
					},
					{
						action: 'Rename',
						tool: 'desk_rename_file',
						args: { file_id: 'fil_d', name: 'Notes 2' },
						rationale: 'clearer',
					},
					{ action: 'Create', tool: 'desk_create_markdown', args: { name: 'New', content: '' } },
				],
			},
			USER,
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.steps[0]).toMatchObject({
			toolName: 'desk_update_cells',
			action: 'Set A1',
			target: { fileId: 'fil_s', fileType: 'spreadsheet', name: 'Budget', version: 4, updatedAt: AT.toISOString() },
		});
		expect(result.steps[1]).toMatchObject({ rationale: 'clearer', target: { fileId: 'fil_d', version: 1 } });
		expect(result.steps[2].target).toBeUndefined();
	});

	it('refuses a read step, an unknown tool, bad args and a missing file — and names each', async () => {
		mockGetFile.mockResolvedValueOnce(null);
		const result = await validateProposedPlan(
			{
				goal: 'x',
				steps: [
					{ action: 'look', tool: 'desk_read_file', args: { file_id: 'fil_s' } },
					{ action: 'zap', tool: 'desk_obliterate', args: {} },
					{ action: 'rename', tool: 'desk_rename_file', args: { file_id: 'fil_s' } },
					{ action: 'delete', tool: 'desk_delete_file', args: { file_id: 'fil_gone' } },
				],
			},
			USER,
		);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.issues).toHaveLength(4);
		expect(result.issues[0]).toContain('step 1 (desk_read_file)');
		expect(result.issues[0]).toContain('not a desk mutation');
		expect(result.issues[2]).toContain('name');
		expect(result.issues[3]).toContain('"fil_gone" was not found');
	});

	it('refuses a cell update aimed at a document and a markdown overwrite aimed at a sheet', async () => {
		doc('fil_d', 'Notes');
		sheet('fil_s', 'Budget');
		const result = await validateProposedPlan(
			{
				goal: 'x',
				steps: [
					{ action: 'a', tool: 'desk_update_cells', args: { file_id: 'fil_d', updates: [{ cell: 'A1', value: 1 }] } },
					{ action: 'b', tool: 'desk_update_markdown', args: { file_id: 'fil_s', content: 'x' } },
				],
			},
			USER,
		);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.issues[0]).toContain('is a markdown, not a spreadsheet');
		expect(result.issues[1]).toContain('is a spreadsheet, not a markdown');
	});

	it('bounds the plan: no steps, or more than one approval should cover', async () => {
		expect(await validateProposedPlan({ goal: 'x', steps: [] }, USER)).toMatchObject({ ok: false });
		const many = Array.from({ length: MAX_PLAN_STEPS + 1 }, () => ({
			action: 'c',
			tool: 'desk_create_markdown',
			args: { name: 'n', content: '' },
		}));
		const result = await validateProposedPlan({ goal: 'x', steps: many }, USER);
		expect(result).toMatchObject({ ok: false });
		if (!result.ok) expect(result.issues[0]).toContain(`${MAX_PLAN_STEPS}`);
		expect(mockGetFile).not.toHaveBeenCalled();
	});
});
