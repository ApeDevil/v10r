/**
 * Schema-parity gate (invariant P3): every field of the client's
 * DockLayoutState must survive the server's valibot parse — `v.object`
 * strips unknown keys SILENTLY, so a field missing from
 * DockLayoutStateSchema silently diverges the DB workspace lane from
 * localStorage with no error anywhere.
 */

import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import type { DockLayoutState } from '$lib/components/composites/dock';
import { CreateWorkspaceSchema, SyncWorkspaceSchema } from './schemas';

const layout: Required<DockLayoutState> = {
	version: 1,
	root: { type: 'leaf', id: 'l1', tabs: ['p1'], activeTab: 'p1' },
	panels: { p1: { id: 'p1', type: 'editor', label: 'Editor' } },
	activityBarPosition: 'left',
	focusedLeafId: 'l1',
};

describe('DockLayoutState ↔ DockLayoutStateSchema parity', () => {
	it('CreateWorkspaceSchema round-trips every DockLayoutState field', () => {
		const parsed = v.safeParse(CreateWorkspaceSchema, { name: 'ws', layout });
		expect(parsed.success).toBe(true);
		if (!parsed.success) return;
		// Object.keys equality is the actual gate: a new client field that the
		// server schema lacks shows up here as a missing key, not silently.
		expect(Object.keys(parsed.output.layout).sort()).toEqual(Object.keys(layout).sort());
		expect(parsed.output.layout.focusedLeafId).toBe('l1');
	});

	it('SyncWorkspaceSchema preserves focusedLeafId in the save payload', () => {
		const parsed = v.safeParse(SyncWorkspaceSchema, { save: { id: 'ws1', layout }, activate: 'ws1' });
		expect(parsed.success).toBe(true);
		if (!parsed.success) return;
		expect(parsed.output.save?.layout.focusedLeafId).toBe('l1');
	});

	it('focusedLeafId stays optional (old persisted states load)', () => {
		const { focusedLeafId: _omitted, ...legacy } = layout;
		const parsed = v.safeParse(CreateWorkspaceSchema, { name: 'ws', layout: legacy });
		expect(parsed.success).toBe(true);
	});
});
