<script lang="ts">
import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';
import {
	dropdownMenuContentVariants,
	dropdownMenuItemVariants,
	dropdownMenuSeparatorVariants,
} from '$lib/components/composites/dropdown-menu/dropdown-menu';
import type { MenuBarMenu } from '$lib/components/composites/menu-bar/types';
import { cn } from '$lib/utils/cn';

interface Props {
	menus: MenuBarMenu[];
}

let { menus }: Props = $props();
</script>

<DropdownMenuPrimitive.Root>
	<DropdownMenuPrimitive.Trigger class="dock-leaf-menu-trigger" aria-label="Panel commands">
		<span class="i-lucide-ellipsis-vertical"></span>
	</DropdownMenuPrimitive.Trigger>

	<DropdownMenuPrimitive.Portal>
		<DropdownMenuPrimitive.Content
			class={dropdownMenuContentVariants()}
			sideOffset={4}
			align="end"
		>
			{#each menus as menu, mi (menu.label)}
				<DropdownMenuPrimitive.Sub>
					<DropdownMenuPrimitive.SubTrigger class={cn(dropdownMenuItemVariants(), 'dock-leaf-sub-trigger')}>
						<span>{menu.label}</span>
						<span class="i-lucide-chevron-right h-3.5 w-3.5 ml-auto"></span>
					</DropdownMenuPrimitive.SubTrigger>

					<DropdownMenuPrimitive.SubContent
						class={dropdownMenuContentVariants()}
						sideOffset={2}
					>
						{#each menu.items as item}
							{#if item.type === 'separator'}
								<DropdownMenuPrimitive.Separator class={dropdownMenuSeparatorVariants()} />
							{:else if item.type === 'checkbox'}
								<DropdownMenuPrimitive.CheckboxItem
									checked={item.checked ?? false}
									disabled={item.disabled}
									class={dropdownMenuItemVariants()}
									onclick={() => item.onSelect?.()}
								>
									{#if item.icon}
										<span class={cn(item.icon, 'h-3.5 w-3.5')}></span>
									{/if}
									<span>{item.label}</span>
									{#if item.shortcut}
										<span class="dock-leaf-menu-shortcut">{item.shortcut}</span>
									{/if}
								</DropdownMenuPrimitive.CheckboxItem>
							{:else}
								<DropdownMenuPrimitive.Item
									disabled={item.disabled}
									class={dropdownMenuItemVariants()}
									onclick={() => item.onSelect?.()}
								>
									{#if item.icon}
										<span class={cn(item.icon, 'h-3.5 w-3.5')}></span>
									{/if}
									<span>{item.label}</span>
									{#if item.shortcut}
										<span class="dock-leaf-menu-shortcut">{item.shortcut}</span>
									{/if}
								</DropdownMenuPrimitive.Item>
							{/if}
						{/each}
					</DropdownMenuPrimitive.SubContent>
				</DropdownMenuPrimitive.Sub>

				{#if mi < menus.length - 1}
					<DropdownMenuPrimitive.Separator class={dropdownMenuSeparatorVariants()} />
				{/if}
			{/each}
		</DropdownMenuPrimitive.Content>
	</DropdownMenuPrimitive.Portal>
</DropdownMenuPrimitive.Root>

<style>
	:global(.dock-leaf-menu-trigger) {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
		border-radius: var(--radius-sm);
		color: var(--color-muted);
		background: transparent;
		border: none;
		cursor: pointer;
		opacity: 0.6;
		font-size: 12px;
	}

	:global(.dock-leaf-menu-trigger:hover) {
		opacity: 1;
		color: var(--color-fg);
		background: color-mix(in srgb, var(--color-fg) 15%, transparent);
	}

	:global(.dock-leaf-menu-trigger:focus-visible) {
		outline: 2px solid var(--color-primary);
		outline-offset: -2px;
	}

	.dock-leaf-menu-shortcut {
		margin-left: auto;
		font-size: 0.675rem;
		color: var(--color-muted);
		letter-spacing: 0.02em;
	}

	/* UnoCSS can't do opacity modifiers with CSS variable colors */
	:global([data-dropdown-menu-content] [data-highlighted]) {
		background-color: color-mix(in srgb, var(--color-muted) 10%, transparent);
	}

	/* Sub-trigger arrow indicator */
	:global(.dock-leaf-sub-trigger) {
		justify-content: space-between;
	}
</style>
