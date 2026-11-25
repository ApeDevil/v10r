/**
 * The A2UI v1.0 agent-to-renderer messages a generative surface is built from, typed to the
 * subset v10r accepts: create, update components, update the data model, delete. (Renderer
 * function calls and agent function responses exist in the protocol; the v10r catalog has no
 * functions, so the policy refuses them.)
 */
import type { GenerativeUiComponentName } from './catalog.ts';

/** One component: envelope (`id`, `component`) plus the catalog's properties for its type. */
export interface GenerativeSurfaceComponent {
	id: string;
	component: GenerativeUiComponentName;
	[property: string]: unknown;
}

export type GenerativeSurfaceMessage =
	| {
			version: '1.0';
			createSurface: {
				surfaceId: string;
				catalogId: string;
				components?: GenerativeSurfaceComponent[];
				dataModel?: Record<string, unknown>;
				sendDataModel?: boolean;
			};
	  }
	| { version: '1.0'; updateComponents: { surfaceId: string; components: GenerativeSurfaceComponent[] } }
	| { version: '1.0'; updateDataModel: { surfaceId: string; path?: string; value: unknown } }
	| { version: '1.0'; deleteSurface: { surfaceId: string } };
