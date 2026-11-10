<script lang="ts">
import { tick } from 'svelte';
import { Button, Select } from '#lib/components/primitives/index.ts';
import type { AttributeDiagnostic, AttributeEngine } from '#lib/dynamic-attributes/index.ts';
import * as m from '#lib/paraglide/messages.js';
import AttributeRow from './AttributeRow.svelte';
import type { AttributeEditorState } from './attribute-editor.svelte.ts';
import { type AttributeControls, coreAttributeControls } from './controls.ts';
import { refusalMessage } from './presentation.ts';
import { dropGap, gapToIndex } from './row-drop-target.ts';

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

/** What the live region last said about a move; screen readers hear where the row went. */
let moveAnnouncement = $state('');

async function reorder(id: string, to: number, focusId: string) {
	if (editor.move(id, to) === null) return;
	const moved = editor.record.attributes[to];
	moveAnnouncement = m.attributes_moved({
		label: moved?.label || m.attributes_unlabelled(),
		position: to + 1,
		count: editor.record.attributes.length,
	});
	await tick();
	document.getElementById(focusId)?.focus();
}

/**
 * Pointer drag of a row by its grip. The rows are measured once when the drag starts (in page
 * coordinates, so scrolling mid-drag stays right); the dragged row only translates, so the list
 * never reflows until the drop, and the drop is one `move` — one undo step. Escape cancels.
 */
let drag = $state<{ id: string; from: number; offset: number; gap: number } | null>(null);
let listEl = $state<HTMLOListElement>();

function startDrag(event: PointerEvent, id: string) {
	if (readonly || event.button !== 0 || !listEl) return;
	const from = editor.record.attributes.findIndex((a) => a.id === id);
	if (from === -1) return;
	event.preventDefault();
	const grip = event.currentTarget as HTMLElement;
	grip.setPointerCapture(event.pointerId);
	const rows = [...listEl.querySelectorAll<HTMLElement>(':scope > li')];
	const midpoints = rows.map((row) => {
		const box = row.getBoundingClientRect();
		return box.top + window.scrollY + box.height / 2;
	});
	const startY = event.clientY + window.scrollY;
	drag = { id, from, offset: 0, gap: from };

	const onmove = (e: PointerEvent) => {
		if (!drag) return;
		const y = e.clientY + window.scrollY;
		drag = { ...drag, offset: y - startY, gap: dropGap(midpoints, y) };
	};
	const finish = (commit: boolean) => {
		grip.removeEventListener('pointermove', onmove);
		grip.removeEventListener('pointerup', onup);
		grip.removeEventListener('pointercancel', oncancel);
		grip.removeEventListener('lostpointercapture', oncancel);
		window.removeEventListener('keydown', onkey, true);
		const ended = drag;
		drag = null;
		if (!commit || !ended) return;
		const to = gapToIndex(ended.from, ended.gap);
		if (to !== null) void reorder(ended.id, to, grip.id);
	};
	const onup = () => finish(true);
	const oncancel = () => finish(false);
	const onkey = (e: KeyboardEvent) => {
		if (e.key !== 'Escape') return;
		e.preventDefault();
		e.stopPropagation();
		finish(false);
	};
	grip.addEventListener('pointermove', onmove);
	grip.addEventListener('pointerup', onup);
	grip.addEventListener('pointercancel', oncancel);
	grip.addEventListener('lostpointercapture', oncancel);
	window.addEventListener('keydown', onkey, true);
}

function dropEdge(index: number, count: number): 'before' | 'after' | null {
	if (!drag || gapToIndex(drag.from, drag.gap) === null) return null;
	if (drag.gap === index) return 'before';
	if (drag.gap === count && index === count - 1) return 'after';
	return null;
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
		<ol class="attribute-list" class:dragging={drag !== null} bind:this={listEl}>
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
					{reorder}
					ongrip={startDrag}
					dragOffset={drag?.id === attribute.id ? drag.offset : null}
					dropEdge={dropEdge(index, editor.record.attributes.length)}
				/>
			{/each}
		</ol>
	{/if}

	{#if !readonly}
		<div class="add-bar">
			<Select class="add-kind" aria-label={m.attributes_add_kind()} options={addOptions} bind:value={addKind} />
			<Button variant="outline" onclick={add} disabled={editor.atLimit}>
				<span class="i-lucide-plus h-4 w-4" aria-hidden="true"></span>
				{m.attributes_add()}
			</Button>
		</div>
	{/if}

	<p class="sr-only" role="status" aria-live="polite">
		{editor.refusal ? refusalMessage(editor.refusal) : moveAnnouncement}
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

	/* While a row is dragged, the page does not select text under the pointer. */
	.attribute-list.dragging {
		user-select: none;
		cursor: grabbing;
	}

	.add-bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--spacing-2);
	}

	.add-bar :global(.add-kind) {
		width: 12rem;
		max-width: 100%;
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
