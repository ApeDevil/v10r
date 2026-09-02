/**
 * Provider configuration status for the admin AI console.
 *
 * Product code, despite having lived under `server/showcases/ai/` — the AI showcase is
 * asserted zero-server by `showcases/ai/leak-gate.test.ts`, so it never had a showcase
 * consumer; the only caller is the `/admin/ai` layout guard.
 */

import { providerRegistry } from './index';
import type { AiProviderStatus } from './types';

export function getProviderStatuses(): AiProviderStatus[] {
	return providerRegistry.map((p) => ({
		id: p.id,
		name: p.name,
		configured: p.configured,
		model: p.model,
		envVar: p.envVar,
	}));
}
