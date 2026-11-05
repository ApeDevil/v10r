<script lang="ts">
import { tick } from 'svelte';
import { Button, Select } from '#lib/components/primitives/index.ts';
import type { AttributeDiagnostic, AttributeEngine } from '#lib/dynamic-attributes/index.ts';
import * as m from '#lib/paraglide/messages.js';
import AttributeRow from './AttributeRow.svelte';
import type { AttributeEditorState } from './attribute-editor.svelte.ts';
import { type AttributeControls, coreAttributeControls } from './controls.ts';
import { refusalMessage } from './presentation.ts';

/**
 * The generic editor of one self-describing record. It knows no domain and no storage: it
 * renders `editor.record` with the controls it is given and turns every gesture into an
 * operation on `editor`. Embed it in a form, a settings page or a desk panel alike.
 */
interface Props {
	editor: AttributeEditorState;
	engine: AttributeEngine;
	controls?: AttributeControls;
	readonly?: boolean;
	/** Accessible name of the attribute list. */
	label?: string;
}

let {
	editor,
	engine,
	controls = coreAttributeControls,
	readonly = false,
	label = m.attributes_list_label(),
}: Props = $props();

const idPrefix = $props.id();
let addKind = $state('text');
const addOptions = $derived(
	engine.kinds.ids.filter((id) => controls[id]).map((id) => ({ value: id, label: controls[id].label() })),
);
const findingsById = $derived.by(() => {
	const map = new Map<string, AttributeDiagnostic[]>();
	for (const d of editor.diagnostics) map.set(d.attributeId, [...(map.get(d.attributeId) ?? []), d]);
	return map;
});
const NO_FINDINGS: AttributeDiagnostic[] = [];
const removed = $derived([...editor.record.removed].reverse());

async function add() {
	const id = editor.add({ kind: addKind });
	if (!id) return;
	await tick();
	document.getElementById(`${idPrefix}-${id}-label`)?.focus();
}

async function restore(id: string) {
	if (editor.restore(id) === null) return;
	await tick();
	document.getElementById(`${idPrefix}-${id}-label`)?.focus();
}
</script>

<section class="attribute-editor" aria-label={label}>
	{#if !readonly}
		<div class="toolbar">
			<Button variant="ghost" size="icon" disabled={!editor.canUndo} aria-label={m.attributes_undo()} onclick={editor.undo}>
				<span class="i-lucide-undo-2 h-4 w-4" aria-hidden="true"></span>
			</Button>
			<Button variant="ghost" size="icon" disabled={!editor.canRedo} aria-label={m.attributes_redo()} onclick={editor.redo}>
				<span class="i-lucide-redo-2 h-4 w-4" aria-hidden="true"></span>
			</Button>
			<span class="count text-fluid-xs text-muted">
				{m.attributes_count({ count: editor.record.attributes.length, max: engine.limits.attributes })}
			</span>
		</div>
	{/if}

	{#if editor.record.attributes.length === 0}
		<p class="empty text-fluid-sm text-muted">{m.attributes_empty()}</p>
	{:else}
		<ol class="attribute-list">
			{#each editor.record.attributes as attribute, index (attribute.id)}
				<AttributeRow
					{attribute}
					{index}
					count={editor.record.attributes.length}
					{editor}
					{engine}
					{controls}
					{idPrefix}
					{readonly}
					findings={findingsById.get(attribute.id) ?? NO_FINDINGS}
				/>
			{/each}
		</ol>
	{/if}

	{#if !readonly}
		<div class="add-bar">
			<Button variant="outline" onclick={add} disabled={editor.atLimit}>
				<span class="i-lucide-plus h-4 w-4" aria-hidden="true"></span>
				{m.attributes_add()}
			</Button>
			<Select class="add-kind" options={addOptions} bind:value={addKind} />
		</div>
	{/if}

	<p class="sr-only" role="status" aria-live="polite">
		{editor.refusal ? refusalMessage(editor.refusal) : ''}
	</p>
	{#if editor.refusal}
		<p class="refusal text-fluid-sm" aria-hidden="true">{refusalMessage(editor.refusal)}</p>
	{/if}

	{#if !readonly && removed.length > 0}
		<details class="removed">
			<summary class="text-fluid-sm">{m.attributes_removed_heading({ count: removed.length })}</summary>
			<ul>
				{#each removed as entry (entry.attribute.id)}
					<li>
						<span class="text-fluid-sm">{entry.attribute.label || m.attributes_unlabelled()}</span>
						<Button
							variant="ghost"
							size="sm"
							aria-label={m.attributes_restore_aria({ label: entry.attribute.label || m.attributes_unlabelled() })}
							onclick={() => restore(entry.attribute.id)}
						>
							{m.attributes_restore()}
						</Button>
					</li>
				{/each}
			</ul>
		</details>
	{/if}
</section>

<style>
	.attribute-editor {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
		min-width: 0;
	}

	.toolbar {
		display: flex;
		align-items: center;
		gap: var(--spacing-1);
	}

	.count {
		margin-left: auto;
	}

	.attribute-list {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.add-bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--spacing-2);
	}

	.add-bar :global(.add-kind) {
		min-width: 9rem;
	}

	.refusal {
		color: var(--color-error);
	}

	.removed ul {
		margin: var(--spacing-2) 0 0;
		padding: 0;
		list-style: none;
	}

	.removed li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-2);
		overflow-wrap: anywhere;
	}
</style>
