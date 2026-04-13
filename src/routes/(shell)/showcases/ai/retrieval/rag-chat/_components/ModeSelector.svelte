<script lang="ts">
import { onMount } from 'svelte';

export type RagMode = 'vector' | 'small-to-big' | 'graph' | 'fused';

interface Props {
	value: RagMode;
	onchange: (mode: RagMode) => void;
}

let { value, onchange }: Props = $props();

const STORAGE_KEY = 'v10r:rag-chat:unlocked-modes';
const modes: {
	id: RagMode;
	label: string;
	subtitle: string;
}[] = [
	{ id: 'vector', label: 'Vector Search', subtitle: 'semantic + keyword hybrid' },
	{ id: 'small-to-big', label: 'Small-to-Big', subtitle: 'precise chunks, expanded parents' },
	{ id: 'graph', label: 'Entity Graph', subtitle: 'follow relationships' },
];

const fusedMode = { id: 'fused' as RagMode, label: 'All Three Fused', subtitle: 'run all, RRF fusion' };

let unlockedSet = $state<Set<RagMode>>(new Set());
const fusedUnlocked = $derived(
	unlockedSet.has('vector') && unlockedSet.has('small-to-big') && unlockedSet.has('graph'),
);

onMount(() => {
	try {
		const raw = sessionStorage.getItem(STORAGE_KEY);
		if (raw) {
			const arr = JSON.parse(raw) as RagMode[];
			unlockedSet = new Set(arr.filter((m) => m !== 'fused'));
		}
	} catch {
		// ignore
	}
});

function select(mode: RagMode) {
	if (mode === 'fused' && !fusedUnlocked) return;
	if (mode !== 'fused') {
		const next = new Set(unlockedSet);
		next.add(mode);
		unlockedSet = next;
		try {
			sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
		} catch {
			// ignore
		}
	}
	onchange(mode);
}
</script>

<div class="mode-selector" role="radiogroup" aria-label="Retrieval mode">
	{#each modes as mode (mode.id)}
		<button
			type="button"
			role="radio"
			aria-checked={value === mode.id}
			class="mode-pill"
			class:active={value === mode.id}
			onclick={() => select(mode.id)}
		>
			<span class="pill-label">{mode.label}</span>
			<span class="pill-subtitle">{mode.subtitle}</span>
		</button>
	{/each}

	<div class="divider" aria-hidden="true"></div>

	<button
		type="button"
		role="radio"
		aria-checked={value === 'fused'}
		aria-disabled={!fusedUnlocked}
		class="mode-pill fused"
		class:active={value === 'fused'}
		class:locked={!fusedUnlocked}
		disabled={!fusedUnlocked}
		title={fusedUnlocked ? fusedMode.subtitle : 'Try the three modes first'}
		onclick={() => select('fused')}
	>
		<span class="pill-label">
			{#if !fusedUnlocked}
				<span class="i-lucide-lock h-3 w-3 mr-1" aria-hidden="true"></span>
			{/if}
			{fusedMode.label}
		</span>
		<span class="pill-subtitle">{fusedMode.subtitle}</span>
	</button>
</div>

<style>
	.mode-selector {
		display: flex;
		align-items: stretch;
		gap: var(--spacing-1);
		padding: var(--spacing-1);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface-1);
	}

	.mode-pill {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		justify-content: center;
		gap: 2px;
		min-width: 0;
		padding: var(--spacing-2) var(--spacing-3);
		border: none;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-fg);
		cursor: pointer;
		text-align: left;
	}

	.mode-pill:hover:not(.locked):not(.active) {
		background: color-mix(in srgb, var(--color-muted) 10%, transparent);
	}

	.mode-pill.active {
		background: var(--color-primary);
		color: var(--color-primary-fg, white);
	}

	.mode-pill.locked {
		cursor: not-allowed;
		opacity: 0.5;
	}

	.pill-label {
		font-size: var(--text-fluid-sm);
		font-weight: 500;
		display: flex;
		align-items: center;
		white-space: nowrap;
	}

	.pill-subtitle {
		font-size: 10px;
		color: inherit;
		opacity: 0.7;
		white-space: nowrap;
	}

	.divider {
		width: 1px;
		align-self: stretch;
		background: var(--color-border);
		margin: 0 var(--spacing-1);
	}

	.mode-pill.fused:not(.active):not(.locked) {
		background: color-mix(in srgb, var(--color-muted) 8%, transparent);
	}

	@media (max-width: 640px) {
		.mode-selector {
			flex-wrap: wrap;
		}
		.divider {
			display: none;
		}
	}
</style>
