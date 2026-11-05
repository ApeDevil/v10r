<script lang="ts">
import { tick } from 'svelte';
import { Button, Input, Select } from '#lib/components/primitives/index.ts';
import type { Attribute, AttributeDiagnostic, AttributeEngine } from '#lib/dynamic-attributes/index.ts';
import * as m from '#lib/paraglide/messages.js';
import type { AttributeEditorState } from './attribute-editor.svelte.ts';
import UnknownControl from './controls/UnknownControl.svelte';
import type { AttributeControl, AttributeControls } from './controls.ts';
import { findingMessage, loadControl } from './presentation.ts';

interface Props {
	attribute: Attribute;
	index: number;
	count: number;
	editor: AttributeEditorState;
	engine: AttributeEngine;
	controls: AttributeControls;
	findings: AttributeDiagnostic[];
	/** Prefix that keeps ids unique when several editors share a page. */
	idPrefix: string;
	readonly?: boolean;
}

let { attribute, index, count, editor, engine, controls, findings, idPrefix, readonly = false }: Props = $props();

const base = $derived(`${idPrefix}-${attribute.id}`);
const kind = $derived(engine.kinds.get(attribute.kind));
const control: AttributeControl | undefined = $derived(kind ? controls[attribute.kind] : undefined);
const kindOptions = $derived([
	...engine.kinds.ids.filter((id) => controls[id]).map((id) => ({ value: id, label: controls[id].label() })),
	...(kind && controls[attribute.kind] ? [] : [{ value: attribute.kind, label: attribute.kind, disabled: true }]),
]);
const previousKind = $derived(
	attribute.previous ? (controls[attribute.previous.kind]?.label() ?? attribute.previous.kind) : '',
);
const previousText = $derived.by(() => {
	const previous = attribute.previous;
	if (!previous) return '';
	const known = engine.kinds.get(previous.kind);
	return known ? known.text(previous.value, previous.config) : JSON.stringify(previous.value);
});
const messages = $derived(findings.map((f) => findingMessage(f.code)).filter((text): text is string => text !== null));

async function move(to: number) {
	if (editor.move(attribute.id, to) === null) return;
	await tick();
	document.getElementById(`${base}-handle`)?.focus();
}

