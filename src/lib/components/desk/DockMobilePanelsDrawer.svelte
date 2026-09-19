<script lang="ts">
/**
 * Mobile Activity bar — a modal LEFT drawer listing panel types (same items,
 * same order as the desktop bar), with open instances as indented child rows,
 * then the workspaces (the desktop bar's numbered zone) — switching swaps the
 * persisted desktop tree, which mobile only ever projects, so it is the one
 * workspace verb touch gets; rename/duplicate/delete stay a desktop right-click.
 *
 * Tap = show + dismiss, always — never the desktop bar's close-all-of-type
 * toggle (structural, data-destroying). Closing is explicit per instance and
 * routes through the dock's unsaved-close guard.
 */
import { trackCommand } from '$lib/analytics/telemetry';
import { Drawer } from '$lib/components/primitives';
import type { ActivityBarItem } from '$lib/desk/layout.types';
import * as m from '$lib/paraglide/messages';
import { getModals } from '$lib/state/modals.svelte';
import { cn } from '$lib/utils/cn';
import { getDeskSettings } from './desk-settings.state.svelte';
import { getDockContext } from './dock.state.svelte';
import { getDockMobile } from './dock-mobile.state.svelte';
import { focusPanel, openOrCycle } from './panel-actions';
import { getWorkspaceContext } from './workspace.state.svelte';
import { MAX_WORKSPACES } from './workspace.types';

interface Props {
	items: ActivityBarItem[];
	openPanelIds: string[];
	visibleId: string | null;
}

let { items, openPanelIds, visibleId }: Props = $props();

const dock = getDockContext();
const mobile = getDockMobile();
const deskSettings = getDeskSettings();
const modals = getModals();
const workspace = getWorkspaceContext();

const instancesByType = $derived(
	openPanelIds.reduce<Record<string, string[]>>((acc, id) => {
		const type = dock.panels[id]?.type;
		if (type) {
			acc[type] ??= [];
			acc[type].push(id);
		}
		return acc;
	}, {}),
);

// The drawer is the mobile projection of the activity bar and of View's toggle
// rows; recorded under the same names so one command aggregates across doors.
function selectType(item: ActivityBarItem) {
	trackCommand('bar', `View › Toggle ${item.label}`);
	openOrCycle(dock, items, item.panelType);
	mobile.close();
}

function selectInstance(panelId: string) {
	focusPanel(dock, panelId);
	mobile.close();
}

function selectWorkspace(id: string) {
	workspace.switchTo(id);
	mobile.close();
}

// The desktop popover asks for a name; on touch the default name is enough —
// renaming is a desktop right-click away and the layout is what matters here.
function createWorkspace() {
	void workspace.createWorkspace(`Workspace ${workspace.workspaces.length + 1}`);
	mobile.close();
}
</script>

<Drawer
	bind:open={mobile.panelsOpen}
	side="left"
	layerId="desk-panels"
	title={m.composites_dock_mobile_panels_title()}
	class="!w-[min(85vw,320px)] !max-w-none"
