/**
 * `requiresApproval` — the per-tool hard-gate predicate: write/destructive tools must go
 * through a human-approved proposal; read/create do not.
 */
import { describe, expect, it } from 'vitest';
import { requiresApproval } from './governor';

describe('requiresApproval', () => {
	it('gates write and destructive tools', () => {
		expect(requiresApproval('write')).toBe(true);
		expect(requiresApproval('destructive')).toBe(true);
	});

	it('does not gate read or create tools', () => {
		expect(requiresApproval('read')).toBe(false);
		expect(requiresApproval('create')).toBe(false);
	});
});
