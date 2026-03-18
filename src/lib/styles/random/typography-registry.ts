/**
 * Static typography registry — font family definitions for each typography set.
 * All sets use JetBrains Mono for monospace.
 */

import type { TypographyId, TypographySet } from './types';

const T1: TypographySet = {
	id: 'T1' as TypographyId,
	name: 'Clean',
	description: 'Inter for everything — modern, neutral, highly readable.',
	heading: '"Inter Variable", "Inter", system-ui, sans-serif',
	body: '"Inter Variable", "Inter", system-ui, sans-serif',
	mono: '"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, monospace',
};

const T2: TypographySet = {
	id: 'T2' as TypographyId,
	name: 'Editorial',
	description: 'Playfair Display headings with Space Grotesk body — classic meets modern.',
	heading: '"Playfair Display Variable", "Playfair Display", Georgia, serif',
	body: '"Space Grotesk Variable", "Space Grotesk", system-ui, sans-serif',
	mono: '"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, monospace',
};

const T3: TypographySet = {
	id: 'T3' as TypographyId,
	name: 'Technical',
	description: 'Space Grotesk headings with Inter body — geometric and precise.',
	heading: '"Space Grotesk Variable", "Space Grotesk", system-ui, sans-serif',
	body: '"Inter Variable", "Inter", system-ui, sans-serif',
	mono: '"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, monospace',
};

export const TYPOGRAPHY_REGISTRY: readonly TypographySet[] = [T1, T2, T3] as const;

export const TYPOGRAPHY_IDS: readonly [TypographyId, ...TypographyId[]] = [T1.id, T2.id, T3.id];

export function getTypography(id: TypographyId): TypographySet | undefined {
	return TYPOGRAPHY_REGISTRY.find((t) => t.id === id);
}
