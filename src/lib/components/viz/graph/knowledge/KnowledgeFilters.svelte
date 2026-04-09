<script lang="ts">
import type { KnowledgeData } from './knowledge-types';

interface Props {
	data: KnowledgeData;
	searchQuery?: string;
	activeEntityTypes?: Set<string>;
	activeRelationshipTypes?: Set<string>;
	onFilterChange: (filters: {
		searchQuery: string;
		activeEntityTypes: Set<string>;
		activeRelationshipTypes: Set<string>;
	}) => void;
	class?: string;
}

let {
	data,
	searchQuery = '',
	// svelte-ignore state_referenced_locally
	activeEntityTypes = new Set(data.entityTypes),
	// svelte-ignore state_referenced_locally
	activeRelationshipTypes = new Set(data.relationshipTypes),
	onFilterChange,
	class: className,
}: Props = $props();

// svelte-ignore state_referenced_locally
let localSearch = $state(searchQuery);
// svelte-ignore state_referenced_locally
let localEntityTypes = $state(new Set(activeEntityTypes));
// svelte-ignore state_referenced_locally
let localRelTypes = $state(new Set(activeRelationshipTypes));

// Sync local state when parent resets filters (e.g. empty-state clear button)
$effect(() => {
	localSearch = searchQuery;
});
$effect(() => {
	localEntityTypes = new Set(activeEntityTypes);
});
$effect(() => {
	localRelTypes = new Set(activeRelationshipTypes);
});

function emitChange() {
	onFilterChange({
		searchQuery: localSearch,
		activeEntityTypes: new Set(localEntityTypes),
		activeRelationshipTypes: new Set(localRelTypes),
	});
}

function handleSearchInput(e: Event) {
	localSearch = (e.target as HTMLInputElement).value;
	emitChange();
}

function toggleEntityType(type: string) {
	const next = new Set(localEntityTypes);
	if (next.has(type)) {
		next.delete(type);
	} else {
		next.add(type);
	}
	localEntityTypes = next;
	emitChange();
}

function toggleRelType(type: string) {
	const next = new Set(localRelTypes);
	if (next.has(type)) {
		next.delete(type);
	} else {
		next.add(type);
	}
	localRelTypes = next;
	emitChange();
}

function clearFilters() {
	localSearch = '';
	localEntityTypes = new Set(data.entityTypes);
	localRelTypes = new Set(data.relationshipTypes);
	emitChange();
}

let hasActiveFilters = $derived(
	localSearch !== '' ||
		localEntityTypes.size !== data.entityTypes.length ||
		localRelTypes.size !== data.relationshipTypes.length,
);
</script>

<div class="knowledge-filters {className ?? ''}">
	<!-- Search -->
	<div class="filter-section">
		<label class="filter-label" for="kg-search">Search</label>
		<input
			id="kg-search"
			type="text"
			class="search-input"
			placeholder="Search nodes..."
			value={localSearch}
			oninput={handleSearchInput}
		/>
	</div>

	<!-- Entity types -->
	<fieldset class="filter-section">
		<legend class="filter-label">Entity types</legend>
		<div class="checkbox-group">
			{#each data.entityTypes as type}
				<label class="checkbox-item">
					<input
						type="checkbox"
						checked={localEntityTypes.has(type)}
						onchange={() => toggleEntityType(type)}
					/>
					<span class="checkbox-label">{type}</span>
				</label>
			{/each}
		</div>
	</fieldset>

	<!-- Relationship types -->
	<fieldset class="filter-section">
		<legend class="filter-label">Relationships</legend>
		<div class="checkbox-group">
			{#each data.relationshipTypes as type}
				<label class="checkbox-item">
					<input
						type="checkbox"
						checked={localRelTypes.has(type)}
						onchange={() => toggleRelType(type)}
					/>
					<span class="checkbox-label">{type}</span>
				</label>
			{/each}
		</div>
	</fieldset>

	{#if hasActiveFilters}
		<button type="button" class="clear-btn" onclick={clearFilters}>
			Clear filters
		</button>
	{/if}
</div>

<style>
	.knowledge-filters {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
		padding: var(--spacing-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--surface-1);
		min-width: 200px;
	}

	.filter-section {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		border: none;
		padding: 0;
		margin: 0;
	}

	.filter-label {
		font-size: 12px;
		font-weight: 600;
		color: var(--color-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 0;
	}

	.search-input {
		width: 100%;
		padding: var(--spacing-2) var(--spacing-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--surface-1);
		color: var(--color-fg);
		font-size: 13px;
		outline: none;
	}

	.search-input:focus {
		border-color: var(--color-primary);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 20%, transparent);
	}

	.checkbox-group {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}

	.checkbox-item {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		cursor: pointer;
		padding: var(--spacing-1) 0;
	}

	.checkbox-label {
		font-size: 13px;
		color: var(--color-fg);
	}

	.clear-btn {
		font-size: 12px;
		color: var(--color-primary);
		cursor: pointer;
		padding: var(--spacing-2);
		border-radius: var(--radius-sm);
		text-align: center;
	}

	.clear-btn:hover {
		background: var(--color-subtle);
	}

	.clear-btn:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}
</style>
