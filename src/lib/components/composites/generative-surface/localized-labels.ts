/**
 * The renderer's own words in the request locale (i18n keys `composites_generative_surface_*`),
 * for every page that shows a generative surface: the chat thread and the interop showcase
 * read the same set, so a label added to `GenerativeSurfaceLabels` is translated once.
 */
import * as m from '#lib/paraglide/messages.js';
import type { GenerativeSurfaceLabels } from './labels.ts';

export function localizedGenerativeSurfaceLabels(): GenerativeSurfaceLabels {
	const flowKinds: Record<string, () => string> = {
		client: m.composites_generative_surface_flow_kind_client,
		server: m.composites_generative_surface_flow_kind_server,
		data: m.composites_generative_surface_flow_kind_data,
		external: m.composites_generative_surface_flow_kind_external,
		job: m.composites_generative_surface_flow_kind_job,
	};
	return {
		region: m.composites_generative_surface_region(),
		loading: m.composites_generative_surface_loading(),
		shown: m.composites_generative_surface_shown(),
		updated: m.composites_generative_surface_updated(),
		refused: m.composites_generative_surface_refused(),
		pending: m.composites_generative_surface_pending(),
		unsupported: (component) => m.composites_generative_surface_unsupported({ component }),
		chartCategory: m.composites_generative_surface_chart_category(),
		flowKind: (kind) => flowKinds[kind]?.() ?? kind,
	};
}
