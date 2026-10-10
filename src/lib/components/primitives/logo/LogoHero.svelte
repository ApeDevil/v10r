<script lang="ts">
import markup from './logo-hero.svg?raw';
import maskUrl from './logo-hero.svg?url';

interface Props {
	class?: string;
}

let { class: className }: Props = $props();

/**
 * The raptor is the home page's LCP element on mobile, so the server inlines it and it
 * paints with the document. As a CSS mask it was discovered only after the stylesheet
 * and layout, then shared a Slow 4G link with every module preload: lab LCP (Slow 4G,
 * 4× CPU) 4.4 s, landing with the load event; inline, 1.8 s — and the LCP element became
 * the tagline. A preload did not help: it started the fetch 450 ms sooner and the file
 * still finished with everything else.
 *
 * Server only. The client holds a one-element placeholder instead, so the ~40 KB gz
 * string is tree-shaken out of the bundle — inlined on both sides it would ship twice.
 * Hydration keeps the server's SVG: for a non-empty `{@html}` value Svelte adopts the
 * existing nodes and ignores the client value by design (`hydration_html_changed`). The
 * value must not be `''` — an empty one skips adoption and the inline SVG is discarded.
 * After a client-side navigation the placeholder renders, and draws the same picture as
 * a CSS mask from a hashed, immutably cached file.
 */
const inlineMarkup = import.meta.env.SSR ? markup : '<span class="logo-hero-mask"></span>';
</script>

<div class="logo-hero {className ?? ''}" style:--logo-mask="url({maskUrl})" aria-hidden="true">
	<!-- svelte-ignore hydration_html_changed -->
	{@html inlineMarkup}
</div>

<style>
	.logo-hero {
		width: 100%;
		aspect-ratio: 232.304 / 236.144;
		color: var(--color-fg);
		opacity: 0.4;
	}

	.logo-hero :global(svg),
	.logo-hero :global(.logo-hero-mask) {
		display: block;
		width: 100%;
		height: 100%;
	}

	.logo-hero :global(.logo-hero-mask) {
		background-color: currentColor;
		-webkit-mask: var(--logo-mask) no-repeat center / contain;
		mask: var(--logo-mask) no-repeat center / contain;
	}

	@media (forced-colors: active) {
		.logo-hero {
			color: CanvasText;
			opacity: 1;
		}
	}
</style>
