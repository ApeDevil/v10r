/**
 * Embed component registry.
 * Maps embed kind -> dynamic import of Svelte component.
 * Phase 3: empty — embeds render as styled placeholders.
 */
export const embedRegistry: Record<string, () => Promise<{ default: unknown }>> = {
	// 'callout': () => import('./Callout.svelte'),
	// 'chart': () => import('./ChartEmbed.svelte'),
	// 'scene': () => import('./SceneEmbed.svelte'),
	// 'video': () => import('./VideoEmbed.svelte'),
};
