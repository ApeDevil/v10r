import type { PersistedCell, SpreadsheetCells } from '$lib/desk/spreadsheet-cells';

export interface SpreadsheetDraft {
	key: string;
	version: number;
	cells: SpreadsheetCells;
	updatedAt: number;
}

/** Each document session owns a slot; one tab must never erase another tab's draft. */
export function createSpreadsheetDrafts(storage: () => Storage, userId: string, fileId: string, writerId: string) {
	const prefix = `v10r:spreadsheet-draft:${encodeURIComponent(userId)}:${encodeURIComponent(fileId)}:`;
	const key = `${prefix}${writerId}`;
	return {
		write(version: number, cells: SpreadsheetCells) {
			storage().setItem(key, JSON.stringify({ version, cells, updatedAt: Date.now() }));
		},
		clear() {
			storage().removeItem(key);
		},
		/** Drop a sibling slot once its work has been adopted or waved off. */
		discard(slot: string) {
			if (slot === key || !slot.startsWith(prefix)) return;
			storage().removeItem(slot);
		},
		list(): SpreadsheetDraft[] {
			const store = storage();
			const drafts: SpreadsheetDraft[] = [];
			for (let i = 0; i < store.length; i++) {
				const candidate = store.key(i);
				if (!candidate?.startsWith(prefix) || candidate === key) continue;
				try {
					const draft = JSON.parse(store.getItem(candidate) ?? 'null');
					if (
						!draft ||
						!Number.isInteger(draft.version) ||
						draft.version < 0 ||
						!Number.isFinite(draft.updatedAt) ||
						!draft.cells ||
						Array.isArray(draft.cells) ||
						typeof draft.cells !== 'object' ||
						!Object.values(draft.cells).every((cell) => {
							if (!cell || typeof cell !== 'object') return false;
							const { v, f, t } = cell as PersistedCell;
							return (
								(v === null || typeof v === 'string' || typeof v === 'number') &&
								(f === undefined || typeof f === 'string') &&
								(t === undefined || typeof t === 'string')
							);
						})
					)
						continue;
					drafts.push({ ...draft, key: candidate });
				} catch {
					// A malformed slot must not hide other recoverable drafts.
				}
			}
			return drafts.sort((a, b) => b.updatedAt - a.updatedAt);
		},
	};
}

export type SpreadsheetDrafts = ReturnType<typeof createSpreadsheetDrafts>;
