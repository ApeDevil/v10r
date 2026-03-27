<script lang="ts">
import footerSvg from '../../../../static/logo/logo-footer.svg?raw';

interface Props {
	class?: string;
}

let { class: className }: Props = $props();
</script>

<div class="logo-footer {className ?? ''}" aria-hidden="true">
	{@html footerSvg}
</div>

<style>
	.logo-footer {
		color: var(--color-fg);
		opacity: 0.28;
		height: 40px;
		width: auto;
	}

	.logo-footer :global(svg) {
		height: 100%;
		width: auto;
		display: block;
	}

	@media (forced-colors: active) {
		.logo-footer {
			opacity: 1;
		}
	}
</style>
