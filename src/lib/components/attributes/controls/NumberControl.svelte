<script lang="ts">
import { Input } from '#lib/components/primitives/index.ts';
import * as m from '#lib/paraglide/messages.js';
import type { AttributeControlProps } from '../controls.ts';

let { attribute, kind, limits, inputId, labelledBy, disabled, commit }: AttributeControlProps = $props();

/**
 * What is typed, which may not be a number yet ("-", "1e"). Only a parseable text is committed;
 * the record keeps its last number until then, and the field says why it did not take.
 */
let typed = $state<string | null>(null);
const shown = $derived(typed ?? kind.text(attribute.value, attribute.config));
const invalid = $derived(typed !== null && kind.fromText(typed, attribute.config, limits) === undefined);

function input(next: string) {
	typed = next;
	const value = kind.fromText(next, attribute.config, limits);
	if (value !== undefined) commit(value);
}
</script>

<Input
	id={inputId}
	aria-labelledby={labelledBy}
	inputmode="decimal"
	autocomplete="off"
	error={invalid}
	aria-describedby={invalid ? `${inputId}-error` : undefined}
	{disabled}
	bind:value={() => shown, (next) => input(next ?? '')}
	onblur={() => {
		if (!invalid) typed = null;
	}}
/>
{#if invalid}
	<p id="{inputId}-error" class="text-fluid-xs text-error mt-1">{m.attributes_number_invalid()}</p>
{/if}
