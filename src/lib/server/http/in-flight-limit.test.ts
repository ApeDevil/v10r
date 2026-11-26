import { describe, expect, it } from 'vitest';
import { createInFlightLimit } from './in-flight-limit';

describe('createInFlightLimit', () => {
	it('bounds work per key and per instance, and frees slots on leave', () => {
		const limit = createInFlightLimit(3, 2);
		const a1 = limit.tryEnter('a');
		const a2 = limit.tryEnter('a');
		expect(a1 && a2).toBeTruthy();
		expect(limit.tryEnter('a')).toBeNull(); // per-key bound
		const b1 = limit.tryEnter('b');
		expect(b1).toBeTruthy();
		expect(limit.tryEnter('c')).toBeNull(); // instance bound
		a1?.();
		expect(limit.tryEnter('c')).toBeTruthy();
	});

	it('ignores a second leave and drops empty keys', () => {
		const limit = createInFlightLimit(2, 2);
		const leave = limit.tryEnter('a');
		leave?.();
		leave?.();
		expect(limit.snapshot()).toEqual({ total: 0, keys: 0 });
	});
});
