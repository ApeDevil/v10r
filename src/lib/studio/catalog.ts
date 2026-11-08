/**
 * Studio catalog — the single source of truth for the /studio hub, the nav dropdown and the
 * sitemap.
 *
 * Studio is where v10r's interactive engineering tools live. Each **area** is one tool with
 * its own overview and working modes; Architecture Engineering is the first. Adding an area
 * means one entry in `studioAreas` plus its routes under `(public)/studio/<id>/`.
 *
 * Copy is stored as Paraglide message-function references (`LabelFn`, the `nav.ts`
 * convention) so consumers resolve the current locale at render time.
 */
import type { LabelFn } from '#lib/nav/types.ts';
import * as m from '#lib/paraglide/messages.js';

export interface StudioMode {
	/** URL segment under the area: `/studio/<area>/<slug>`. */
	slug: string;
	icon: string;
	label: LabelFn;
	description: LabelFn;
}

export interface StudioArea {
	/** URL key under `/studio/`. */
	id: string;
	icon: string;
	title: LabelFn;
	description: LabelFn;
	modes: StudioMode[];
}

export const studioAreas: StudioArea[] = [
	{
		id: 'architecture',
		icon: 'i-lucide-network',
		title: m.studio_architecture_title,
		description: m.studio_architecture_description,
		modes: [
			{
				slug: 'explore',
				icon: 'i-lucide-compass',
				label: m.studio_mode_explore,
				description: m.studio_mode_explore_description,
			},
			{
				slug: 'design',
				icon: 'i-lucide-pencil-ruler',
				label: m.studio_mode_design,
				description: m.studio_mode_design_description,
			},
			{
				slug: 'engineer',
				icon: 'i-lucide-shield-check',
				label: m.studio_mode_engineer,
				description: m.studio_mode_engineer_description,
			},
		],
	},
];

export function studioAreaHref(area: StudioArea): `/studio/${string}` {
	return `/studio/${area.id}`;
}

export function studioModeHref(area: StudioArea, mode: StudioMode): `/studio/${string}` {
	return `/studio/${area.id}/${mode.slug}`;
}

export function findStudioArea(id: string): StudioArea | undefined {
	return studioAreas.find((area) => area.id === id);
}

/** Every Studio page path: the hub, each area overview and each mode. */
export function studioPaths(): string[] {
	return [
		'/studio',
		...studioAreas.flatMap((area) => [studioAreaHref(area), ...area.modes.map((mode) => studioModeHref(area, mode))]),
	];
}
