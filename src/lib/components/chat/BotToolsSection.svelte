<script lang="ts">
import {
	cancelDelete,
	confirmDelete,
	disableScope,
	enableScope,
	isDeletePending,
	isScopeEnabled,
} from '$lib/components/composites/dock';
import Button from '$lib/components/primitives/button/Button.svelte';
import Switch from '$lib/components/primitives/switch/Switch.svelte';

const SCOPE_INFO = [
	{
		group: 'Read access',
		scopes: [
			{
				scope: 'desk:read' as const,
				label: 'Browse & search',
				description: 'List files, read contents, search workspace',
				alwaysOn: true,
			},
		],
	},
	{
		group: 'Write access',
		scopes: [
			{
				scope: 'desk:write' as const,
				label: 'Edit files',
				description: 'Update spreadsheet cells, rename files',
			},
			{
				scope: 'desk:create' as const,
				label: 'Create files',
				description: 'Create new spreadsheets and documents',
			},
		],
	},
	{
		group: 'Destructive',
		scopes: [
			{
				scope: 'desk:delete' as const,
				label: 'Delete files',
				description: 'Delete files permanently',
				destructive: true,
			},
		],
	},
] as const;

const deletePending = $derived(isDeletePending());
</script>

<div class="tools-section">
	{#each SCOPE_INFO as group}
		<div class="scope-group">
			<div class="group-header">{group.group}</div>

			{#each group.scopes as info}
				{@const enabled = isScopeEnabled(info.scope)}
				<div class="scope-row">
					<div class="scope-info">
						<span class="scope-label">
							{info.label}
							{#if 'destructive' in info && info.destructive}
								<span
									class="i-lucide-triangle-alert warning-icon"
									role="img"
									aria-label="Destructive action"
								></span>
							{/if}
						</span>
						<span class="scope-desc">{info.description}</span>
					</div>
					<Switch
						size="sm"
						checked={enabled}
						disabled={'alwaysOn' in info && info.alwaysOn}
						onCheckedChange={(checked) => {
							if (checked) {
								enableScope(info.scope);
							} else {
								disableScope(info.scope);
							}
						}}
					/>
				</div>

				{#if 'destructive' in info && info.destructive && deletePending}
					<div class="confirm-strip" role="alert">
						<span class="confirm-text">AI will be able to delete files. This is irreversible.</span>
						<div class="confirm-actions">
							<Button variant="ghost" size="sm" onclick={confirmDelete}>
								{#snippet children()}Keep enabled{/snippet}
							</Button>
							<Button variant="primary" size="sm" onclick={cancelDelete}>
								{#snippet children()}Turn off{/snippet}
							</Button>
						</div>
					</div>
				{/if}
			{/each}
		</div>
	{/each}
</div>

<style>
	.tools-section {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 4px 0;
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

	.scope-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 8px 0;
	}

	.scope-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.scope-label {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 13px;
		font-weight: 500;
		color: var(--color-fg);
	}

	.warning-icon {
		font-size: 14px;
		color: var(--color-warning, #f59e0b);
	}

	.scope-desc {
		font-size: 12px;
		color: var(--color-muted);
	}

	.confirm-strip {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 8px 12px;
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--color-warning, #f59e0b) 8%, transparent);
		border: 1px solid color-mix(in srgb, var(--color-warning, #f59e0b) 20%, transparent);
	}

	.confirm-text {
		font-size: 12px;
		color: var(--color-warning, #f59e0b);
	}

	.confirm-actions {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
	}
</style>
