<script lang="ts">
import { Dialog } from '$lib/components/primitives';
import { isSameVirtualTree, VIRTUAL_ROOT } from './explorer-actions';
import type { ExplorerState } from './explorer-state.svelte';
import type { ExplorerNode } from './node';

interface Props {
	explorerState: ExplorerState;
	source: ExplorerNode | null;
	onConfirm: (nodeId: string, newParentId: string | null) => void;
	onClose: () => void;
}

let { explorerState, source, onConfirm, onClose }: Props = $props();

let open = $state(false);
let search = $state('');
let highlightedIndex = $state(0);
let searchInput = $state<HTMLInputElement | null>(null);

// Sync open ⇄ source prop. When source turns null (parent closed), close the dialog.
// When dialog closes via overlay/X (open flips false), propagate to parent.
$effect(() => {
	if (source) open = true;
	else open = false;
});

$effect(() => {
	if (!open && source) onClose();
});

// Include "root" as a virtual target — moving to null parent.
interface Candidate {
	id: string | null;
	label: string;
	path: string;
	disabled: boolean;
}

let candidates = $derived.by<Candidate[]>(() => {
	if (!source) return [];
	const rootId = VIRTUAL_ROOT[source.source];
	const rootNode = rootId ? explorerState.getNode(rootId) : null;
	// Target the source's virtual root by its id so the server-side null mapping in
	// dispatchMove fires; label it "data" / "blog" / "assets" instead of "(root)".
	const root: Candidate = {
		id: rootNode?.id ?? null,
		label: rootNode?.label ?? '(root)',
		path: '',
		disabled: source.parentId === (rootNode?.id ?? null),
	};
	const rest = explorerState
		.getFolderNodes()
		.filter((n) => isSameVirtualTree(source, n))
		.map((n) => {
			const ancestors = explorerState.getBreadcrumbPath(n.id).map((a) => a.label);
			const path = ancestors.length > 0 ? `${ancestors.join(' / ')} / ${n.label}` : n.label;
			const disabled = explorerState.isCycleMove(source.id, n.id) || n.id === source.parentId;
			return { id: n.id, label: n.label, path, disabled };
		});
	return [root, ...rest];
});

let rootLabel = $derived.by(() => {
	if (!source) return 'matching';
	const rootId = VIRTUAL_ROOT[source.source];
	return explorerState.getNode(rootId ?? '')?.label ?? 'matching';
});

let filtered = $derived.by(() => {
	const q = search.trim().toLowerCase();
	if (!q) return candidates;
	return candidates.filter((c) => c.label.toLowerCase().includes(q));
});

$effect(() => {
	// Reset search + focus when a new source opens the dialog.
	void source;
	search = '';
	highlightedIndex = 0;
	if (source) {
		requestAnimationFrame(() => searchInput?.focus());
	}
});

$effect(() => {
	// Clamp highlightedIndex when filtered changes.
	void filtered;
	if (highlightedIndex >= filtered.length) highlightedIndex = Math.max(0, filtered.length - 1);
});

function confirmSelection() {
	const pick = filtered[highlightedIndex];
	if (!pick || pick.disabled || !source) return;
	onConfirm(source.id, pick.id);
	onClose();
}

function handleKeydown(e: KeyboardEvent) {
	if (e.key === 'Escape') {
		e.preventDefault();
		onClose();
		return;
	}
	if (e.key === 'ArrowDown') {
		e.preventDefault();
		highlightedIndex = Math.min(highlightedIndex + 1, filtered.length - 1);
		return;
	}
	if (e.key === 'ArrowUp') {
		e.preventDefault();
		highlightedIndex = Math.max(highlightedIndex - 1, 0);
		return;
	}
	if (e.key === 'Enter') {
		e.preventDefault();
		confirmSelection();
	}
}

function highlightMatch(label: string, query: string): { head: string; mark: string; tail: string } | null {
	if (!query) return null;
	const idx = label.toLowerCase().indexOf(query.toLowerCase());
	if (idx < 0) return null;
	return {
		head: label.slice(0, idx),
		mark: label.slice(idx, idx + query.length),
		tail: label.slice(idx + query.length),
	};
}
</script>

<Dialog bind:open title="Move to…" description={source ? `Move "${source.label}" into…` : ''}>
	<div class="move-dialog" role="presentation" onkeydown={handleKeydown}>
		<input
			bind:this={searchInput}
			bind:value={search}
			type="text"
			class="move-search"
			placeholder="Search folders…"
			aria-label="Search folders"
		/>

		<ul class="move-list" role="listbox" aria-label="Move target">
			{#if filtered.length === 0}
				<li class="move-empty">
					{#if search.trim()}
						No {rootLabel} folders match "{search.trim()}".
					{:else}
						No {rootLabel} folders yet.
					{/if}
				</li>
			{:else}
				{#each filtered as cand, i (cand.id ?? 'root')}
					{@const match = highlightMatch(cand.label, search.trim())}
					<li>
						<button
							type="button"
							class="move-item"
							class:highlighted={i === highlightedIndex}
							class:disabled={cand.disabled}
							disabled={cand.disabled}
							role="option"
							aria-selected={i === highlightedIndex}
							onmouseenter={() => {
								highlightedIndex = i;
							}}
							onclick={() => {
								highlightedIndex = i;
								confirmSelection();
							}}
						>
							<span class="i-lucide-folder move-icon" aria-hidden="true"></span>
							<span class="move-label">
								{#if match}
									{match.head}<mark>{match.mark}</mark>{match.tail}
								{:else}
									{cand.label}
								{/if}
							</span>
							{#if cand.path && cand.path !== cand.label}
								<span class="move-path">{cand.path}</span>
							{/if}
						</button>
					</li>
				{/each}
			{/if}
		</ul>

		<div class="move-footer">
			<span class="move-hint">↑↓ navigate · Enter confirm · Esc cancel</span>
		</div>
	</div>
</Dialog>

<style>
	.move-dialog {
		display: flex;
		flex-direction: column;
		gap: 8px;
		max-height: 60vh;
	}

	.move-search {
		width: 100%;
		padding: 8px 10px;
		font-size: 13px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-bg);
		color: var(--color-fg);
		outline: none;
	}

	.move-search:focus {
		border-color: var(--color-primary);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 20%, transparent);
	}

	.move-list {
		list-style: none;
		margin: 0;
		padding: 0;
		overflow-y: auto;
		max-height: 40vh;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
	}

	.move-empty {
		padding: 16px;
		text-align: center;
		font-size: 12px;
		color: var(--color-muted);
	}

	.move-item {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 6px 10px;
		border: none;
		background: transparent;
		color: var(--color-fg);
		text-align: left;
		font-size: 13px;
		cursor: pointer;
	}

	.move-item.highlighted:not(.disabled) {
		background: color-mix(in srgb, var(--color-primary) 12%, transparent);
	}

	.move-item.disabled {
		color: var(--color-muted);
		cursor: not-allowed;
		opacity: 0.5;
	}

	.move-icon {
		font-size: 14px;
		flex-shrink: 0;
		color: var(--color-muted);
	}

	.move-label {
		flex-shrink: 0;
	}

	.move-label :global(mark) {
		background: color-mix(in srgb, var(--color-primary) 20%, transparent);
		color: inherit;
		padding: 0;
	}

	.move-path {
		flex: 1;
		text-align: right;
		font-size: 11px;
		color: var(--color-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.move-footer {
		display: flex;
		justify-content: flex-end;
		font-size: 11px;
		color: var(--color-muted);
	}
</style>
