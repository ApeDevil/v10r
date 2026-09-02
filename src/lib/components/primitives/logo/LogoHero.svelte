<script lang="ts">
interface Props {
	class?: string;
}

let { class: className }: Props = $props();
</script>

<!--
  Rendered as a CSS mask (cached static asset, themeable via background-color) rather
  than inlining ~155KB of `?raw` SVG into the homepage HTML. currentColor → background.
-->
<div class="logo-hero {className ?? ''}" aria-hidden="true"></div>

<style>
	.logo-hero {
		width: 100%;
		aspect-ratio: 232.304 / 236.144;
		background-color: var(--color-fg);
		opacity: 0.4;
		-webkit-mask: url(/logo/logo-hero.svg) no-repeat center / contain;
		mask: url(/logo/logo-hero.svg) no-repeat center / contain;
	}

	@media (forced-colors: active) {
		.logo-hero {
			background-color: CanvasText;
			opacity: 1;
		}
	}
</style>
