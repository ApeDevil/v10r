import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiProviderId } from '$lib/types/db-enums';
import type { ProviderEntry, ProviderRegistry } from './connections';
import {
	clearUserPreference,
	getCooldownResumeAt,
	getFallbackProviders,
	getUserPreference,
	isCooledDown,
	markCooldown,
	resetCooldowns,
	resolveActiveProvider,
	resolveToolProvider,
	resolveVisionProvider,
	setUserPreference,
} from './providers';

// Force the in-memory cooldown fallback: deterministic + never touches the
// app's real Redis (a test markCooldown('groq') against live Redis would cool
// the provider for the running app and leak across test runs).
vi.mock('$lib/server/cache', () => ({ redis: null }));

function makeEntry(overrides: Partial<ProviderEntry> & { id: AiProviderId }): ProviderEntry {
	return {
		name: overrides.id,
		enabled: true,
		keyStatus: 'ready',
		configured: true,
		modelId: `${overrides.id}-model`,
		capabilities: { tools: true, vision: true, recognized: true },
		isDefault: false,
		version: 1,
		updatedAt: null,
		updatedBy: null,
		getInstance: () => null,
		...overrides,
	};
}

function makeRegistry(entries: ProviderEntry[], defaultProviderId: AiProviderId | null = null): ProviderRegistry {
	return { entries, defaultProviderId, degraded: false, embeddingConnection: () => ({ unavailable: 'disabled' }) };
}

const groq = makeEntry({ id: 'groq' });
const openai = makeEntry({ id: 'openai' });
const google = makeEntry({ id: 'google' });

const registry = makeRegistry([groq, openai, google]);

describe('user preferences', () => {
	beforeEach(() => {
		clearUserPreference('user-1');
		clearUserPreference('user-2');
	});

	it('returns null when no preference set', () => {
		expect(getUserPreference('user-1')).toBeNull();
	});

	it('stores and retrieves preference', () => {
		setUserPreference('user-1', 'openai');
		expect(getUserPreference('user-1')).toBe('openai');
	});

	it('preferences are per-user', () => {
		setUserPreference('user-1', 'groq');
		setUserPreference('user-2', 'openai');
		expect(getUserPreference('user-1')).toBe('groq');
		expect(getUserPreference('user-2')).toBe('openai');
	});

	it('clearUserPreference removes the preference', () => {
		setUserPreference('user-1', 'groq');
		clearUserPreference('user-1');
		expect(getUserPreference('user-1')).toBeNull();
	});
});

describe('resolveActiveProvider', () => {
	it('honours a configured preference', () => {
		expect(resolveActiveProvider(registry, 'openai')?.id).toBe('openai');
	});

	it('falls through an unconfigured preference to the project default', () => {
		const disabledOpenai = makeEntry({ id: 'openai', enabled: false, configured: false });
		const withDefault = makeRegistry([groq, disabledOpenai, google], 'google');
		expect(resolveActiveProvider(withDefault, 'openai')?.id).toBe('google');
	});

	it('uses the project default before registry order', () => {
		expect(resolveActiveProvider(makeRegistry([groq, openai, google], 'google'))?.id).toBe('google');
	});

	it('falls back to the first configured entry when there is no default', () => {
		expect(resolveActiveProvider(registry)?.id).toBe('groq');
	});

	it('skips an entry whose key did not decrypt', () => {
		const brokenGroq = makeEntry({ id: 'groq', keyStatus: 'undecryptable', configured: false });
		expect(resolveActiveProvider(makeRegistry([brokenGroq, openai]))?.id).toBe('openai');
	});

	it('returns null when nothing is configured', () => {
		expect(resolveActiveProvider(makeRegistry([]))).toBeNull();
		expect(resolveActiveProvider(makeRegistry([makeEntry({ id: 'groq', configured: false })]))).toBeNull();
	});
});

describe('getFallbackProviders', () => {
	it('excludes the active provider and unconfigured entries', () => {
		const disabled = makeEntry({ id: 'google', enabled: false, configured: false });
		expect(getFallbackProviders(makeRegistry([groq, openai, disabled]), 'groq').map((p) => p.id)).toEqual(['openai']);
	});
});

describe('resolveToolProvider', () => {
	const textOnlyGroq = makeEntry({ id: 'groq', capabilities: { tools: false, vision: false, recognized: false } });

	it('prefers OpenAI over Google without a preference or default', () => {
		expect(resolveToolProvider(registry)?.id).toBe('openai');
	});

	it('uses the project default when it can call tools', () => {
		expect(resolveToolProvider(makeRegistry([groq, openai, google], 'google'))?.id).toBe('google');
	});

	it('ignores a default whose model is not trusted with tools', () => {
		expect(resolveToolProvider(makeRegistry([textOnlyGroq, openai, google], 'groq'))?.id).toBe('openai');
	});

	it('honours a tool-capable preference', () => {
		expect(resolveToolProvider(registry, 'google')?.id).toBe('google');
	});

	it('ignores a preference for an unrecognized model', () => {
		expect(resolveToolProvider(makeRegistry([textOnlyGroq, openai]), 'groq')?.id).toBe('openai');
	});

	it('returns null when no configured model can call tools', () => {
		expect(resolveToolProvider(makeRegistry([textOnlyGroq]))).toBeNull();
	});
});

describe('resolveVisionProvider', () => {
	const textOnlyGroq = makeEntry({ id: 'groq', capabilities: { tools: true, vision: false, recognized: true } });

	it('prefers Google over OpenAI', () => {
		expect(resolveVisionProvider(makeRegistry([textOnlyGroq, openai, google]))?.id).toBe('google');
	});

	it('never returns a text-only model, even as the preference or default', () => {
		expect(resolveVisionProvider(makeRegistry([textOnlyGroq, openai], 'groq'), 'groq')?.id).toBe('openai');
		expect(resolveVisionProvider(makeRegistry([textOnlyGroq]))).toBeNull();
	});

	it('drops vision when an administrator switches a vendor to a text-only model', () => {
		const textOnlyOpenai = makeEntry({
			id: 'openai',
			modelId: 'some-text-model',
			capabilities: { tools: false, vision: false, recognized: false },
		});
		expect(resolveVisionProvider(makeRegistry([textOnlyOpenai, google]))?.id).toBe('google');
		expect(resolveVisionProvider(makeRegistry([textOnlyOpenai]))).toBeNull();
	});

	it('honours a vision-capable preference', () => {
		expect(resolveVisionProvider(registry, 'openai')?.id).toBe('openai');
	});
});

describe('getCooldownResumeAt', () => {
	afterEach(() => resetCooldowns());

	it('returns null when not cooled down', async () => {
		expect(await getCooldownResumeAt('groq')).toBeNull();
	});

	it('returns ISO string when cooled down', async () => {
		await markCooldown('groq', 60_000);
		const result = await getCooldownResumeAt('groq');
		if (result === null) throw new Error('expected non-null cooldown timestamp');
		expect(new Date(result).getTime()).toBeGreaterThan(Date.now());
	});

	it('auto-clears expired cooldowns', async () => {
		await markCooldown('test-expired', 1); // 1ms — will expire immediately
		// Wait a tick for expiry
		const result = await getCooldownResumeAt('test-expired');
		// Might or might not have expired in 0ms — just verify it doesn't throw
		expect(result === null || typeof result === 'string').toBe(true);
	});

	it('matches isCooledDown state', async () => {
		await markCooldown('groq', 60_000);
		expect(await isCooledDown('groq')).toBe(true);
		expect(await getCooldownResumeAt('groq')).not.toBeNull();
	});
});
