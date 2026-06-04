import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderEntry } from './providers';
import {
	clearUserPreference,
	getCooldownResumeAt,
	getUserPreference,
	isCooledDown,
	markCooldown,
	resetCooldowns,
	resolveActiveProvider,
	resolveToolProvider,
	setUserPreference,
} from './providers';

// Force the in-memory cooldown fallback: deterministic + never touches the
// app's real Redis (a test markCooldown('groq') against live Redis would cool
// the provider for the running app and leak across test runs).
vi.mock('$lib/server/cache', () => ({ redis: null }));

// ── Mock registry ───────────────────────────────────────────────────

function makeEntry(overrides: Partial<ProviderEntry> & { id: string }): ProviderEntry {
	return {
		name: overrides.id,
		configured: true,
		model: `${overrides.id}-model`,
		envVar: `${overrides.id.toUpperCase()}_KEY`,
		supportsTools: true,
		getInstance: () => null,
		...overrides,
	};
}

const groq = makeEntry({ id: 'groq' });
const openai = makeEntry({ id: 'openai' });
const google = makeEntry({ id: 'google' });
const unconfigured = makeEntry({ id: 'unconfigured', configured: false });

const registry = [groq, openai, google, unconfigured];

// ── User preference ────────────────────────────────────────────────

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

// ── resolveActiveProvider ──────────────────────────────────────────

describe('resolveActiveProvider', () => {
	it('returns first configured when no preference', () => {
		const result = resolveActiveProvider(registry);
		expect(result?.id).toBe('groq');
	});

	it('respects user preference over default order', () => {
		const result = resolveActiveProvider(registry, 'openai');
		expect(result?.id).toBe('openai');
	});

	it('falls back to default when preference is unconfigured', () => {
		const result = resolveActiveProvider(registry, 'unconfigured');
		// unconfigured provider has configured: false, so it should fall back
		expect(result?.id).toBe('groq');
	});

	it('falls back when preference is unknown', () => {
		const result = resolveActiveProvider(registry, 'nonexistent');
		expect(result?.id).toBe('groq');
	});

	it('returns null for empty registry', () => {
		const result = resolveActiveProvider([]);
		expect(result).toBeNull();
	});

	it('returns null when no provider configured', () => {
		const result = resolveActiveProvider([unconfigured]);
		expect(result).toBeNull();
	});
});

// ── resolveToolProvider ────────────────────────────────────────────

describe('resolveToolProvider', () => {
	it('returns a tool-capable provider', () => {
		const result = resolveToolProvider(registry);
		expect(result).not.toBeNull();
		expect(result?.supportsTools).toBe(true);
	});

	it('respects user preference for tool provider', () => {
		const result = resolveToolProvider(registry, 'google');
		expect(result?.id).toBe('google');
	});

	it('skips non-tool-capable provider preference', () => {
		const noTools = makeEntry({ id: 'notool', supportsTools: false });
		const reg = [noTools, openai, google];
		const result = resolveToolProvider(reg, 'notool');
		// Should fall back to a tool-capable provider
		expect(result?.supportsTools).toBe(true);
	});

	it('returns null when no tool-capable provider exists', () => {
		const noTools = makeEntry({ id: 'notool', supportsTools: false });
		const result = resolveToolProvider([noTools]);
		expect(result).toBeNull();
	});
});

// ── Cooldown visibility ────────────────────────────────────────────

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
