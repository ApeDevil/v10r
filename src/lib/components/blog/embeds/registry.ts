/**
 * Embed component registry.
 * Maps embed kind -> dynamic import of Svelte component.
 * Components are lazily loaded and code-split automatically.
 */
export const embedRegistry: Record<string, () => Promise<{ default: unknown }>> = {
	scene: () => import('./SceneEmbed.svelte'),
	// 'callout': () => import('./Callout.svelte'),
	// 'chart': () => import('./ChartEmbed.svelte'),
	// 'video': () => import('./VideoEmbed.svelte'),
};
