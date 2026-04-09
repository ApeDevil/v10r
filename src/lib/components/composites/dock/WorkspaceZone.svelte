<script lang="ts">
import { ContextMenu as CtxMenu, Popover, Tooltip } from 'bits-ui';
import {
	contextMenuContentVariants,
	contextMenuItemVariants,
	contextMenuSeparatorVariants,
} from '$lib/components/composites/context-menu';
import { cn } from '$lib/utils/cn';
import { getDeskSettings } from './desk-settings.svelte';
import { collectLeaves } from './dock.operations';
import { getDockContext } from './dock.state.svelte';
import { getWorkspaceContext } from './workspace.state.svelte';
import type { Workspace } from './workspace.types';
import { MAX_WORKSPACES, VISIBLE_WORKSPACE_BUTTONS } from './workspace.types';

const workspace = getWorkspaceContext();
const deskSettings = getDeskSettings();
const dock = getDockContext();

const isHorizontal = $derived(dock.activityBarPosition === 'top' || dock.activityBarPosition === 'bottom');

/** Popover opens away from the bar edge */
const popoverSide = $derived<'top' | 'bottom' | 'left' | 'right'>(
	dock.activityBarPosition === 'top'
		? 'bottom'
		: dock.activityBarPosition === 'bottom'
			? 'top'
			: dock.activityBarPosition === 'right'
				? 'left'
				: 'right',
);

// Display mode
const mode = $derived(deskSettings.theme.workspaceSwitcherMode ?? 'auto');
const useNumbers = $derived(
	mode === 'numbers' || (mode === 'auto' && workspace.workspaces.length <= VISIBLE_WORKSPACE_BUTTONS),
);

// Create workspace popover
let createOpen = $state(false);
let newName = $state('');

// Rename popover
let renamingId = $state<string | null>(null);
let renameValue = $state('');

// Undo state
let pendingDelete = $state<{ workspace: Workspace; timer: ReturnType<typeof setTimeout> } | null>(null);

function handleCreate() {
	const name = newName.trim() || `Workspace ${workspace.workspaces.length + 1}`;
	workspace.createWorkspace(name);
	newName = '';
	createOpen = false;
}

function handleRename(id: string) {
	const name = renameValue.trim();
	if (name) workspace.renameWorkspace(id, name);
	renamingId = null;
	renameValue = '';
}

function handleDelete(id: string) {
	const deleted = workspace.deleteWorkspace(id);
	if (!deleted) return;

	// Start undo timer
	const timer = setTimeout(() => {
		workspace.confirmDelete(id);
		pendingDelete = null;
	}, 5000);
	pendingDelete = { workspace: deleted, timer };
}

function handleUndo() {
	if (!pendingDelete) return;
	clearTimeout(pendingDelete.timer);
	workspace.restoreWorkspace(pendingDelete.workspace);
	pendingDelete = null;
}

function startRename(ws: Workspace) {
	renamingId = ws.id;
	renameValue = ws.name;
}

/** Get panel type summary for tooltip */
function getPanelSummary(ws: Workspace): string {
	const types = Object.values(ws.layout.panels)
		.map((p) => p.type)
		.filter((v, i, a) => a.indexOf(v) === i);
	return types.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(' \u00b7 ');
}
</script>

