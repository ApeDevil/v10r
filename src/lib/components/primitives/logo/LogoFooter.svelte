<script lang="ts">
interface Props {
	class?: string;
}

let { class: className }: Props = $props();
</script>

<!--
  Rendered as a CSS mask (cached static asset, themeable via background-color) rather
  than inlining ~84KB of `?raw` SVG into every page's HTML. currentColor → background.
-->
<div class="logo-footer {className ?? ''}" aria-hidden="true"></div>

<style>
	.logo-footer {
		height: 40px;
		aspect-ratio: 224.035 / 236.144;
		background-color: var(--color-fg);
		opacity: 0.28;
		-webkit-mask: url(/logo/logo-footer.svg) no-repeat center / contain;
		mask: url(/logo/logo-footer.svg) no-repeat center / contain;
	}

	@media (forced-colors: active) {
		.logo-footer {
			background-color: CanvasText;
			opacity: 1;
		}
	}
</style>
