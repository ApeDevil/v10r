/**
 * Static radius registry — border-radius preset definitions.
 */

import type { RadiusId, RadiusSet } from './types';

const R1: RadiusSet = {
	id: 'R1' as RadiusId,
	name: 'Sharp',
	description: 'Minimal rounding — neobrutalist, technical feel.',
	sm: '0',
	md: '0',
	lg: '2px',
	xl: '4px',
	full: '4px',
};

const R2: RadiusSet = {
	id: 'R2' as RadiusId,
	name: 'Smooth',
	description: 'Standard rounding — balanced, professional.',
	sm: '0.25rem',
	md: '0.375rem',
	lg: '0.5rem',
	xl: '0.75rem',
	full: '9999px',
};

const R3: RadiusSet = {
	id: 'R3' as RadiusId,
	name: 'Round',
	description: 'Generous rounding — friendly, app-like.',
	sm: '0.5rem',
	md: '0.75rem',
	lg: '1rem',
	xl: '1.25rem',
	full: '9999px',
};

export const RADIUS_REGISTRY: readonly RadiusSet[] = [R1, R2, R3] as const;

export const RADIUS_IDS: readonly [RadiusId, ...RadiusId[]] = [R1.id, R2.id, R3.id];

export function getRadius(id: RadiusId): RadiusSet | undefined {
	return RADIUS_REGISTRY.find((r) => r.id === id);
}
