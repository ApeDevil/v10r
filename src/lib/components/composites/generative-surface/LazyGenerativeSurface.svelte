<script lang="ts">
/**
 * LazyGenerativeSurface — the generative surface as pages and the chat client use it.
 *
 * It holds no A2UI code itself: the renderer and `@a2ui/web_core` (~70 KB gzip) are a
 * dynamic import, so they become their own chunk and load only when a surface is actually
 * shown — never with the route that merely could show one. Same props as `GenerativeSurface`.
 */
import type { ComponentProps } from 'svelte';
import type GenerativeSurface from './GenerativeSurface.svelte';
import { DEFAULT_GENERATIVE_SURFACE_LABELS } from './labels.ts';

type Props = ComponentProps<typeof GenerativeSurface>;

let props: Props = $props();

const renderer = import('./GenerativeSurface.svelte');
</script>

{#await renderer}
	<p class="text-fluid-sm text-muted" role="status">
		{props.labels?.loading ?? DEFAULT_GENERATIVE_SURFACE_LABELS.loading}
	</p>
{:then { default: Renderer }}
	<Renderer {...props} />
{:catch}
	<p class="text-fluid-sm text-error" role="alert">
		{props.labels?.refused ?? DEFAULT_GENERATIVE_SURFACE_LABELS.refused}
	</p>
{/await}
