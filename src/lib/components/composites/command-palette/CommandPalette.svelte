<script lang="ts">
import { Command as CommandPrimitive, Dialog } from 'bits-ui';
import { goto } from '$app/navigation';
import { cn } from '$lib/utils/cn';
import {
	commandEmptyVariants,
	commandGroupHeadingVariants,
	commandInputVariants,
	commandItemVariants,
	commandListVariants,
	commandShortcutVariants,
} from '../command/command';
import { commandPaletteContentVariants, commandPaletteOverlayVariants } from './command-palette';
import type { CommandPaletteItem } from './types';

interface Props {
	open: boolean;
	items: CommandPaletteItem[];
	placeholder?: string;
}

let { open = $bindable(false), items, placeholder = 'Search pages, panels, actions...' }: Props = $props();

let inputValue = $state('');

// Group items by type with per-group caps when query is active
let grouped = $derived.by(() => {
	const recent = items.filter((i) => i.type === 'recent');
	const panels = items.filter((i) => i.type === 'panel');
	const pages = items.filter((i) => i.type === 'page');
	const actions = items.filter((i) => i.type === 'action');

	if (inputValue) {
		return {
			recent,
			panels: panels.slice(0, 4),
			pages: pages.slice(0, 8),
			actions: actions.slice(0, 3),
		};
	}

	// Hide pages when no query (too many)
	return { recent, panels, pages: [], actions };
});

function handleSelect(item: CommandPaletteItem) {
	open = false;
	inputValue = '';
	if (item.href) {
		goto(item.href);
	} else if (item.action) {
		item.action();
	}
}

function handleSecondary(item: CommandPaletteItem) {
	open = false;
	inputValue = '';
	item.secondary?.action();
}

// Reset on open
$effect(() => {
	if (open) {
		inputValue = '';
	}
});
</script>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay class={commandPaletteOverlayVariants()} />
		<Dialog.Content class={commandPaletteContentVariants()}>
			<CommandPrimitive.Root
				class="flex flex-col"
				shouldFilter={false}
			>
				<div class="cp-input-row flex items-center gap-3 px-4 py-3">
					<span class="i-lucide-search h-5 w-5 text-muted shrink-0" ></span>
					<CommandPrimitive.Input
						{placeholder}
						class={cn(commandInputVariants(), 'flex-1')}
						autofocus
						bind:value={inputValue}
					/>
					<kbd class="cp-kbd rounded px-2 py-0.5 text-xs text-muted">ESC</kbd>
				</div>

				<CommandPrimitive.List class={cn(commandListVariants(), 'p-2 flex flex-col gap-2')}>
					<CommandPrimitive.Empty class={commandEmptyVariants()}>
						No results found.
					</CommandPrimitive.Empty>

					{#if grouped.recent.length > 0}
						<CommandPrimitive.Group>
							<CommandPrimitive.GroupHeading class={commandGroupHeadingVariants()}>
								Recent
							</CommandPrimitive.GroupHeading>
							<CommandPrimitive.GroupItems>
								{#each grouped.recent as item (item.id)}
									{@render paletteItem(item)}
								{/each}
							</CommandPrimitive.GroupItems>
						</CommandPrimitive.Group>
					{/if}

					{#if grouped.panels.length > 0}
						<CommandPrimitive.Group>
							<CommandPrimitive.GroupHeading class={commandGroupHeadingVariants()}>
								Panels
							</CommandPrimitive.GroupHeading>
							<CommandPrimitive.GroupItems>
								{#each grouped.panels as item (item.id)}
									{@render paletteItem(item)}
								{/each}
							</CommandPrimitive.GroupItems>
						</CommandPrimitive.Group>
					{/if}

					{#if grouped.pages.length > 0}
						<CommandPrimitive.Group>
							<CommandPrimitive.GroupHeading class={commandGroupHeadingVariants()}>
								Pages
							</CommandPrimitive.GroupHeading>
							<CommandPrimitive.GroupItems>
								{#each grouped.pages as item (item.id)}
									{@render paletteItem(item)}
								{/each}
							</CommandPrimitive.GroupItems>
						</CommandPrimitive.Group>
					{/if}

					{#if grouped.actions.length > 0}
						<CommandPrimitive.Group>
							<CommandPrimitive.GroupHeading class={commandGroupHeadingVariants()}>
								Actions
							</CommandPrimitive.GroupHeading>
							<CommandPrimitive.GroupItems>
								{#each grouped.actions as item (item.id)}
									{@render paletteItem(item)}
								{/each}
							</CommandPrimitive.GroupItems>
						</CommandPrimitive.Group>
					{/if}
				</CommandPrimitive.List>
			</CommandPrimitive.Root>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

{#snippet paletteItem(item: CommandPaletteItem)}
	<div class="cp-item-row">
		<CommandPrimitive.Item
			value="{item.label} {item.hint ?? ''}"
			class={cn(
				commandItemVariants(),
				'flex-1 min-w-0',
				item.hint ? 'py-1.5' : 'py-2',
			)}
			onSelect={() => handleSelect(item)}
		>
			<span class={cn(item.icon, 'h-4 w-4 shrink-0')} ></span>
			<span class="flex flex-col min-w-0">
				<span>{item.label}</span>
				{#if item.hint}
					<span class="cp-hint">{item.hint}</span>
				{/if}
			</span>
			{#if item.shortcut}
				<span class={commandShortcutVariants()}>{item.shortcut}</span>
			{/if}
		</CommandPrimitive.Item>
		{#if item.secondary}
			<button
				class="cp-secondary-btn"
				tabindex={-1}
				title={item.secondary.label}
				onclick={(e: MouseEvent) => {
					e.stopPropagation();
					handleSecondary(item);
				}}
			>
				<span class={cn(item.secondary.icon, 'h-3.5 w-3.5')} ></span>
			</button>
		{/if}
	</div>
{/snippet}

<style>
	.cp-input-row {
		background-color: var(--color-input);
		border-radius: var(--radius-md) var(--radius-md) 0 0;
		border: 1px solid var(--color-input-border);
	}

	.cp-kbd {
		background-color: color-mix(in srgb, var(--color-muted) 20%, transparent);
		border: 1px solid color-mix(in srgb, var(--color-muted) 30%, transparent);
	}

	.cp-hint {
		font-size: 11px;
		color: var(--color-muted);
		line-height: 1.2;
	}

	/* Row wrapper for item + secondary button */
	.cp-item-row {
		position: relative;
		display: flex;
		align-items: center;
		border-radius: var(--radius-md);
	}

	/* Highlighted item via Bits UI Command data attribute */
	:global([data-command-item][data-highlighted]) {
		background-color: color-mix(in srgb, var(--color-primary) 10%, transparent);
		color: var(--color-primary);
	}

	/* Secondary action button */
	.cp-secondary-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: var(--radius-sm);
		color: var(--color-muted);
		background: transparent;
		cursor: pointer;
		opacity: 0;
		flex-shrink: 0;
		margin-right: 4px;
	}

	.cp-secondary-btn:hover {
		color: var(--color-fg);
		background: color-mix(in srgb, var(--color-muted) 15%, transparent);
	}

	.cp-secondary-btn:focus-visible {
		opacity: 1;
		outline: 2px solid var(--color-primary);
		outline-offset: -2px;
	}

	.cp-item-row:hover .cp-secondary-btn,
	:global(.cp-item-row:has([data-highlighted])) .cp-secondary-btn,
	.cp-item-row:focus-within .cp-secondary-btn {
		opacity: 1;
	}
</style>
