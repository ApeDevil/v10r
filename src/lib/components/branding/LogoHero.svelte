<script lang="ts">
import heroSvg from '../../../../static/logo/logo-hero.svg?raw';

interface Props {
	class?: string;
}

let { class: className }: Props = $props();
</script>

<div class="logo-hero {className ?? ''}" aria-hidden="true">
	{@html heroSvg}
</div>

<style>
	.logo-hero {
		color: var(--color-fg);
		opacity: 0.40;
		width: 100%;
	}

	.logo-hero :global(svg) {
		width: 100%;
		height: auto;
		display: block;
	}

	@media (forced-colors: active) {
		.logo-hero {
			opacity: 1;
		}
	}
</style>
