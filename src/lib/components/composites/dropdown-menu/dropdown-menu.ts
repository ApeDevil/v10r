import { cva, type VariantProps } from 'class-variance-authority';
import { floatingContentBase } from '$lib/styles/floating';

export const dropdownMenuContentVariants = cva([
	floatingContentBase(),
	'z-dropdown min-w-[12rem]',
	'max-h-[var(--bits-dropdown-menu-content-available-height,20rem)]',
]);

export const dropdownMenuItemVariants = cva([
	'relative flex cursor-pointer select-none items-center gap-3',
	'px-3 py-2',
	'text-fluid-sm text-fg outline-none',
	'data-[highlighted]:bg-muted/10',
	'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
]);

export const dropdownMenuSeparatorVariants = cva(['h-px bg-border']);

export type DropdownMenuContentVariants = VariantProps<typeof dropdownMenuContentVariants>;
export type DropdownMenuItemVariants = VariantProps<typeof dropdownMenuItemVariants>;
export type DropdownMenuSeparatorVariants = VariantProps<typeof dropdownMenuSeparatorVariants>;
