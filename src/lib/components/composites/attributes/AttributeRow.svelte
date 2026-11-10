<script lang="ts">
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
	/** Move this row to `to` and focus the element `focusId` afterwards. */
	reorder: (id: string, to: number, focusId: string) => void;
	/** Pointer pressed on the grip: the editor runs the drag. */
	ongrip: (event: PointerEvent, id: string) => void;
	/** How far the row is dragged, in px; `null` when it is not being dragged. */
	dragOffset?: number | null;
	/** Where the drop indicator is drawn on this row while another row is dragged. */
	dropEdge?: 'before' | 'after' | null;
}

let {
	attribute,
	index,
	count,
	editor,
	engine,
	controls,
	findings,
	idPrefix,
	readonly = false,
	reorder,
	ongrip,
	dragOffset = null,
	dropEdge = null,
}: Props = $props();

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

const name = $derived(attribute.label || m.attributes_unlabelled());

/** Arrow keys move the row; `focusId` keeps focus on the control that moved it. */
function moveByKey(event: KeyboardEvent, focusId: string) {
	const to =
		event.key === 'ArrowUp'
			? index - 1
			: event.key === 'ArrowDown'
				? index + 1
				: event.key === 'Home'
					? 0
					: event.key === 'End'
						? count - 1
						: null;
	if (to === null) return;
	event.preventDefault();
	if (to >= 0 && to < count && to !== index) reorder(attribute.id, to, focusId);
}

function onkeydown(event: KeyboardEvent) {
	if (readonly || !event.altKey || !event.shiftKey) return;
	if (event.key === 'ArrowUp' || event.key === 'ArrowDown')
		moveByKey(event, (event.target as HTMLElement).id || `${base}-label`);
}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<li
	class="attribute-row"
	class:dragging={dragOffset !== null}
	class:drop-before={dropEdge === 'before'}
	class:drop-after={dropEdge === 'after'}
	class:has-grip={!readonly}
	style:translate={dragOffset === null ? undefined : `0 ${dragOffset}px`}
	data-attribute-id={attribute.id}
	{onkeydown}
>
	{#if !readonly}
		<div class="grip-cell">
			<Button
				id="{base}-grip"
				class="grip"
				variant="ghost"
				size="icon"
				aria-label={m.attributes_drag_handle({ label: name })}
				aria-keyshortcuts="ArrowUp ArrowDown Home End"
				title={m.attributes_drag_handle({ label: name })}
				onpointerdown={(event: PointerEvent) => ongrip(event, attribute.id)}
				onkeydown={(event: KeyboardEvent) => {
					if (!event.altKey && !event.shiftKey && !event.ctrlKey && !event.metaKey) moveByKey(event, `${base}-grip`);
				}}
			>
				<span class="i-lucide-grip-vertical h-4 w-4" aria-hidden="true"></span>
			</Button>
		</div>
	{/if}
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
				id="{base}-up"
				variant="ghost"
				size="icon"
				disabled={index === 0}
				aria-label={m.attributes_move_up({ label: name })}
				aria-keyshortcuts="Alt+Shift+ArrowUp"
				onclick={() => reorder(attribute.id, index - 1, index - 1 === 0 ? `${base}-down` : `${base}-up`)}
			>
				<span class="i-lucide-arrow-up h-4 w-4" aria-hidden="true"></span>
			</Button>
			<Button
				variant="ghost"
				size="icon"
				id="{base}-down"
				disabled={index === count - 1}
				aria-label={m.attributes_move_down({ label: name })}
				aria-keyshortcuts="Alt+Shift+ArrowDown"
				onclick={() => reorder(attribute.id, index + 1, index + 1 === count - 1 ? `${base}-up` : `${base}-down`)}
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
		background: var(--color-bg);
	}

	.attribute-row.has-grip {
		grid-template-columns: auto minmax(8rem, 1fr) minmax(10rem, 2fr) auto;
		grid-template-areas:
			'grip label value actions'
			'. notice notice notice'
			'. findings findings findings';
	}

	.grip-cell {
		grid-area: grip;
	}

	.grip-cell :global(.grip) {
		cursor: grab;
		touch-action: none;
		color: var(--color-muted);
	}

	.grip-cell :global(.grip:hover) {
		translate: none;
		color: var(--color-fg);
	}

	/* The lifted row follows the pointer above its neighbours; it does not reflow the list. */
	.attribute-row.dragging {
		position: relative;
		z-index: 1;
		box-shadow: var(--shadow-lg);
		border-radius: var(--radius-md);
	}

	.attribute-row.dragging .grip-cell :global(.grip) {
		cursor: grabbing;
	}

	.attribute-row.drop-before {
		box-shadow: inset 0 2px 0 var(--color-primary);
	}

	.attribute-row.drop-after {
		box-shadow: inset 0 -2px 0 var(--color-primary);
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

		.attribute-row.has-grip {
			grid-template-columns: auto 1fr;
			grid-template-areas: 'grip label' '. value' '. actions' 'notice notice' 'findings findings';
		}

		.row-actions {
			justify-content: flex-end;
		}
	}
</style>
