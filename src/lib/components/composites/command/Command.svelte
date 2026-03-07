<script lang="ts">
	import { Command as CommandPrimitive } from 'bits-ui';
	import { goto } from '$app/navigation';
	import { cn } from '$lib/utils/cn';
	import type { CommandItem, CommandGroup } from './types';
	import {
		commandRootVariants,
		commandInputVariants,
		commandListVariants,
		commandEmptyVariants,
		commandGroupHeadingVariants,
		commandItemVariants,
		commandShortcutVariants,
		commandSeparatorVariants,
	} from './command';

	interface Props {
		/** Flat item list (rendered ungrouped) */
		items?: CommandItem[];
		/** Grouped items with headings */
		groups?: CommandGroup[];
		placeholder?: string;
		emptyMessage?: string;
		class?: string;
		/** Hide the search input (for static lists) */
		hideInput?: boolean;
	}

	let {
		items = [],
		groups = [],
		placeholder = 'Search...',
		emptyMessage = 'No results found.',
		class: className,
		hideInput = false,
	}: Props = $props();

	function handleSelect(item: CommandItem) {
		if (item.onSelect) {
			item.onSelect();
		} else if (item.href) {
			goto(item.href);
		}
	}
</script>

<CommandPrimitive.Root class={cn(commandRootVariants(), className)}>
	{#if !hideInput}
		<div class="flex items-center gap-3 border-b border-border px-3 py-2">
			<span class="i-lucide-search h-4 w-4 text-muted shrink-0" />
			<CommandPrimitive.Input
				{placeholder}
				class={commandInputVariants()}
			/>
		</div>
	{/if}

	<CommandPrimitive.List class={commandListVariants()}>
		<CommandPrimitive.Empty class={commandEmptyVariants()}>
			{emptyMessage}
		</CommandPrimitive.Empty>

		{#if items.length > 0}
			<CommandPrimitive.Group>
				{#each items as item (item.id)}
					<CommandPrimitive.Item
						value="{item.label} {item.hint ?? ''} {item.keywords?.join(' ') ?? ''}"
						disabled={item.disabled}
						class={commandItemVariants()}
						onSelect={() => handleSelect(item)}
					>
						{#if item.icon}
							<span class={cn(item.icon, 'h-4 w-4 shrink-0')} />
						{/if}
						<span class="flex flex-col min-w-0">
							<span>{item.label}</span>
							{#if item.hint}
								<span class="cmd-hint">{item.hint}</span>
							{/if}
						</span>
						{#if item.shortcut}
							<span class={commandShortcutVariants()}>{item.shortcut}</span>
						{/if}
					</CommandPrimitive.Item>
				{/each}
			</CommandPrimitive.Group>
		{/if}

		{#each groups as group (group.heading)}
			<CommandPrimitive.Group>
				<CommandPrimitive.GroupHeading class={commandGroupHeadingVariants()}>
					{group.heading}
				</CommandPrimitive.GroupHeading>
				<CommandPrimitive.GroupItems>
					{#each group.items as item (item.id)}
						<CommandPrimitive.Item
							value="{item.label} {item.hint ?? ''} {item.keywords?.join(' ') ?? ''}"
							disabled={item.disabled}
							class={commandItemVariants()}
							onSelect={() => handleSelect(item)}
						>
							{#if item.icon}
								<span class={cn(item.icon, 'h-4 w-4 shrink-0')} />
							{/if}
							<span class="flex flex-col min-w-0">
								<span>{item.label}</span>
								{#if item.hint}
									<span class="cmd-hint">{item.hint}</span>
								{/if}
							</span>
							{#if item.shortcut}
								<span class={commandShortcutVariants()}>{item.shortcut}</span>
							{/if}
						</CommandPrimitive.Item>
					{/each}
				</CommandPrimitive.GroupItems>
			</CommandPrimitive.Group>

			{#if groups.indexOf(group) < groups.length - 1}
				<CommandPrimitive.Separator class={commandSeparatorVariants()} />
			{/if}
		{/each}
	</CommandPrimitive.List>
</CommandPrimitive.Root>

<style>
	/* UnoCSS can't extract opacity modifiers with CSS variables */
	:global([data-command-item][data-highlighted]) {
		background-color: color-mix(in srgb, var(--color-muted) 10%, transparent);
	}

	.cmd-hint {
		font-size: 11px;
		color: var(--color-muted);
		line-height: 1.2;
	}
</style>
