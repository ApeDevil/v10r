/** Embed kind -> dynamic import, so each embed component code-splits. */
export const embedRegistry: Record<string, () => Promise<{ default: unknown }>> = {
	scene: () => import('./SceneEmbed.svelte'),
};
