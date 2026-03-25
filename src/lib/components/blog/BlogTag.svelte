<script lang="ts">
	import { Tag } from '$lib/components/primitives';
	import { resolveBlogTagVisuals } from '$lib/config/blog-tags';

	interface Props {
		tag: { slug: string; name: string };
		tier: 'domain' | 'category';
		size?: 'sm' | 'md';
		class?: string;
	}

	let { tag, tier, size = 'sm', class: className }: Props = $props();

	const visuals = $derived(resolveBlogTagVisuals(tag, tier));
</script>

{#if tier === 'domain' && visuals.chartColor}
	<span class="domain-tag" style="--tag-hue: var(--chart-{visuals.chartColor})">
		<Tag
			label={visuals.label}
			icon={visuals.icon}
			shape={visuals.shape}
			{size}
			class={className}
		/>
	</span>
{:else}
	<Tag
		label={visuals.label}
		glyph={visuals.glyph}
		shape={visuals.shape}
		variant="secondary"
		{size}
		class={className}
	/>
{/if}

<style>
	.domain-tag :global(.tag) {
		border: 1px solid var(--tag-hue);
		color: var(--tag-hue);
		background: color-mix(in srgb, var(--tag-hue) 10%, transparent);
	}
</style>