>
	<div class="panels-drawer">
		<ul class="panel-list">
			{#each items as item (item.panelType)}
				{@const instances = instancesByType[item.panelType] ?? []}
				{@const isOpen = instances.length > 0}
				<li>
					<button
						type="button"
						class={cn('type-row', !isOpen && 'closed')}
						aria-label={isOpen ? `${item.label} (${instances.length})` : `${item.label} — ${m.composites_dock_mobile_open_new()}`}
						onclick={() => selectType(item)}
					>
						<span class={cn(item.icon, 'row-icon')} aria-hidden="true"></span>
						<span class="row-label">{item.label}</span>
						{#if instances.length > 1}
							<span class="row-count" aria-hidden="true">{instances.length}</span>
						{:else if !isOpen}
							<span class="i-lucide-plus row-open-hint" aria-hidden="true"></span>
						{/if}
					</button>
					{#if instances.length > 1}
						<ul class="instance-list">
							{#each instances as id (id)}
								{@const panel = dock.panels[id]}
								{#if panel}
									<li class="instance-row" class:active={id === visibleId}>
										<button
											type="button"
											class="instance-select"
											aria-current={id === visibleId ? 'true' : undefined}
											onclick={() => selectInstance(id)}
										>
											<span class="row-label">{panel.label}</span>
											{#if panel.indicator}
												<span class={cn('instance-dot', `dot-${panel.indicator}`)} aria-hidden="true"></span>
											{/if}
										</button>
										{#if panel.closable !== false}
											<button
												type="button"
												class="instance-close"
												aria-label={m.composites_dock_mobile_close_instance({ label: panel.label })}
												onclick={() => dock.requestClose(id)}
											>
												<span class="i-lucide-x" aria-hidden="true"></span>
											</button>
										{/if}
									</li>
								{/if}
							{/each}
						</ul>
					{/if}
				</li>
			{/each}
		</ul>

		<section class="workspace-section" aria-labelledby="mobile-workspaces-heading">
			<h3 id="mobile-workspaces-heading" class="section-heading">{m.composites_dock_mobile_workspaces()}</h3>
			<ul class="panel-list">
				{#each workspace.workspaces as ws, i (ws.id)}
					{@const isActive = ws.id === workspace.activeId}
					<li>
						<button
							type="button"
							class="type-row workspace-row"
							class:active={isActive}
							aria-current={isActive ? 'true' : undefined}
							onclick={() => selectWorkspace(ws.id)}
						>
							<span class="workspace-num" aria-hidden="true">{i + 1}</span>
							<span class="row-label">{ws.name}</span>
							{#if isActive}
								<span class="i-lucide-check row-open-hint" aria-hidden="true"></span>
							{/if}
						</button>
					</li>
				{/each}
				{#if workspace.workspaces.length < MAX_WORKSPACES}
					<li>
						<button type="button" class="type-row closed" onclick={createWorkspace}>
							<span class="i-lucide-plus row-icon" aria-hidden="true"></span>
							<span class="row-label">
								{workspace.workspaces.length === 0
									? m.composites_dock_mobile_workspace_save_layout()
									: m.composites_dock_mobile_workspace_new()}
							</span>
						</button>
					</li>
				{/if}
			</ul>
		</section>

		<div class="drawer-footer">
			<button
				type="button"
				class="footer-row"
				onclick={() => {
					mobile.close();
					modals.open('quickSearch');
				}}
			>
				<span class="i-lucide-search row-icon" aria-hidden="true"></span>
				<span class="row-label">{m.composites_dock_mobile_search()}</span>
			</button>
			<button
				type="button"
				class="footer-row"
				onclick={() => {
					trackCommand('bar', 'View › Desk Preferences…');
					mobile.close();
					deskSettings.openDialog();
				}}
			>
				<span class="i-lucide-settings-2 row-icon" aria-hidden="true"></span>
				<span class="row-label">{m.composites_dock_mobile_preferences()}</span>
			</button>
		</div>
	</div>
</Drawer>

<style>
	.panels-drawer {
		display: flex;
		flex-direction: column;
		min-height: 100%;
	}

	.panel-list,
	.instance-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.type-row,
	.footer-row {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		width: 100%;
		min-height: 56px;
		padding: 0 var(--spacing-2);
		border: none;
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--color-fg);
		font-size: var(--text-fluid-base);
		text-align: left;
		cursor: pointer;
	}

	.type-row:active,
	.footer-row:active {
		background: var(--color-fg-alpha);
	}

	.type-row:focus-visible,
	.footer-row:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: -2px;
	}

	.type-row.closed {
		color: var(--color-muted);
	}

	.row-icon {
		width: 24px;
		height: 24px;
		flex-shrink: 0;
	}

	.row-label {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.row-count {
		margin-left: auto;
		min-width: 20px;
		height: 20px;
		padding: 0 6px;
		border-radius: 10px;
		background: var(--color-primary);
		color: var(--color-on-primary);
		font-size: 11px;
		font-weight: 700;
		line-height: 20px;
		text-align: center;
	}

	.row-open-hint {
		margin-left: auto;
		width: 16px;
		height: 16px;
		opacity: 0.6;
	}

	.instance-row {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		padding-left: var(--spacing-6);
	}

	.instance-select {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		flex: 1;
		min-width: 0;
		min-height: 48px;
		padding: 0 var(--spacing-2);
		border: none;
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--color-fg);
		font-size: var(--text-fluid-sm);
		text-align: left;
		cursor: pointer;
	}

	.instance-row.active .instance-select {
		color: var(--color-primary);
		font-weight: 600;
	}

	.instance-select:focus-visible,
	.instance-close:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: -2px;
	}

	/* 44px close target with its own hit box, ≥8px from the select row. */
	.instance-close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		margin-left: var(--spacing-2);
		border: none;
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--color-muted);
		cursor: pointer;
	}

	.instance-close:active {
		background: var(--color-fg-alpha);
		color: var(--color-error);
	}

	.instance-dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.instance-dot.dot-unsaved,
	.instance-dot.dot-ai-modified {
		background: var(--color-warning);
	}

	.instance-dot.dot-saving {
		background: var(--color-muted);
	}

	.instance-dot.dot-error,
	.instance-dot.dot-ai-error {
		background: var(--color-error);
	}

	.instance-dot.dot-ai-active {
		background: var(--color-primary);
	}

	.workspace-section {
		margin-top: var(--spacing-3);
		padding-top: var(--spacing-2);
		border-top: 1px solid var(--color-border);
	}

	.section-heading {
		margin: 0;
		padding: var(--spacing-1) var(--spacing-2);
		font-size: var(--text-fluid-xs);
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--color-muted);
	}

	.workspace-row.active {
		color: var(--color-primary);
		font-weight: 600;
	}

	/* Same numbered-square idiom as the desktop bar, at row-icon size. */
	.workspace-num {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		flex-shrink: 0;
		border-radius: var(--radius-sm);
		border: 1px solid var(--color-border);
		font-size: var(--text-fluid-xs);
		font-weight: 600;
	}

	.workspace-row.active .workspace-num {
		border-color: var(--color-primary);
	}

	.drawer-footer {
		margin-top: auto;
		padding-top: var(--spacing-2);
		border-top: 1px solid var(--color-border);
	}
</style>
