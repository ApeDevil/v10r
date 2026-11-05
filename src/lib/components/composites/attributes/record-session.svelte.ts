/**
 * A record being edited and saved: the attribute editor wired to the generic document autosave
 * over any `AttributeRecordStore`. One session per record per tab; it outlives the component
 * that shows it, so closing a panel or a dialog never cancels a pending save.
 *
 * The store decides where the record lives (the desk's HTTP API, browser storage, anything
 * that keeps the version contract); the session adds what every host needs: debounced saves,
 * a device draft per change, conflict detection, and a merge out of a conflict by attribute id.
 */
import {
	type AttributeEngine,
	type AttributeMergeConflict,
	type AttributeRecord,
	type AttributeRecordStore,
	emptyAttributeRecord,
	mergeAttributeRecords,
	parseAttributeRecord,
} from '#lib/dynamic-attributes/index.ts';
import { createDocumentAutosave } from '#lib/state/document-autosave.ts';
import type { DocumentDrafts } from '#lib/state/document-drafts.ts';
import { createAttributeEditor } from './attribute-editor.svelte.ts';

/** The draft namespace of record documents: `v10r:record-draft:…`. */
export const RECORD_DRAFT_NAMESPACE = 'record';

export interface RecordSessionOptions {
	engine: AttributeEngine;
	store: AttributeRecordStore;
	drafts: DocumentDrafts<AttributeRecord>;
	delayMs?: number;
}

/** A draft guard for `createDocumentDrafts`: stored JSON is a record only if the codec says so. */
export function acceptsAttributeRecord(engine: AttributeEngine) {
	return (content: unknown): content is AttributeRecord =>
		parseAttributeRecord(content, { kinds: engine.kinds, limits: engine.limits }).ok;
}

export function createRecordSession(options: RecordSessionOptions) {
	const { engine, store } = options;
	let mergeConflicts = $state.raw<AttributeMergeConflict[] | null>(null);

	const autosave = createDocumentAutosave<AttributeRecord>({
		drafts: options.drafts,
		delayMs: options.delayMs,
		apply: (record) => editor.replace(record),
		async load() {
			const snapshot = await store.load();
			return { content: snapshot.record, version: snapshot.version };
		},
		save: ({ content, version }) => store.save(content, version),
	});

	const editor = createAttributeEditor({
		engine,
		initial: emptyAttributeRecord(),
		onChange: (record) => {
			mergeConflicts = null;
			autosave.change(record);
		},
	});

	return {
		editor,
		autosave,
		engine,
		/** Clashes the last merge resolved in this editor's favour; null when there was no merge since. */
		get mergeConflicts() {
			return mergeConflicts;
		},
		/** Leave a conflict by merging this editor's changes with the stored ones, attribute by attribute. */
		async merge() {
			let conflicts: AttributeMergeConflict[] = [];
			const outcome = await autosave.rebase((base, local, remote) => {
				const merged = mergeAttributeRecords(base, local, remote, engine.limits.removed);
				conflicts = merged.conflicts;
				return merged.record;
			});
			if (outcome === 'merged') mergeConflicts = conflicts;
			return outcome;
		},
	};
}

export type RecordSession = ReturnType<typeof createRecordSession>;
