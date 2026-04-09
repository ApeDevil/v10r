<script lang="ts">
import { Button } from '$lib/components/primitives';
import Dialog from '$lib/components/primitives/dialog/Dialog.svelte';
import Tabs from '$lib/components/primitives/tabs/Tabs.svelte';
import OklchColorInput from '$lib/components/ui/OklchColorInput.svelte';
import { DESK_PANEL_TYPES, DESK_PANELS } from '$lib/config/desk-panels';
import { cn } from '$lib/utils/cn';
import { getDeskSettings } from './desk-settings.svelte';

const settings = getDeskSettings();

let presetName = $state('');

function handleSavePreset() {
	const name = presetName.trim();
	if (!name) return;
	settings.saveAsPreset(name);
	presetName = '';
}

// Workspace color helpers — read from draft, fallback to empty string for OklchColorInput
function wsColor(key: 'shellBg' | 'panelBg' | 'shellBorder' | 'tabActiveIndicator'): string {
	return settings.draft?.workspace[key] ?? '';
}

function typeColor(panelType: string): string {
	return settings.draft?.typeStyles[panelType]?.bg ?? '';
}
</script>

<Dialog
	bind:open={settings.dialogOpen}
	title="Desk Preferences"
	class="max-w-2xl"
>
	{#snippet children()}
		<Tabs
			tabs={[
				{ value: 'workspace', label: 'Workspace', content: workspaceTab },
				{ value: 'panels', label: 'Panels', content: panelsTab },
				{ value: 'presets', label: 'Presets', content: presetsTab },
			]}
			bind:value={settings.dialogTab}
		/>

		<div class="dialog-footer">
			<Button variant="outline" onclick={() => settings.discardDraft()}>Cancel</Button>
			<Button onclick={() => settings.commitDraft()}>Apply</Button>
		</div>
	{/snippet}
</Dialog>

{#snippet workspaceTab()}
	<div class="settings-section">
		<OklchColorInput
			label="Shell"
			value={wsColor('shellBg')}
			onchange={(v) => settings.setWorkspaceColor('shellBg', v)}
		/>
		<OklchColorInput
			label="Panel Background"
			value={wsColor('panelBg')}
			onchange={(v) => settings.setWorkspaceColor('panelBg', v)}
		/>
		<OklchColorInput
			label="Border"
			value={wsColor('shellBorder')}
			onchange={(v) => settings.setWorkspaceColor('shellBorder', v)}
		/>
		<OklchColorInput
			label="Tab Indicator"
			value={wsColor('tabActiveIndicator')}
			onchange={(v) => settings.setWorkspaceColor('tabActiveIndicator', v)}
		/>
		<div class="reset-row">
			<Button variant="ghost" onclick={() => settings.resetToDefaults()}>
				Reset to defaults
			</Button>
		</div>
	</div>
{/snippet}

{#snippet panelsTab()}
	<div class="settings-section">
		{#each DESK_PANEL_TYPES as panelType}
			{@const panel = DESK_PANELS[panelType]}
			{@const hasOverride = !!settings.draft?.typeStyles[panelType]}
			<details class="panel-type-section">
				<summary class="panel-type-header">
					<span class={cn('panel-type-icon', panel.icon)}></span>
					<span class="panel-type-label">{panel.label}</span>
					{#if hasOverride}
						<span class="panel-type-badge">customized</span>
					{/if}
					<span class="panel-type-chevron" aria-hidden="true">
						<span class="i-lucide-chevron-down"></span>
					</span>
				</summary>
				<div class="panel-type-body">
					<OklchColorInput
						label="Background"
						value={typeColor(panelType)}
						onchange={(v) => settings.setTypeStyle(panelType, 'bg', v)}
					/>
					{#if hasOverride}
						<Button
							variant="ghost"
							class="clear-btn"
							onclick={() => settings.clearTypeStyle(panelType)}
						>
							Clear
						</Button>
					{/if}
				</div>
			</details>
		{/each}
	</div>
{/snippet}

{#snippet presetsTab()}
	<div class="settings-section">
		<div class="preset-save-row">
			<input
				class="preset-name-input"
				placeholder="Preset name…"
				bind:value={presetName}
				onkeydown={(e) => e.key === 'Enter' && handleSavePreset()}
			/>
			<Button onclick={handleSavePreset} disabled={!presetName.trim()}>
				Save current
			</Button>
		</div>

		<div class="preset-list">
			{#each settings.draft?.presets ?? [] as preset (preset.id)}
				{@const isActive = settings.draft?.activePresetId === preset.id}
				<div class="preset-row" class:active={isActive}>
					<span class="preset-name">
						{preset.name}
						{#if preset.builtIn}
							<span class="preset-built-in">built-in</span>
						{/if}
					</span>
					<div class="preset-actions">
						<Button
							variant="outline"
							class="preset-action-btn"
							onclick={() => settings.applyPreset(preset.id)}
						>
							{isActive ? 'Active' : 'Apply'}
						</Button>
						{#if !preset.builtIn}
							<Button
								variant="ghost"
								class="preset-action-btn preset-delete"
								onclick={() => settings.deletePreset(preset.id)}
							>
								Delete
							</Button>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</div>
{/snippet}

<style>
	.dialog-footer {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		padding-top: 1rem;
		margin-top: 1rem;
		border-top: 1px solid var(--color-border);
	}

	.settings-section {
		display: flex;
		flex-direction: column;
	}

	.reset-row {
		margin-top: 0.5rem;
	}

	/* ── Panel type sections ───────────────────────────────────── */

	.panel-type-section {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		overflow: hidden;
	}

	.panel-type-section + .panel-type-section {
		margin-top: 0.25rem;
	}

	.panel-type-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		cursor: pointer;
		list-style: none;
		background: var(--color-surface-1);
		user-select: none;
		font-size: var(--text-fluid-sm);
	}

	.panel-type-header::-webkit-details-marker {
		display: none;
	}

	.panel-type-icon {
		font-size: 16px;
		color: var(--color-muted);
		flex-shrink: 0;
	}

	.panel-type-label {
		font-weight: 500;
		color: var(--color-fg);
		flex: 1;
	}

	.panel-type-badge {
		font-size: var(--text-fluid-xs);
		color: var(--color-primary);
		font-weight: 500;
	}

	.panel-type-chevron {
		color: var(--color-muted);
		display: flex;
		align-items: center;
		transition: transform var(--duration-fast) ease;
	}

	details[open] .panel-type-chevron {
		transform: rotate(180deg);
	}

	.panel-type-body {
		display: flex;
		flex-direction: column;
		padding: 0.5rem;
		background: var(--color-bg);
		border-top: 1px solid var(--color-border);
	}

	.clear-btn {
		align-self: flex-start;
		margin-top: 0.25rem;
	}

	/* ── Presets ────────────────────────────────────────────────── */

	.preset-save-row {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.preset-name-input {
		flex: 1;
		padding: 0.375rem 0.75rem;
		border-radius: var(--radius-md);
		border: 1px solid var(--color-input-border);
		background: var(--color-input);
		color: var(--color-fg);
		font-size: var(--text-fluid-sm);
	}

	.preset-name-input:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.preset-list {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin-top: 0.75rem;
	}

	.preset-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
	}

	.preset-row.active {
		border-color: var(--color-primary);
	}

	.preset-name {
		flex: 1;
		font-size: var(--text-fluid-sm);
		font-weight: 500;
		color: var(--color-fg);
	}

	.preset-built-in {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		font-weight: 400;
		margin-left: 0.5rem;
	}

	.preset-actions {
		display: flex;
		gap: 0.25rem;
		flex-shrink: 0;
	}

	:global(.preset-action-btn) {
		font-size: var(--text-fluid-xs) !important;
		padding: 0.25rem 0.75rem !important;
		height: auto !important;
	}

	:global(.preset-delete) {
		color: var(--color-error-fg) !important;
	}

	/* ── Reduce dialog backdrop opacity for live preview ────── */

	:global([data-dialog-overlay]) {
		background: rgba(0, 0, 0, 0.3) !important;
	}
</style>
