import { describe, expect, it } from 'vitest';
import { COMMAND_VIA } from '$lib/types/journey-events';
import { isKnownEvent, sanitizeProperties } from './event-schema';

describe('command_invoked — the menu-review evidence event', () => {
	it('is allow-listed with a bounded door enum and a capped label', () => {
		expect(isKnownEvent('command_invoked')).toBe(true);
		const out = sanitizeProperties('command_invoked', {
			via: 'shortcut',
			command: 'View › Toggle Explorer'.padEnd(80, '!'),
			query: 'what the person typed',
		});
		expect(out.via).toBe('shortcut');
		expect((out.command as string).length).toBe(60);
		expect(out).not.toHaveProperty('query');
	});

	it('drops a door the client vocabulary does not know, and keeps the activity bar', () => {
		const out = sanitizeProperties('command_invoked', { via: 'toolbar', command: 'x' });
		expect(out).not.toHaveProperty('via');
		expect(COMMAND_VIA).not.toContain('toolbar');
		// The bar (and its mobile drawer) is the door most panel toggles come through.
		expect(sanitizeProperties('command_invoked', { via: 'bar', command: 'View › Toggle Explorer' }).via).toBe('bar');
	});
});
