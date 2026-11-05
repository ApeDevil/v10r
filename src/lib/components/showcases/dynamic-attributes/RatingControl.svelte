<script lang="ts">
import type { AttributeControlProps } from '#lib/components/composites/attributes/index.ts';
import { Button } from '#lib/components/primitives/index.ts';
import * as m from '#lib/paraglide/messages.js';
import { RATING_MAX } from '#lib/showcases/dynamic-attributes/rating-kind.ts';

let { attribute, inputId, labelledBy, disabled, commit }: AttributeControlProps = $props();
const stars = Array.from({ length: RATING_MAX }, (_, i) => i + 1);
</script>

<div id={inputId} class="rating" role="group" aria-labelledby={labelledBy}>
	{#each stars as n (n)}
		<Button
			variant="ghost"
			size="icon"
			{disabled}
			aria-pressed={attribute.value === n}
			aria-label={m.showcase_dynamic_attributes_rating_star({ count: n })}
			onclick={() => commit(attribute.value === n ? null : n)}
		>
			<span
				class={(attribute.value as number | null) !== null && n <= (attribute.value as number) ? 'i-lucide-star star-on' : 'i-lucide-star'}
				aria-hidden="true"
			></span>
		</Button>
	{/each}
</div>

<style>
	.rating {
		display: flex;
		gap: var(--spacing-1);
	}

	.star-on {
		color: var(--color-warning);
	}
</style>
