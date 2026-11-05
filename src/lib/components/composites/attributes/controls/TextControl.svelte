<script lang="ts">
import { Input } from '#lib/components/primitives/index.ts';
import type { AttributeControlProps } from '../controls.ts';

let { attribute, limits, inputId, labelledBy, disabled, commit }: AttributeControlProps = $props();
</script>

<Input
	id={inputId}
	aria-labelledby={labelledBy}
	maxlength={limits.textLength}
	{disabled}
	bind:value={() => attribute.value as string, (next) => commit(next ?? '')}
/>
