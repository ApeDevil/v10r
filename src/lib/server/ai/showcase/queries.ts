import { providerRegistry } from '../index';
import type { AIProviderStatus } from '../types';

/** Get status of all configured AI providers */
export function getProviderStatuses(): AIProviderStatus[] {
	return providerRegistry.map((p) => ({
		id: p.id,
		name: p.name,
		configured: p.configured,
		model: p.model,
		envVar: p.envVar,
	}));
}
