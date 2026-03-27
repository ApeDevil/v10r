<script lang="ts">
	import { Tag } from '$lib/components/primitives';

	interface Props {
		tag: { slug: string; name: string; icon?: string | null; color?: number | null; glyph?: string | null };
		tier: 'domain' | 'category';
		size?: 'sm' | 'md';
		class?: string;
	}

	let { tag, tier, size = 'sm', class: className }: Props = $props();

	const tagIcon = $derived(tag.icon || undefined);
	const tagColor = $derived(tag.color || undefined);
	const tagGlyph = $derived(tag.glyph || (!tag.icon ? tag.name.charAt(0).toUpperCase() : undefined));
</script>

{#if tagColor}
	<span class="colored-tag" style="--tag-hue: var(--chart-{tagColor})">
		<Tag
			label={tag.name}
			icon={tagIcon}
			glyph={!tagIcon ? tagGlyph : undefined}
			shape={tier === 'domain' ? 'pill' : 'rounded'}
			{size}
			class={className}
		/>
	</span>
{:else}
	<Tag
		label={tag.name}
		icon={tagIcon}
		glyph={!tagIcon ? tagGlyph : undefined}
		shape={tier === 'domain' ? 'pill' : 'rounded'}
		variant="secondary"
		{size}
		class={className}
	/>
{/if}

<style>
	.colored-tag :global(.tag) {
		border: 1px solid var(--tag-hue);
		color: var(--tag-hue);
		background: color-mix(in srgb, var(--tag-hue) 10%, transparent);
	}
</style>
