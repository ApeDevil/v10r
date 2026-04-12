<script lang="ts">
import { fetchProviders, getEnabledScopes, getProviderState, switchProvider } from '$lib/components/composites/dock';
import { Spinner } from '$lib/components/primitives';

const state = $derived(getProviderState());
const configuredProviders = $derived(state.providers.filter((p) => p.configured));
const unconfiguredProviders = $derived(state.providers.filter((p) => !p.configured));
const hasToolScopes = $derived(getEnabledScopes().length > 0);

// Fetch on first render if not already loaded
$effect(() => {
	if (state.providers.length === 0 && !state.loading) {
		fetchProviders();
	}
});

function handleSelect(providerId: string) {
	if (providerId === state.activeId) return;
	switchProvider(providerId);
}

function handleReset() {
	switchProvider(null);
}

function formatCooldown(isoString: string): string {
	const remaining = Math.max(0, new Date(isoString).getTime() - Date.now());
	const seconds = Math.ceil(remaining / 1000);
	return `${seconds}s`;
}
</script>

<div class="provider-section">
	{#if state.loading && state.providers.length === 0}
		<div class="loading-state">
			<Spinner size="sm" />
			<span>Loading providers...</span>
		</div>
	{:else if state.error && state.providers.length === 0}
		<div class="error-state">
			<span class="i-lucide-alert-triangle" style="font-size: 16px;"></span>
			<span>{state.error}</span>
		</div>
	{:else}
		<!-- Configured providers -->
		{#if configuredProviders.length > 0}
			<div class="scope-group">
				<div class="group-header">Available providers</div>

				{#each configuredProviders as provider (provider.id)}
					{@const isActive = provider.id === state.activeId}
					{@const isCooledDown = !!provider.cooldownUntil}
					<button
						class="provider-row"
						class:active={isActive}
						class:cooled-down={isCooledDown}
						disabled={isCooledDown && !isActive}
						onclick={() => handleSelect(provider.id)}
						type="button"
					>
						<div class="radio-indicator" class:checked={isActive}>
							{#if isActive}
								<span class="radio-dot"></span>
							{/if}
						</div>
						<div class="provider-info">
							<span class="provider-name">
								{provider.name}
								{#if isActive}
									<span class="status-badge active">active</span>
								{/if}
								{#if isCooledDown}
									<span class="status-badge cooldown">cooling down {formatCooldown(provider.cooldownUntil!)}</span>
								{/if}
							</span>
							<span class="provider-model">{provider.model}</span>
						</div>
					</button>
				{/each}
			</div>
		{/if}

		<!-- Tool compatibility warning -->
		{#if state.activeId}
			{@const activeProvider = state.providers.find((p) => p.id === state.activeId)}
			{#if activeProvider && !activeProvider.supportsTools && hasToolScopes}
				<div class="warning-strip" role="alert">
					<span class="warning-text">
						This provider has limited tool support. Some desk actions may not work.
					</span>
				</div>
			{/if}
		{/if}

		<!-- Unconfigured providers -->
		{#if unconfiguredProviders.length > 0}
			<div class="scope-group">
				<div class="group-header">Not configured</div>

				{#each unconfiguredProviders as provider (provider.id)}
					<div class="provider-row disabled">
						<div class="radio-indicator"></div>
						<div class="provider-info">
							<span class="provider-name">{provider.name}</span>
							<span class="provider-model">Add {provider.id.toUpperCase()}_API_KEY to enable</span>
						</div>
					</div>
				{/each}
			</div>
		{/if}

		<!-- Reset to default -->
		{#if state.preference !== null}
			<button class="reset-link" type="button" onclick={handleReset}>
				<span class="i-lucide-rotate-ccw" style="font-size: 12px;"></span>
				Reset to server default
			</button>
		{/if}
	{/if}
</div>

<style>
	.provider-section {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 4px 0;
	}

	.loading-state,
	.error-state {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 24px 16px;
		font-size: 12px;
		color: var(--color-muted);
	}

	.error-state {
		color: var(--color-error-fg, #ef4444);
	}

	.scope-group {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.group-header {
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-muted);
		padding-bottom: 4px;
		border-bottom: 1px solid var(--color-border);
	}

	.provider-row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 8px;
		border: none;
		border-radius: var(--radius-md);
		background: transparent;
		cursor: pointer;
		text-align: left;
		width: 100%;
		transition: background-color 100ms ease;
	}

	.provider-row:hover:not(.disabled):not(:disabled) {
		background: color-mix(in srgb, var(--color-muted) 8%, transparent);
	}

	.provider-row.active {
		background: color-mix(in srgb, var(--color-primary) 6%, transparent);
	}

	.provider-row.disabled {
		opacity: 0.5;
		cursor: default;
	}

	.provider-row:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.radio-indicator {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		border: 2px solid var(--color-muted);
		flex-shrink: 0;
	}

	.radio-indicator.checked {
		border-color: var(--color-primary);
	}

	.radio-dot {
		display: block;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--color-primary);
	}

	.provider-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.provider-name {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
		font-weight: 500;
		color: var(--color-fg);
	}

	.provider-model {
		font-size: 12px;
		color: var(--color-muted);
	}

	.status-badge {
		font-size: 9px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 1px 4px;
		border-radius: var(--radius-sm);
	}

	.status-badge.active {
		background: color-mix(in srgb, var(--color-primary) 12%, transparent);
		color: var(--color-primary);
	}

	.status-badge.cooldown {
		background: color-mix(in srgb, var(--color-warning, #f59e0b) 12%, transparent);
		color: var(--color-warning, #f59e0b);
	}

	.warning-strip {
		padding: 8px 12px;
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--color-warning, #f59e0b) 8%, transparent);
		border: 1px solid color-mix(in srgb, var(--color-warning, #f59e0b) 20%, transparent);
	}

	.warning-text {
		font-size: 12px;
		color: var(--color-warning, #f59e0b);
	}

	.reset-link {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 4px 0;
		border: none;
		background: none;
		font-size: 12px;
		color: var(--color-muted);
		cursor: pointer;
	}

	.reset-link:hover {
		color: var(--color-fg);
	}
</style>
