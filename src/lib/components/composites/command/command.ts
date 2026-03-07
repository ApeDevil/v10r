import { cva, type VariantProps } from 'class-variance-authority';

export const commandRootVariants = cva([
	'flex flex-col overflow-hidden rounded-md',
]);

export const commandInputVariants = cva([
	'flex w-full bg-transparent',
	'text-fluid-base text-fg placeholder:text-muted',
	'outline-none disabled:opacity-50',
]);

export const commandListVariants = cva([
	'max-h-80 overflow-y-auto overflow-x-hidden',
]);

export const commandEmptyVariants = cva([
	'py-8 text-center text-fluid-sm text-muted',
]);

export const commandGroupHeadingVariants = cva([
	'px-2 py-1.5 text-xs font-medium text-muted',
]);

export const commandItemVariants = cva([
	'relative flex cursor-pointer select-none items-center gap-3',
	'rounded-md px-3 py-2',
	'text-fluid-sm text-fg outline-none',
	'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
]);

export const commandSeparatorVariants = cva(['h-px bg-border']);

export const commandShortcutVariants = cva([
	'ml-auto text-fluid-xs text-muted',
]);

export type CommandRootVariants = VariantProps<typeof commandRootVariants>;
export type CommandInputVariants = VariantProps<typeof commandInputVariants>;
export type CommandListVariants = VariantProps<typeof commandListVariants>;
export type CommandEmptyVariants = VariantProps<typeof commandEmptyVariants>;
export type CommandGroupHeadingVariants = VariantProps<typeof commandGroupHeadingVariants>;
export type CommandItemVariants = VariantProps<typeof commandItemVariants>;
export type CommandSeparatorVariants = VariantProps<typeof commandSeparatorVariants>;
export type CommandShortcutVariants = VariantProps<typeof commandShortcutVariants>;
