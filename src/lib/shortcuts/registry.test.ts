import { describe, expect, it, vi } from 'vitest';
import { findShortcutByKeys, getShortcutsByCategory, registerShortcut } from './registry';

describe('shortcut registry', () => {
	it('lists display-only shortcuts under their category but never dispatches them', () => {
		const off = registerShortcut({
			id: 'test:desk-close',
			keys: 'mod+w',
			description: 'Panel › Close Panel',
			category: 'desk',
			dispatch: false,
		});
		try {
			expect(getShortcutsByCategory().desk.map((s) => s.id)).toContain('test:desk-close');
			expect(findShortcutByKeys('mod+w')).toBeUndefined();
		} finally {
			off();
		}
		expect(getShortcutsByCategory().desk.map((s) => s.id)).not.toContain('test:desk-close');
	});

	it('matches dispatchable shortcuts regardless of modifier order and case', () => {
		const action = vi.fn();
		const off = registerShortcut({
			id: 'test:action',
			keys: 'shift+mod+x',
			description: 'Test',
			category: 'global',
			action,
		});
		try {
			expect(findShortcutByKeys('mod+shift+x')?.id).toBe('test:action');
			expect(findShortcutByKeys('MOD+SHIFT+X')?.id).toBe('test:action');
		} finally {
			off();
		}
	});
});