{#if workspace.workspaces.length > 0 || pendingDelete}
	<div class={cn('dock-workspace-divider', isHorizontal && 'horizontal')}></div>
{/if}

{#if workspace.workspaces.length > 0}
	<!-- Stop contextmenu from bubbling to the activity bar's ContextMenu.Trigger -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class={cn('dock-workspace-zone', isHorizontal && 'horizontal')} role="tablist" aria-label="Workspaces" oncontextmenu={(e) => e.stopPropagation()}>
		{#each workspace.workspaces as ws, i (ws.id)}
			{#if useNumbers || i < VISIBLE_WORKSPACE_BUTTONS}
				<CtxMenu.Root>
					<CtxMenu.Trigger>
						{#snippet child({ props: ctxProps })}
							<button
								{...ctxProps}
								role="tab"
								aria-selected={ws.id === workspace.activeId}
								aria-label="Workspace {i + 1}: {ws.name}"
								title={ws.name}
								class={cn('dock-activity-btn dock-ws-btn', ws.id === workspace.activeId && 'active')}
								onclick={() => workspace.switchTo(ws.id)}
							>
								<span class="dock-ws-num">{i + 1}</span>
								{#if workspace.isModified && ws.id === workspace.activeId}
									<span class="dock-ws-modified" aria-hidden="true"></span>
								{/if}
							</button>
						{/snippet}
					</CtxMenu.Trigger>

					<CtxMenu.Portal>
						<CtxMenu.Content class={contextMenuContentVariants()}>
							<CtxMenu.Group>
								<CtxMenu.GroupHeading class="px-2 py-1.5 text-xs font-medium text-muted">
									{ws.name}
								</CtxMenu.GroupHeading>
								<CtxMenu.Item
									class={contextMenuItemVariants()}
									onSelect={() => startRename(ws)}
								>
									<span class="i-lucide-pencil h-4 w-4"></span>
									Rename
								</CtxMenu.Item>
								<CtxMenu.Item
									class={contextMenuItemVariants()}
									onSelect={() => workspace.duplicateWorkspace(ws.id)}
									disabled={workspace.workspaces.length >= MAX_WORKSPACES}
								>
									<span class="i-lucide-copy h-4 w-4"></span>
									Duplicate
								</CtxMenu.Item>
								<CtxMenu.Separator class={contextMenuSeparatorVariants()} />
								{#if i > 0}
									<CtxMenu.Item
										class={contextMenuItemVariants()}
										onSelect={() => workspace.reorderWorkspace(ws.id, i - 1)}
									>
										<span class="i-lucide-arrow-up h-4 w-4"></span>
										Move Up
									</CtxMenu.Item>
								{/if}
								{#if i < workspace.workspaces.length - 1}
									<CtxMenu.Item
										class={contextMenuItemVariants()}
										onSelect={() => workspace.reorderWorkspace(ws.id, i + 1)}
									>
										<span class="i-lucide-arrow-down h-4 w-4"></span>
										Move Down
									</CtxMenu.Item>
								{/if}
								{#if i > 0 || i < workspace.workspaces.length - 1}
									<CtxMenu.Separator class={contextMenuSeparatorVariants()} />
								{/if}
								<CtxMenu.Item
									class={cn(contextMenuItemVariants(), 'text-error-fg')}
									onSelect={() => handleDelete(ws.id)}
									disabled={workspace.workspaces.length <= 1}
								>
									<span class="i-lucide-trash-2 h-4 w-4"></span>
									Delete
								</CtxMenu.Item>
							</CtxMenu.Group>
						</CtxMenu.Content>
					</CtxMenu.Portal>
				</CtxMenu.Root>
			{/if}
		{/each}

		<!-- Overflow for 6+ workspaces in numbers mode -->
		{#if !useNumbers && workspace.workspaces.length > VISIBLE_WORKSPACE_BUTTONS}
			<Popover.Root>
				<Popover.Trigger>
					{#snippet child({ props })}
						<button
							{...props}
							class="dock-activity-btn dock-ws-overflow"
							title="More workspaces"
						>
							<span class="dock-ws-num">+{workspace.workspaces.length - VISIBLE_WORKSPACE_BUTTONS}</span>
						</button>
					{/snippet}
				</Popover.Trigger>
				<Popover.Content class="dock-ws-popover" side={popoverSide} sideOffset={8}>
					{#each workspace.workspaces.slice(VISIBLE_WORKSPACE_BUTTONS) as ws, i (ws.id)}
						<button
							class={cn('dock-ws-popover-item', ws.id === workspace.activeId && 'active')}
							onclick={() => workspace.switchTo(ws.id)}
						>
							<span class="dock-ws-popover-num">{VISIBLE_WORKSPACE_BUTTONS + i + 1}</span>
							{ws.name}
						</button>
					{/each}
				</Popover.Content>
			</Popover.Root>
		{/if}
	</div>
{/if}

<!-- Undo strip -->
{#if pendingDelete}
	<div class="dock-ws-undo">
		<button class="dock-ws-undo-btn" onclick={handleUndo}>Undo</button>
	</div>
{/if}

<!-- Rename popover (renders when renaming) -->
{#if renamingId}
	{@const renameWs = workspace.workspaces.find((w) => w.id === renamingId)}
	{#if renameWs}
		<div class="dock-ws-rename-overlay" role="dialog" aria-label="Rename workspace">
			<form
				class="dock-ws-rename-form"
				onsubmit={(e) => { e.preventDefault(); handleRename(renamingId!); }}
			>
				<input
					type="text"
					bind:value={renameValue}
					placeholder="Workspace name"
					class="dock-ws-rename-input"
					autofocus
					onkeydown={(e) => { if (e.key === 'Escape') { renamingId = null; } }}
				/>
				<button type="submit" class="dock-ws-rename-submit" disabled={!renameValue.trim()}>
					<span class="i-lucide-check h-3.5 w-3.5"></span>
				</button>
			</form>
		</div>
	{/if}
{/if}

<!-- Create button -->
{#if workspace.workspaces.length < MAX_WORKSPACES}
	<Popover.Root bind:open={createOpen}>
		<Popover.Trigger>
			{#snippet child({ props })}
				<button
					{...props}
					class="dock-activity-btn dock-ws-create"
					title={workspace.workspaces.length === 0
						? 'Save Layout as Workspace'
						: 'New workspace'}
				>
					<span class="i-lucide-plus dock-activity-icon" style="font-size: 16px;"></span>
				</button>
			{/snippet}
		</Popover.Trigger>
		<Popover.Content class="dock-ws-popover" side={popoverSide} sideOffset={8}>
			<form
				class="dock-ws-create-form"
				onsubmit={(e) => { e.preventDefault(); handleCreate(); }}
			>
				<input
					type="text"
					bind:value={newName}
					placeholder={`Workspace ${workspace.workspaces.length + 1}`}
					class="dock-ws-create-input"
					autofocus
				/>
				<button type="submit" class="dock-ws-create-submit">
					Create
				</button>
			</form>
		</Popover.Content>
	</Popover.Root>
{:else}
	<button
		class="dock-activity-btn dock-ws-create"
		title="Workspace limit reached (9 max)"
		disabled
	>
		<span class="i-lucide-plus dock-activity-icon" style="font-size: 16px; opacity: 0.3;"></span>
	</button>
{/if}

<style>
	.dock-workspace-divider {
		width: 24px;
		height: 1px;
		background: var(--color-border);
		margin: 2px 0;
		flex-shrink: 0;
	}

	.dock-workspace-divider.horizontal {
		width: 1px;
		height: 24px;
		margin: 0 2px;
	}

	.dock-workspace-zone {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
	}

	.dock-workspace-zone.horizontal {
		flex-direction: row;
	}

	/* Workspace number button */
	.dock-ws-btn {
		font-size: 12px;
		font-weight: 500;
		font-variant-numeric: tabular-nums;
	}

	.dock-ws-num {
		font-size: 12px;
		font-weight: 600;
		line-height: 1;
	}

	/* Modified indicator dot */
	.dock-ws-modified {
		position: absolute;
		top: 3px;
		right: 3px;
		width: 5px;
		height: 5px;
		border-radius: var(--radius-full);
		background: var(--color-warning, #f59e0b);
	}

	/* Overflow button */
	.dock-ws-overflow {
		font-size: 11px;
	}

	/* Popover shared styles */
	.dock-ws-popover {
		min-width: 160px;
		overflow: hidden;
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
		background: var(--surface-2, var(--color-bg));
		box-shadow: var(--shadow-lg, 0 10px 15px -3px rgb(0 0 0 / 0.1));
		padding: 4px;
		z-index: 50;
	}

	.dock-ws-popover-item {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 6px 8px;
		font-size: 13px;
		color: var(--color-fg);
		border-radius: calc(var(--radius-md) - 2px);
		cursor: pointer;
	}

	.dock-ws-popover-item:hover {
		background: color-mix(in srgb, var(--color-muted) 10%, transparent);
	}

	.dock-ws-popover-item.active {
		color: var(--color-primary);
		font-weight: 500;
	}

	.dock-ws-popover-num {
		font-size: 11px;
		font-weight: 600;
		color: var(--color-muted);
		min-width: 16px;
	}

	/* Create form */
	.dock-ws-create-form {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 4px;
	}

	.dock-ws-create-input {
		width: 100%;
		padding: 6px 8px;
		font-size: 13px;
		border: 1px solid var(--color-border);
		border-radius: calc(var(--radius-md) - 2px);
		background: var(--color-bg);
		color: var(--color-fg);
		outline: none;
	}

	.dock-ws-create-input:focus {
		border-color: var(--color-primary);
	}

	.dock-ws-create-submit {
		padding: 5px 10px;
		font-size: 12px;
		font-weight: 500;
		color: var(--color-primary-fg, #fff);
		background: var(--color-primary);
		border-radius: calc(var(--radius-md) - 2px);
		cursor: pointer;
	}

	.dock-ws-create-submit:hover {
		opacity: 0.9;
	}

	/* Undo strip */
	.dock-ws-undo {
		display: flex;
		justify-content: center;
		padding: 2px;
	}

	.dock-ws-undo-btn {
		font-size: 11px;
		font-weight: 500;
		color: var(--color-primary);
		padding: 2px 8px;
		border-radius: var(--radius-md);
		cursor: pointer;
	}

	.dock-ws-undo-btn:hover {
		background: color-mix(in srgb, var(--color-primary) 10%, transparent);
	}

	/* Rename overlay */
	.dock-ws-rename-overlay {
		position: absolute;
		left: 44px;
		top: 50%;
		transform: translateY(-50%);
		z-index: 50;
	}

	.dock-ws-rename-form {
		display: flex;
		gap: 4px;
		padding: 4px;
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
		background: var(--surface-2, var(--color-bg));
		box-shadow: var(--shadow-lg, 0 10px 15px -3px rgb(0 0 0 / 0.1));
	}

	.dock-ws-rename-input {
		width: 120px;
		padding: 4px 6px;
		font-size: 12px;
		border: 1px solid var(--color-border);
		border-radius: calc(var(--radius-md) - 2px);
		background: var(--color-bg);
		color: var(--color-fg);
		outline: none;
	}

	.dock-ws-rename-input:focus {
		border-color: var(--color-primary);
	}

	.dock-ws-rename-submit {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 4px;
		border-radius: calc(var(--radius-md) - 2px);
		color: var(--color-primary);
		cursor: pointer;
	}

	.dock-ws-rename-submit:hover {
		background: color-mix(in srgb, var(--color-primary) 10%, transparent);
	}

	.dock-ws-rename-submit:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	/*
	 * Shared button base — mirrors .dock-activity-btn from DockActivityBar.
	 * Needed because Svelte scoped CSS in the parent doesn't reach into child components.
	 */
	.dock-ws-btn,
	.dock-ws-create,
	.dock-ws-overflow {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: var(--radius-md);
		color: var(--color-muted);
		position: relative;
		cursor: pointer;
		flex-shrink: 0;
	}

	.dock-ws-btn:hover,
	.dock-ws-create:hover,
	.dock-ws-overflow:hover {
		color: var(--color-fg);
		background: color-mix(in srgb, var(--color-fg) 8%, transparent);
	}

	.dock-ws-btn.active {
		color: var(--color-fg);
	}
</style>
