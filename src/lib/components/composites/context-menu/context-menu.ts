import { cva, type VariantProps } from 'class-variance-authority';

export const contextMenuContentVariants = cva([
	'z-dropdown min-w-[12rem]',
	'overflow-hidden rounded-md',
	'border border-border bg-surface-2 shadow-lg'
]);

export const contextMenuItemVariants = cva([
	'relative flex cursor-pointer select-none items-center gap-3',
	'px-3 py-2',
	'text-fluid-sm text-fg outline-none',
	'data-[highlighted]:bg-muted/10',
	'data-[disabled]:pointer-events-none data-[disabled]:opacity-50'
]);

export const contextMenuSeparatorVariants = cva(['h-px bg-border']);

export const contextMenuShortcutVariants = cva(['text-fluid-xs text-muted']);

export type ContextMenuContentVariants = VariantProps<typeof contextMenuContentVariants>;
export type ContextMenuItemVariants = VariantProps<typeof contextMenuItemVariants>;
export type ContextMenuSeparatorVariants = VariantProps<typeof contextMenuSeparatorVariants>;
export type ContextMenuShortcutVariants = VariantProps<typeof contextMenuShortcutVariants>;
