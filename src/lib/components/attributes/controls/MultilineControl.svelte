<script lang="ts">
import { Textarea } from '#lib/components/primitives/index.ts';
import type { AttributeControlProps } from '../controls.ts';

let { attribute, limits, inputId, labelledBy, disabled, commit }: AttributeControlProps = $props();
</script>

<Textarea
	id={inputId}
	aria-labelledby={labelledBy}
	maxlength={limits.multilineLength}
	rows={3}
	{disabled}
	bind:value={() => attribute.value as string, (next) => commit(next ?? '')}
/>
