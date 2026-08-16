import { beforeEach, describe, expect, it } from 'vitest';
import { layerStack } from './layer-stack.svelte';

function clear() {
	while (layerStack.top) {
		layerStack.pop(layerStack.top);
	}
}

describe('layerStack', () => {
	beforeEach(clear);

	it('LIFO: last pushed layer is top', () => {
		layerStack.push('drawer');
		layerStack.push('menu');
		expect(layerStack.top).toBe('menu');
		expect(layerStack.isTop('menu')).toBe(true);
		expect(layerStack.isTop('drawer')).toBe(false);
		expect(layerStack.depth).toBe(2);
	});

	it('pop peels one layer and restores the one below', () => {
		layerStack.push('drawer');
		layerStack.push('menu');
		layerStack.pop('menu');
		expect(layerStack.isTop('drawer')).toBe(true);
		expect(layerStack.depth).toBe(1);
	});

	it('push is idempotent — re-pushing moves an id to the top without duplicating', () => {
		layerStack.push('drawer');
		layerStack.push('menu');
		layerStack.push('drawer');
		expect(layerStack.depth).toBe(2);
		expect(layerStack.top).toBe('drawer');
	});

	it('out-of-order pop: closing a lower layer keeps the top intact', () => {
		layerStack.push('drawer');
		layerStack.push('menu');
		layerStack.pop('drawer');
		expect(layerStack.isTop('menu')).toBe(true);
		expect(layerStack.depth).toBe(1);
	});

	it('empty stack: everyone is effectively top', () => {
		expect(layerStack.isTop('drawer')).toBe(true);
		expect(layerStack.depth).toBe(0);
		expect(layerStack.top).toBeNull();
	});

	it('pop of unknown id is a no-op', () => {
		layerStack.push('drawer');
		layerStack.pop('ghost');
		expect(layerStack.isTop('drawer')).toBe(true);
		expect(layerStack.depth).toBe(1);
	});

	// Regression guards for the effect_update_depth_exceeded freeze: components register
	// from inside $effect, so push/pop must untrack their own reads AND skip the state
	// write when nothing changes. The untrack half is untestable here — vitest runs the
	// node/SSR Svelte build where $effect/$effect.root are no-ops (verified E2E instead).
	// The no-op-write half is observable:
	it('push of the current top layer is a pure no-op', () => {
		layerStack.push('drawer');
		layerStack.push('menu');
		layerStack.push('menu');
		expect(layerStack.depth).toBe(2);
		expect(layerStack.top).toBe('menu');
		layerStack.pop('menu');
		expect(layerStack.top).toBe('drawer');
	});

	// ownsTop is what lets a layer yield to competing surfaces without dismissing
	// itself the moment its OWN menu opens — the mobile sidebar drawer regression:
	// a blanket `top !== 'sidebar-drawer'` guard closed the drawer on the tap that
	// opened its user menu, unmounting the menu before it could render.
	it('ownsTop: a layer opened from within is not foreign', () => {
		layerStack.push('sidebar-drawer');
		layerStack.push('user-menu-drawer', ['sidebar-drawer']);
		expect(layerStack.ownsTop('sidebar-drawer')).toBe(true);
		expect(layerStack.isTop('sidebar-drawer')).toBe(false);
	});

	it('ownsTop: ownership reaches through nested scopes', () => {
		layerStack.push('sidebar-drawer');
		layerStack.push('user-menu-panel', ['sidebar-drawer', 'user-menu-drawer']);
		expect(layerStack.ownsTop('sidebar-drawer')).toBe(true);
		expect(layerStack.ownsTop('user-menu-drawer')).toBe(true);
	});

	// The chain is captured at push time precisely for this: the user menu closes as
	// its sign-out confirm opens, so walking live stack entries would lose the trail.
	it('ownsTop: survives an intermediate owner closing', () => {
		layerStack.push('sidebar-drawer');
		layerStack.push('user-menu-drawer', ['sidebar-drawer']);
		layerStack.push('confirm-dialog', ['sidebar-drawer', 'user-menu-drawer']);
		layerStack.pop('user-menu-drawer');
		expect(layerStack.ownsTop('sidebar-drawer')).toBe(true);
	});

	it('ownsTop: a foreign layer still covers — the yield path must survive', () => {
		layerStack.push('sidebar-drawer');
		layerStack.push('desk-panels');
		expect(layerStack.ownsTop('sidebar-drawer')).toBe(false);
	});

	it('ownsTop: empty stack is owned by everyone (mirrors isTop)', () => {
		expect(layerStack.ownsTop('sidebar-drawer')).toBe(true);
	});

	// Without a browser (no window listeners → no interaction snapshot), wasTop must
	// degrade to plain isTop rather than throw or return stale answers.
	it('wasTop falls back to isTop when no interaction snapshot exists', () => {
		expect(layerStack.wasTop('anything')).toBe(true);
		layerStack.push('drawer');
		layerStack.push('menu');
		expect(layerStack.wasTop('menu')).toBe(true);
		expect(layerStack.wasTop('drawer')).toBe(false);
	});
});
