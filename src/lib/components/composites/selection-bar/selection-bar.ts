import { cva, type VariantProps } from 'class-variance-authority';

export const selectionBarVariants = cva([
	'fixed bottom-7 left-1/2 -translate-x-1/2 z-overlay',
	'flex items-center gap-3',
	'rounded-full border border-border bg-surface-3 shadow-xl',
	'px-5 py-2',
]);

export const selectionBarCountVariants = cva(['text-fluid-sm font-medium text-primary whitespace-nowrap']);

export const selectionBarActionVariants = cva(
	[
		'flex items-center gap-2',
		'rounded-md px-3 py-1',
		'text-fluid-sm font-medium',
		'outline-none cursor-pointer',
		'transition-colors duration-fast',
	],
	{
		variants: {
			variant: {
				default: ['text-fg'],
				destructive: ['text-error-fg'],
			},
		},
		defaultVariants: {
			variant: 'default',
		},
	},
);

export const selectionBarDismissVariants = cva([
	'flex items-center justify-center',
	'rounded-full w-6 h-6',
	'text-muted cursor-pointer',
	'outline-none',
]);

export type SelectionBarVariants = VariantProps<typeof selectionBarVariants>;
export type SelectionBarCountVariants = VariantProps<typeof selectionBarCountVariants>;
export type SelectionBarActionVariants = VariantProps<typeof selectionBarActionVariants>;
export type SelectionBarDismissVariants = VariantProps<typeof selectionBarDismissVariants>;
