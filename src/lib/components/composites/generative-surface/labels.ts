/**
 * The renderer's own words — everything a surface says that the model did not write. English
 * defaults; a page passes translated strings (i18n keys `composites_generative_surface_*`) through `labels`.
 */
export interface GenerativeSurfaceLabels {
	/** Accessible name of the surface region. */
	region: string;
	/** While the renderer chunk loads. */
	loading: string;
	/** Announced when the first batch has rendered. */
	shown: string;
	/** Announced when a later batch changed the surface. */
	updated: string;
	/** Announced and shown when a batch was refused. */
	refused: string;
	/** Placeholder for a component whose definition has not arrived yet. */
	pending: string;
	/** Fallback for a component the catalog does not define, or one that contains itself. */
	unsupported: (component: string) => string;
	/** Header of a Chart's label column, read to assistive tech only. */
	chartCategory: string;
	/** The kind of an ArchitectureFlow node, read out beside its label (`ARCHITECTURE_FLOW_KINDS`). */
	flowKind: (kind: string) => string;
}

const FLOW_KINDS: Record<string, string> = {
	client: 'Client',
	server: 'Server',
	data: 'Data',
	external: 'External service',
	job: 'Background job',
};

export const DEFAULT_GENERATIVE_SURFACE_LABELS: GenerativeSurfaceLabels = {
	region: 'Assistant surface',
	loading: 'Loading the surface…',
	shown: 'Surface shown.',
	updated: 'Surface updated.',
	refused: 'Part of this surface could not be shown because it broke the surface rules.',
	pending: 'Loading…',
	unsupported: (component) => `This part of the surface (${component}) cannot be shown.`,
	chartCategory: 'Category',
	flowKind: (kind) => FLOW_KINDS[kind] ?? kind,
};
