<script lang="ts">
import { Button } from '$lib/components';
import { Command, CommandPalette } from '$lib/components/composites';
import type { CommandGroup } from '$lib/components/composites/command/types';
import type { CommandPaletteItem } from '$lib/components/composites/command-palette/types';
import { DemoCard } from '../../components/_components';

let paletteOpen = $state(false);

const sampleItems: CommandPaletteItem[] = [
	{ id: 'r1', type: 'recent', label: 'UI Components', icon: 'i-lucide-palette', href: '/showcases/ui/components' },
	{ id: 'r2', type: 'recent', label: 'Tables', icon: 'i-lucide-table', href: '/showcases/ui/tables' },
	{
		id: 'p1',
		type: 'panel',
		label: 'Sidebar',
		icon: 'i-lucide-panel-left',
		hint: 'Shell',
		href: '/showcases/shell/sidebar',
	},
	{ id: 'p2', type: 'panel', label: 'Theme', icon: 'i-lucide-sun', hint: 'Shell', href: '/showcases/shell/theme' },
	{ id: 'pg1', type: 'page', label: 'Forms', icon: 'i-lucide-text-cursor-input', href: '/showcases/forms' },
	{ id: 'pg2', type: 'page', label: 'Database', icon: 'i-lucide-server', href: '/showcases/db' },
	{ id: 'pg3', type: 'page', label: 'Authentication', icon: 'i-lucide-lock', href: '/showcases/auth' },
	{ id: 'a1', type: 'action', label: 'Toggle Dark Mode', icon: 'i-lucide-moon', action: () => {} },
	{
		id: 'a2',
		type: 'action',
		label: 'Open Shortcuts',
		icon: 'i-lucide-keyboard',
		shortcut: 'Ctrl+/',
		action: () => {},
	},
];

const inlineGroups: CommandGroup[] = [
	{
		heading: 'Navigation',
		items: [
			{ id: 'n1', label: 'Home', icon: 'i-lucide-home', href: '/' },
			{ id: 'n2', label: 'Showcases', icon: 'i-lucide-layout', href: '/showcases' },
			{ id: 'n3', label: 'Settings', icon: 'i-lucide-settings', hint: 'App configuration' },
		],
	},
	{
		heading: 'Actions',
		items: [
			{ id: 'a1', label: 'New Document', icon: 'i-lucide-file-plus', shortcut: 'Ctrl+N' },
			{ id: 'a2', label: 'Export Data', icon: 'i-lucide-download' },
			{ id: 'a3', label: 'Print', icon: 'i-lucide-printer', shortcut: 'Ctrl+P', disabled: true },
		],
	},
];
</script>

<section id="menu-command-palette" class="section">
	<h2 class="section-title">Command Palette</h2>
	<p class="section-description">
		Search-driven action dispatch and navigation. Use when: the app has enough navigation density
		that keyboard-first search saves time.
	</p>

	<div class="demos">
		<DemoCard
			title="Modal Command Palette"
			description="Dialog-based command palette with grouped results, fuzzy search, and keyboard navigation."
		>
			<Button variant="outline" onclick={() => (paletteOpen = true)}>
				<span class="i-lucide-search h-4 w-4" ></span>
				Open Command Palette
				<kbd class="shortcut-hint">Ctrl+K</kbd>
			</Button>
		</DemoCard>

		<DemoCard
			title="Inline Command List"
			description="Embeddable searchable list for sidebars, panels, or popovers. Use when: you need a searchable list embedded in a panel."
		>
			<div class="inline-command-wrapper">
				<Command
					groups={inlineGroups}
					placeholder="Search commands..."
					emptyMessage="No commands match."
					class="border border-border rounded-lg bg-surface-2"
				/>
			</div>
		</DemoCard>
	</div>
</section>

<CommandPalette bind:open={paletteOpen} items={sampleItems} />

<style>
	.section {
		scroll-margin-top: 5rem;
		margin-bottom: var(--spacing-8);
	}

	.section-title {
		font-size: var(--text-fluid-2xl);
		font-weight: 700;
		margin: 0 0 var(--spacing-2) 0;
		color: var(--color-fg);
	}

	.section-description {
		margin: 0 0 var(--spacing-7) 0;
		font-size: var(--text-fluid-base);
		color: var(--color-muted);
		line-height: 1.6;
	}

	.demos {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-6);
	}

	.shortcut-hint {
		margin-left: var(--spacing-2);
		padding: 0.125rem 0.375rem;
		border-radius: var(--radius-sm);
		font-size: var(--text-fluid-xs);
		background: color-mix(in srgb, var(--color-muted) 20%, transparent);
		color: var(--color-muted);
	}

	.inline-command-wrapper {
		width: 100%;
		max-width: 28rem;
	}
</style>
