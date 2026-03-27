<script lang="ts">
import { Menubar } from 'bits-ui';
import { cn } from '$lib/utils/cn';
import {
	menuBarCheckboxItemVariants,
	menuBarContentVariants,
	menuBarItemIndicatorVariants,
	menuBarItemVariants,
	menuBarRootVariants,
	menuBarSeparatorVariants,
	menuBarShortcutVariants,
	menuBarTriggerVariants,
} from './menu-bar';
import type { MenuBarMenu } from './types';

interface Props {
	menus: MenuBarMenu[];
	class?: string;
}

let { menus, class: className }: Props = $props();
</script>

<Menubar.Root class={cn(menuBarRootVariants(), className)}>
	{#each menus as menu}
		<Menubar.Menu>
			<Menubar.Trigger class={menuBarTriggerVariants()}>
				{menu.label}
			</Menubar.Trigger>

			<Menubar.Portal>
				<Menubar.Content class={menuBarContentVariants()} sideOffset={4} align="start">
					{#each menu.items as item}
						{#if item.type === 'separator'}
							<Menubar.Separator class={menuBarSeparatorVariants()} />
						{:else if item.type === 'checkbox'}
							<Menubar.CheckboxItem
								disabled={item.disabled}
								class={menuBarCheckboxItemVariants()}
								bind:checked={item.checked}
								onCheckedChange={() => {
									if (item.onSelect) {
										item.onSelect();
									}
								}}
							>
								{#snippet children({ checked })}
									<span class={cn(menuBarItemIndicatorVariants(), !checked && 'invisible')}>
										<span class="i-lucide-check h-4 w-4" ></span>
									</span>
									{#if item.icon}
										<span class={cn(item.icon, 'h-4 w-4')} ></span>
									{/if}
									<span class="flex-1">{item.label}</span>
									{#if item.shortcut}
										<span class={menuBarShortcutVariants()}>{item.shortcut}</span>
									{/if}
								{/snippet}
							</Menubar.CheckboxItem>
						{:else}
							<Menubar.Item
								disabled={item.disabled}
								class={menuBarItemVariants()}
								onSelect={() => {
									if (item.onSelect) {
										item.onSelect();
									}
								}}
							>
								{#if item.icon}
									<span class={cn(item.icon, 'h-4 w-4')} ></span>
								{/if}
								<span class="flex-1">{item.label}</span>
								{#if item.shortcut}
									<span class={menuBarShortcutVariants()}>{item.shortcut}</span>
								{/if}
							</Menubar.Item>
						{/if}
					{/each}
				</Menubar.Content>
			</Menubar.Portal>
		</Menubar.Menu>
	{/each}
</Menubar.Root>

<style>
	/* UnoCSS can't extract bg-muted/10 variants from .ts files (opacity modifier too complex) */
	:global([data-menubar-content] [role='menuitem'][data-highlighted]),
	:global([data-menubar-content] [role='menuitemcheckbox'][data-highlighted]) {
		background-color: color-mix(in srgb, var(--color-muted) 10%, transparent);
	}

	:global([data-menubar-trigger][data-state='open']),
	:global([data-menubar-trigger]:hover) {
		background-color: color-mix(in srgb, var(--color-muted) 10%, transparent);
	}
</style>
