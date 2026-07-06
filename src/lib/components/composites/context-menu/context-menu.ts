import { cva, type VariantProps } from 'class-variance-authority';
import { floatingContentBase } from '$lib/styles/floating';

export const contextMenuContentVariants = cva([
	floatingContentBase(),
	'z-dropdown min-w-[12rem]',
	'max-h-[var(--bits-context-menu-content-available-height,20rem)]',
]);

export const contextMenuItemVariants = cva([
	'relative flex cursor-pointer select-none items-center gap-3',
	'px-3 py-2',
	'text-fluid-sm text-fg outline-none',
	'data-[highlighted]:bg-muted/10',
	'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
]);

export const contextMenuSeparatorVariants = cva(['h-px bg-border']);

export const contextMenuShortcutVariants = cva(['text-fluid-xs text-muted']);

export type ContextMenuContentVariants = VariantProps<typeof contextMenuContentVariants>;
export type ContextMenuItemVariants = VariantProps<typeof contextMenuItemVariants>;
export type ContextMenuSeparatorVariants = VariantProps<typeof contextMenuSeparatorVariants>;
export type ContextMenuShortcutVariants = VariantProps<typeof contextMenuShortcutVariants>;
