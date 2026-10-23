import { describe, expect, it, vi } from 'vitest';
import { leaveDecision } from './leave-guard.svelte';

vi.mock('$app/navigation', () => ({ beforeNavigate: vi.fn() }));

describe('leaveDecision', () => {
	it('never asks when nothing would be lost', () => {
		const confirmLeave = vi.fn(() => false);
		expect(leaveDecision(false, 'link', confirmLeave)).toBe('allow');
		expect(leaveDecision(false, 'leave', confirmLeave)).toBe('allow');
		expect(confirmLeave).not.toHaveBeenCalled();
	});

	it('cancels a document unload so the browser shows its own prompt, without a confirm of ours', () => {
		const confirmLeave = vi.fn(() => true);
		expect(leaveDecision(true, 'leave', confirmLeave)).toBe('cancel');
		expect(confirmLeave).not.toHaveBeenCalled();
	});

	it('asks before an in-app navigation and follows the answer', () => {
		expect(leaveDecision(true, 'link', () => true)).toBe('allow');
		expect(leaveDecision(true, 'goto', () => false)).toBe('cancel');
		expect(leaveDecision(true, 'popstate', () => false)).toBe('cancel');
	});
});