function onkeydown(event: KeyboardEvent) {
	if (readonly || !event.altKey || !event.shiftKey) return;
	if (event.key === 'ArrowUp' && index > 0) {
		event.preventDefault();
		void move(index - 1);
	} else if (event.key === 'ArrowDown' && index < count - 1) {
		event.preventDefault();
		void move(index + 1);
	}
}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<li class="attribute-row" data-attribute-id={attribute.id} {onkeydown}>
	<div class="label-cell">
		<Input
			id="{base}-label"
			class="label-input"
			placeholder={m.attributes_label_placeholder()}
			aria-label={m.attributes_label_aria({ number: index + 1 })}
			maxlength={engine.limits.labelLength}
			disabled={readonly}
			bind:value={() => attribute.label, (next) => editor.relabel(attribute.id, next ?? '')}
			onkeydown={(event: KeyboardEvent) => {
				if (event.key === 'Enter') {
					event.preventDefault();
					document.getElementById(`${base}-value`)?.focus();
				}
			}}
		/>
	</div>

	<div class="value-cell">
		{#if kind && control?.component}
			<control.component
				{attribute}
				{kind}
				limits={engine.limits}
				inputId="{base}-value"
				labelledBy="{base}-label"
				disabled={readonly}
				commit={(value) => editor.setValue(attribute.id, value)}
				configure={(config) => editor.configure(attribute.id, config)}
			/>
		{:else if kind && control?.load}
			{#await loadControl(control) then Loaded}
				<Loaded
					{attribute}
					{kind}
					limits={engine.limits}
					inputId="{base}-value"
					labelledBy="{base}-label"
					disabled={readonly}
					commit={(value) => editor.setValue(attribute.id, value)}
					configure={(config) => editor.configure(attribute.id, config)}
				/>
			{/await}
		{:else}
			<UnknownControl {attribute} />
		{/if}
	</div>

	{#if !readonly}
		<div class="row-actions">
			<Select
				class="kind-select"
				aria-label={m.attributes_kind_of({ label: attribute.label || m.attributes_unlabelled() })}
				options={kindOptions}
				value={attribute.kind}
				onchange={(next) => {
					if (next !== attribute.kind) editor.changeKind(attribute.id, next);
				}}
			/>
			<Button
				id="{base}-handle"
				variant="ghost"
				size="icon"
				disabled={index === 0}
				aria-label={m.attributes_move_up({ label: attribute.label || m.attributes_unlabelled() })}
				aria-keyshortcuts="Alt+Shift+ArrowUp"
				onclick={() => move(index - 1)}
			>
				<span class="i-lucide-arrow-up h-4 w-4" aria-hidden="true"></span>
			</Button>
			<Button
				variant="ghost"
				size="icon"
				disabled={index === count - 1}
				aria-label={m.attributes_move_down({ label: attribute.label || m.attributes_unlabelled() })}
				aria-keyshortcuts="Alt+Shift+ArrowDown"
				onclick={() => move(index + 1)}
			>
				<span class="i-lucide-arrow-down h-4 w-4" aria-hidden="true"></span>
			</Button>
			<Button
				variant="ghost"
				size="icon"
				aria-label={m.attributes_remove({ label: attribute.label || m.attributes_unlabelled() })}
				onclick={() => editor.remove(attribute.id)}
			>
				<span class="i-lucide-trash-2 h-4 w-4" aria-hidden="true"></span>
			</Button>
		</div>
	{/if}

	{#if attribute.previous}
		<div class="previous-notice" role="note">
			<p class="text-fluid-sm">
				{m.attributes_previous_value({ kind: previousKind, value: previousText.slice(0, 120) })}
			</p>
			{#if !readonly}
				<div class="notice-actions">
					<Button variant="outline" size="sm" onclick={() => editor.restorePrevious(attribute.id)}>
						{m.attributes_previous_restore()}
					</Button>
					<Button variant="ghost" size="sm" onclick={() => editor.discardPrevious(attribute.id)}>
						{m.attributes_previous_discard()}
					</Button>
				</div>
			{/if}
		</div>
	{/if}

	{#if messages.length > 0}
		<ul class="findings text-fluid-xs text-muted">
			{#each messages as message}
				<li>{message}</li>
			{/each}
		</ul>
	{/if}
</li>

<style>
	.attribute-row {
		display: grid;
		grid-template-columns: minmax(8rem, 1fr) minmax(10rem, 2fr) auto;
		grid-template-areas:
			'label value actions'
			'notice notice notice'
			'findings findings findings';
		align-items: start;
		gap: var(--spacing-2) var(--spacing-3);
		padding: var(--spacing-2) 0;
		border-bottom: 1px solid var(--color-border);
	}

	.label-cell {
		grid-area: label;
		min-width: 0;
	}

	.value-cell {
		grid-area: value;
		min-width: 0;
	}

	.row-actions {
		grid-area: actions;
		display: flex;
		align-items: center;
		gap: var(--spacing-1);
	}

	.row-actions :global(.kind-select) {
		min-width: 8.5rem;
	}

	.previous-notice {
		grid-area: notice;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-2);
		padding: var(--spacing-2) var(--spacing-3);
		border-radius: var(--radius-md);
		background: var(--color-warning-light);
		color: var(--color-warning-fg);
		overflow-wrap: anywhere;
	}

	.notice-actions {
		display: flex;
		gap: var(--spacing-2);
	}

	.findings {
		grid-area: findings;
		margin: 0;
		padding-left: var(--spacing-4);
	}

	/* Phones: label above value, actions on their own line — every target stays ≥ 40 px. */
	@media (max-width: 640px) {
		.attribute-row {
			grid-template-columns: 1fr;
			grid-template-areas: 'label' 'value' 'actions' 'notice' 'findings';
		}

		.row-actions {
			justify-content: flex-end;
		}
	}
</style>
