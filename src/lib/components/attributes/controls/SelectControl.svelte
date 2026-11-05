<script lang="ts">
import { Button, Input, Select } from '#lib/components/primitives/index.ts';
import type { SelectOption } from '#lib/dynamic-attributes/index.ts';
import * as m from '#lib/paraglide/messages.js';
import type { AttributeControlProps } from '../controls.ts';

let { attribute, limits, inputId, disabled, commit, configure }: AttributeControlProps = $props();

const options = $derived((attribute.config.options as unknown as SelectOption[] | undefined) ?? []);
let editing = $state(false);

/** Option ids are minted, never typed: relabelling an option keeps every value that chose it. */
function nextId(): string {
	const used = new Set(options.map((o) => o.id));
	let n = options.length + 1;
	while (used.has(`option-${n}`)) n++;
	return `option-${n}`;
}

function setOptions(next: SelectOption[]) {
	configure({ options: next.map(({ id, label }) => ({ id, label })) });
}
</script>

<div class="select-control">
	<Select
		options={[{ value: '', label: m.attributes_select_none() }, ...options.map((o) => ({ value: o.id, label: o.label || o.id }))]}
		value={(attribute.value as string | null) ?? ''}
		{disabled}
		onchange={(next) => commit(next === '' ? null : next)}
	/>
	{#if !disabled}
		<Button
			variant="ghost"
			size="sm"
			aria-expanded={editing}
			aria-controls="{inputId}-options"
			onclick={() => (editing = !editing)}
		>
			<span class="i-lucide-settings-2 h-4 w-4" aria-hidden="true"></span>
			{m.attributes_select_edit_options()}
		</Button>
	{/if}
	{#if editing}
		<ul id="{inputId}-options" class="option-list" aria-label={m.attributes_select_options()}>
			{#each options as option, i (option.id)}
				<li class="option-row">
					<Input
						aria-label={m.attributes_select_option_label({ number: i + 1 })}
						maxlength={limits.labelLength}
						bind:value={
							() => option.label,
							(label) => setOptions(options.map((o) => (o.id === option.id ? { ...o, label: label ?? '' } : o)))
						}
					/>
					<Button
						variant="ghost"
						size="icon"
						aria-label={m.attributes_select_remove_option({ label: option.label || option.id })}
						onclick={() => setOptions(options.filter((o) => o.id !== option.id))}
					>
						<span class="i-lucide-x h-4 w-4" aria-hidden="true"></span>
					</Button>
				</li>
			{/each}
		</ul>
		<Button
			variant="outline"
			size="sm"
			disabled={options.length >= limits.options}
			onclick={() => setOptions([...options, { id: nextId(), label: '' }])}
		>
			<span class="i-lucide-plus h-4 w-4" aria-hidden="true"></span>
			{m.attributes_select_add_option()}
		</Button>
	{/if}
</div>

<style>
	.select-control {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--spacing-2);
	}

	.select-control > :global(*) {
		max-width: 100%;
	}

	.option-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		width: 100%;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.option-row {
		display: flex;
		align-items: center;
		gap: var(--spacing-1);
	}
</style>
