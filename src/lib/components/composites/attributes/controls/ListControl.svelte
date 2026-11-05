<script lang="ts">
import { TagInput } from '#lib/components/composites/index.ts';
import * as m from '#lib/paraglide/messages.js';
import type { AttributeControlProps } from '../controls.ts';

let { attribute, limits, inputId, labelledBy, disabled, commit }: AttributeControlProps = $props();
</script>

<TagInput
	id={inputId}
	aria-describedby={labelledBy}
	size="sm"
	max={limits.listItems}
	maxLength={limits.listItemLength}
	placeholder={m.attributes_list_placeholder()}
	{disabled}
	bind:value={() => attribute.value as string[], (next) => commit(next)}
/>
