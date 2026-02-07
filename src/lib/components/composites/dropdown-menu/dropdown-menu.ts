import { cva, type VariantProps } from 'class-variance-authority';

export const dropdownMenuContentVariants = cva([
	'z-dropdown min-w-[12rem]',
	'overflow-hidden rounded-md',
	'border border-border bg-surface-2 shadow-lg'
]);

export const dropdownMenuItemVariants = cva([
	'relative flex cursor-pointer select-none items-center gap-3',
	'px-3 py-2',
	'text-fluid-sm text-fg outline-none',
	'transition-colors duration-fast',
	'data-[highlighted]:bg-muted/10',
	'data-[disabled]:pointer-events-none data-[disabled]:opacity-50'
]);

export const dropdownMenuSeparatorVariants = cva(['h-px bg-border']);

export type DropdownMenuContentVariants = VariantProps<typeof dropdownMenuContentVariants>;
export type DropdownMenuItemVariants = VariantProps<typeof dropdownMenuItemVariants>;
export type DropdownMenuSeparatorVariants = VariantProps<typeof dropdownMenuSeparatorVariants>;
