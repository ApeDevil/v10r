import { apiFetch } from '#lib/api.ts';
import { createSpreadsheetState } from './spreadsheet.state.svelte';
import { createSpreadsheetAutosave } from './spreadsheet-autosave';
import { createSpreadsheetDrafts } from './spreadsheet-drafts';
import { openSpreadsheetSession } from './spreadsheet-unsaved-work';

function createSession(userId: string, fileId: string) {
	const sheet = createSpreadsheetState();
	const autosave = createSpreadsheetAutosave({
		drafts: createSpreadsheetDrafts(() => localStorage, userId, fileId, crypto.randomUUID()),
		apply: (cells) => sheet.fromJSON(cells),
		async load() {
			const res = await apiFetch(`/api/desk/files/${fileId}`, { signal: AbortSignal.timeout(15_000) });
			if (!res.ok) throw new Error('Spreadsheet load failed');
			const { data } = await res.json();
			if (!Number.isInteger(data?.spreadsheet?.version) || !data.spreadsheet.cells) {
				throw new Error('Invalid spreadsheet response');
			}
			return data.spreadsheet;
		},
		async save({ cells, version }) {
			const res = await apiFetch(`/api/desk/files/${fileId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ cells, expectedVersion: version }),
				signal: AbortSignal.timeout(15_000),
			});
			if (res.status === 409) return { status: 'conflict' };
			if (!res.ok) throw new Error('Spreadsheet save failed');
			const { data } = await res.json();
			if (!Number.isInteger(data?.version)) throw new Error('Invalid save response');
			return { status: 'saved', version: data.version };
		},
	});
	sheet.onChange(autosave.change, autosave.stage);
	return { sheet, autosave };
}

/**
 * Populated only on mount, never on the server. Reopening a panel reuses its pending save;
 * sign-out drains and discards these sessions through `spreadsheet-unsaved-work.ts`.
 */
export function getSpreadsheetSession(userId: string, fileId: string) {
	return openSpreadsheetSession(userId, fileId, () => createSession(userId, fileId));
}
