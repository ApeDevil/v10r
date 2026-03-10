import { cva, type VariantProps } from 'class-variance-authority';

export const menuBarRootVariants = cva(['flex items-center gap-1', 'border-b border-border bg-surface-2', 'px-2 py-1']);

export const menuBarTriggerVariants = cva([
	'inline-flex items-center justify-center',
	'rounded-md px-3 py-1.5',
	'text-fluid-sm font-medium text-fg',
	'transition-colors duration-fast',
	'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
	'data-[state=open]:bg-muted/10',
	'hover:bg-muted/10',
]);

export const menuBarContentVariants = cva([
	'z-dropdown min-w-[12rem]',
	'overflow-hidden rounded-md',
	'border border-border bg-surface-2 shadow-lg',
]);

export const menuBarItemVariants = cva([
	'relative flex cursor-pointer select-none items-center gap-3',
	'px-3 py-2',
	'text-fluid-sm text-fg outline-none',
	'data-[highlighted]:bg-muted/10',
	'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
]);

export const menuBarSeparatorVariants = cva(['h-px bg-border', 'my-1']);

export const menuBarShortcutVariants = cva(['ml-auto text-fluid-xs text-muted']);

export const menuBarCheckboxItemVariants = cva([
	'relative flex cursor-pointer select-none items-center gap-3',
	'px-3 py-2 pl-8',
	'text-fluid-sm text-fg outline-none',
	'data-[highlighted]:bg-muted/10',
	'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
]);

export const menuBarItemIndicatorVariants = cva(['absolute left-2 h-4 w-4', 'flex items-center justify-center']);

export type MenuBarRootVariants = VariantProps<typeof menuBarRootVariants>;
export type MenuBarTriggerVariants = VariantProps<typeof menuBarTriggerVariants>;
export type MenuBarContentVariants = VariantProps<typeof menuBarContentVariants>;
export type MenuBarItemVariants = VariantProps<typeof menuBarItemVariants>;
export type MenuBarSeparatorVariants = VariantProps<typeof menuBarSeparatorVariants>;
export type MenuBarShortcutVariants = VariantProps<typeof menuBarShortcutVariants>;
export type MenuBarCheckboxItemVariants = VariantProps<typeof menuBarCheckboxItemVariants>;
export type MenuBarItemIndicatorVariants = VariantProps<typeof menuBarItemIndicatorVariants>;
