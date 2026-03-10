import { cva, type VariantProps } from 'class-variance-authority';
import { pillColorVariants, pillSizeVariants } from '../pill-variants';

export const tagVariants = cva('inline-flex items-center rounded-full font-medium cursor-default', {
	variants: {
		variant: pillColorVariants,
		size: pillSizeVariants,
	},
	defaultVariants: {
		variant: 'default',
		size: 'md',
	},
});

export const tagCloseVariants = cva('inline-flex items-center justify-center rounded-full cursor-pointer p-0');

export const tagSelectableVariants = cva(
	['inline-flex items-center rounded-full font-medium', 'cursor-pointer select-none'],
	{
		variants: {
			variant: {
				default: 'bg-muted text-fg',
				outline: 'border border-solid border-border text-fg',
			},
			size: {
				sm: 'gap-1 px-2.5 py-0.5 text-fluid-xs',
				md: 'gap-1.5 px-3 py-1 text-fluid-sm',
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'md',
		},
	},
);

export type TagVariants = VariantProps<typeof tagVariants>;
export type TagSelectableVariants = VariantProps<typeof tagSelectableVariants>;
