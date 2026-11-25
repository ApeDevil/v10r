/**
 * The session's own rendered-node check, the defence behind the surface policy: with the
 * policy switched off (as if it had a bug), an amplifying graph still never reaches Svelte.
 */
import { describe, expect, it, vi } from 'vitest';
import { diamondComponents } from '#lib/generative-ui/fixtures/adversarial.ts';
import { GENERATIVE_UI_CATALOG_ID as CATALOG } from '#lib/generative-ui/index.ts';
import { createGenerativeSurfaceSession } from './surface-session.svelte.ts';

vi.mock('#lib/generative-ui/index.ts', async (importOriginal) => {
	const original = await importOriginal<typeof import('#lib/generative-ui/index.ts')>();
	return {
		...original,
		// Accepts everything for surface "probe" — no graph check at all.
		checkGenerativeSurfaceBatch: () => ({
			ok: true,
			graph: { surfaceId: 'probe', components: new Map(), dataModelWrites: new Map() },
		}),
	};
});

const update = (components: unknown[]) => ({ version: '1.0', updateComponents: { surfaceId: 'probe', components } });

describe('generative surface session — rendered-node budget behind the policy', () => {
	it('drops a tree the resolver built past the budget and restores the previous one', () => {
		const session = createGenerativeSurfaceSession();
		expect(
			session.apply([
				{ version: '1.0', createSurface: { surfaceId: 'probe', catalogId: CATALOG } },
				update([{ id: 'root', component: 'Text', text: 'kept' }]),
			]),
		).toBe(true);
		const kept = session.root;
		// 2^9 + … nodes from 20 definitions: within what the resolver can build in a test, far
		// over the budget.
		expect(session.apply(update(diamondComponents(8)))).toBe(false);
		expect(session.refusals.map((r) => r.code)).toEqual(['too_many_rendered_nodes']);
		expect(session.root?.type).toBe('Text');
		expect(session.root?.componentId).toBe(kept?.componentId);
		expect(session.batches).toBe(1);
	});
});
