<script lang="ts">
import { Input } from '#lib/components/primitives/index.ts';
import type { AttributeControlProps } from '../controls.ts';

let { attribute, kind, limits, inputId, labelledBy, disabled, commit }: AttributeControlProps = $props();

// The native date input yields "" or "YYYY-MM-DD"; anything else is ignored, never stored.
function input(next: string) {
	const value = kind.fromText(next, attribute.config, limits);
	if (value !== undefined) commit(value);
}
</script>

<Input
	id={inputId}
	type="date"
	aria-labelledby={labelledBy}
	{disabled}
	bind:value={() => (attribute.value as string | null) ?? '', (next) => input(next ?? '')}
/>
