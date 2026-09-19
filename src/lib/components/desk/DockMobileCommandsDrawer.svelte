<script lang="ts">
/**
 * Active panel's commands as a bottom sheet — flat titled sections, zero
 * nesting (desktop's hover Sub-menus are touch-hostile). Renders the SAME
 * composed array as the desktop kebab (composePanelMenus): registered menus +
 * the dock's floor menu (close, switch, about). No View section: its commands
 * are dock-level and the panels drawer projects them on touch — a row per
 * panel type (show-or-open, never the desktop's close-all-of-type toggle) and
 * a Preferences row — so the sheet stays "this panel's commands".
 *
 * Row rules: plain rows dismiss (action deferred a microtask so a follow-up
 * surface never fights this sheet's focus-trap teardown); checkbox rows stay
 * open (toggles are done in runs); disabled rows are dimmed, never hidden;
 * shortcut hints are keyboard talk and don't render here.
 */
import { trackCommand } from '$lib/analytics/telemetry';
import { InfoDialog } from '$lib/components/composites/info-dialog';
import type { MenuBarItem, MenuBarMenu } from '$lib/components/composites/menu-bar/types';
import { Drawer } from '$lib/components/primitives';
import { DESK_PANEL_HELP } from '$lib/desk/help';
import type { DeskPanelType } from '$lib/desk/panels';
import * as m from '$lib/paraglide/messages';
import { cn } from '$lib/utils/cn';
import { collectTypeInstances, composePanelMenus, shortcutTableMarkdown } from './compose-menus';
import { getDockContext } from './dock.state.svelte';
import { getDockMobile } from './dock-mobile.state.svelte';
import { focusPanel } from './panel-actions';
import { getPanelMenus } from './panel-menus.state.svelte';

interface Props {
	openPanelIds: string[];
	visibleId: string | null;
}

let { openPanelIds, visibleId }: Props = $props();

const dock = getDockContext();
const mobile = getDockMobile();
const panelMenus = getPanelMenus();

const panel = $derived(visibleId ? (dock.panels[visibleId] ?? null) : null);
const panelHelp = $derived(panel ? (DESK_PANEL_HELP[panel.type as DeskPanelType] ?? null) : null);
let helpOpen = $state(false);

const menus = $derived<MenuBarMenu[]>(
	visibleId
		? composePanelMenus({
				registered: panelMenus.getMenus(visibleId).menuBar,
				panel,
				instances: collectTypeInstances(openPanelIds, dock.panels, panel?.type),
				viewMenu: null,
				actions: {
					focusPanel: (panelId) => focusPanel(dock, panelId),
					closePanel: (panelId) => dock.requestClose(panelId),
					closePanels: (panelIds) =>
						dock.requestClosePanels(panelIds, () => {
							for (const id of panelIds) dock.closePanel(id);
						}),
				},
				help: panelHelp
					? {
							title: panelHelp.title,
							open: () => {
								helpOpen = true;
							},
						}
					: null,
			})
		: [],
);

function runItem(menu: MenuBarMenu, item: MenuBarItem) {
	if (item.disabled || !item.onSelect) return;
	trackCommand('sheet', `${menu.label} › ${item.label}`);
	if (item.type === 'checkbox') {
		item.onSelect();
		return;
	}
	// Close first, act a microtask later: this sheet's focus-trap teardown must
	// finish before a follow-up surface (preferences, help, confirm) grabs focus.
	mobile.close();
	const select = item.onSelect;
	queueMicrotask(() => select());
}
</script>

<Drawer
	bind:open={mobile.commandsOpen}
	side="bottom"
	layerId="desk-commands"
	title={panel?.label ?? m.composites_dock_mobile_commands_title()}
	class="!max-h-[70svh]"
>
	<div class="commands-sheet">
		{#each menus as menu (menu.label)}
			<section class="menu-section">
				<h3 class="section-heading">{menu.label}</h3>
				{#each menu.items as item, i (i)}
					{#if item.type === 'separator'}
						<hr class="section-separator" />
					{:else}
						<button
							type="button"
							class={cn('command-row', item.destructive && 'destructive')}
							disabled={item.disabled}
							aria-disabled={item.disabled || undefined}
							aria-pressed={item.type === 'checkbox' ? (item.checked ?? false) : undefined}
							onclick={() => runItem(menu, item)}
						>
							{#if item.icon}<span class={cn(item.icon, 'command-icon')} aria-hidden="true"></span>{/if}
							<span class="command-label">{item.label}</span>
							{#if item.type === 'checkbox'}
								<span
									class={cn('i-lucide-check command-check', !item.checked && 'invisible')}
									aria-hidden="true"
								></span>
							{/if}
						</button>
					{/if}
				{/each}
			</section>
		{/each}
	</div>
</Drawer>

{#if panelHelp}
	<InfoDialog
		bind:open={helpOpen}
		noTrigger
		title={panelHelp.title}
		description={panelHelp.description}
		icon={panelHelp.icon}
		ariaLabel={panelHelp.title}
		doc={{ name: panelHelp.title, notes: `${panelHelp.notes}\n\n${shortcutTableMarkdown(menus)}` }}
	/>
{/if}

<style>
	.commands-sheet {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
	}

	.menu-section {
		display: flex;
		flex-direction: column;
	}

	.section-heading {
		margin: 0 0 var(--spacing-1);
		padding: 0 var(--spacing-2);
		font-size: var(--text-fluid-xs);
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--color-muted);
	}

	.section-separator {
		border: none;
		border-top: 1px solid var(--color-border);
		margin: var(--spacing-1) 0;
	}

	.command-row {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		min-height: 48px;
		padding: 0 var(--spacing-2);
		border: none;
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--color-fg);
		font-size: var(--text-fluid-base);
		text-align: left;
		cursor: pointer;
	}

	.command-row:active:not(:disabled) {
		background: var(--color-fg-alpha);
	}

	.command-row:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: -2px;
	}

	.command-row:disabled {
		opacity: 0.45;
		cursor: default;
	}

	.command-row.destructive {
		color: var(--color-error);
	}

	.command-icon {
		width: 20px;
		height: 20px;
		flex-shrink: 0;
	}

	.command-label {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.command-check {
		width: 18px;
		height: 18px;
		color: var(--color-primary);
	}
</style>
