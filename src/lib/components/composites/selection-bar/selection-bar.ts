import { cva, type VariantProps } from 'class-variance-authority';

export const selectionBarVariants = cva([
	'fixed bottom-[calc(2rem+var(--safe-bottom))] left-1/2 -translate-x-1/2 z-panel',
	'flex items-center gap-3 max-w-[calc(100vw-1rem)] flex-wrap justify-center',
	'rounded-full border',
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
