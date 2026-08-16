<script lang="ts">
/**
 * Mobile Activity bar — a modal LEFT drawer listing panel types (same items,
 * same order as the desktop bar), with open instances as indented child rows.
 *
 * Tap = show + dismiss, always — never the desktop bar's close-all-of-type
 * toggle (structural, data-destroying). Closing is explicit per instance and
 * routes through requestClose (unsaved-work confirm).
 */
import { Drawer } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';
import { getModals } from '$lib/state/modals.svelte';
import { cn } from '$lib/utils/cn';
import { getDeskSettings } from './desk-settings.svelte';
import { getDockContext } from './dock.state.svelte';
import type { ActivityBarItem } from './dock.types';
import { getDockMobile } from './dock-mobile.state.svelte';
import { focusPanel, openOrCycle } from './panel-actions';

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

function selectType(panelType: string) {
	openOrCycle(dock, items, panelType);
	mobile.close();
}

function selectInstance(panelId: string) {
	focusPanel(dock, panelId);
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
						onclick={() => selectType(item.panelType)}
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
												onclick={() => mobile.requestClose(id)}
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

	.drawer-footer {
		margin-top: auto;
		padding-top: var(--spacing-2);
		border-top: 1px solid var(--color-border);
	}
</style>
