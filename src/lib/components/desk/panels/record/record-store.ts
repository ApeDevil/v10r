import { apiFetch } from '#lib/api.ts';
import {
	type AttributeCodecOptions,
	AttributeRecordLoadError,
	type AttributeRecordStore,
	parseAttributeRecord,
} from '#lib/dynamic-attributes/index.ts';

/**
 * The desk's record store: `AttributeRecordStore` over `/api/desk/files/[id]`. The server owns
 * authorization (owner-scoped rows), the version check (409) and validation (422); this adapter
 * only translates. What it loads is parsed again here, so a response that is not a record never
 * reaches the editor.
 */
export function createDeskRecordStore(fileId: string, codec: AttributeCodecOptions): AttributeRecordStore {
	const url = `/api/desk/files/${encodeURIComponent(fileId)}`;
	return {
		async load() {
			const res = await apiFetch(url, { signal: AbortSignal.timeout(15_000) });
			if (!res.ok) throw new Error('Record load failed');
			const { data } = await res.json();
			const version = data?.record?.version;
			if (!Number.isInteger(version)) throw new AttributeRecordLoadError('Invalid record response');
			const parsed = parseAttributeRecord(data.record.document, codec);
			if (!parsed.ok) throw new AttributeRecordLoadError(parsed.problems.map((p) => p.message).join(' '));
			return { record: parsed.record, version };
		},
		async save(record, expectedVersion) {
			const res = await apiFetch(url, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ document: record, expectedVersion }),
				signal: AbortSignal.timeout(15_000),
			});
			if (res.status === 409) return { status: 'conflict' };
			if (!res.ok) throw new Error(`Record save failed (${res.status})`);
			const { data } = await res.json();
			if (!Number.isInteger(data?.version)) throw new Error('Invalid save response');
			return { status: 'saved', version: data.version };
		},
	};
}
