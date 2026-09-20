import { cva, type VariantProps } from 'class-variance-authority';
import { pillColorVariants, pillSizeVariants } from '../pill-variants';

export const tagVariants = cva('inline-flex items-center font-medium cursor-default', {
	variants: {
		variant: pillColorVariants,
		size: pillSizeVariants,
		shape: {
			pill: 'rounded-full',
			rounded: 'rounded-md',
		},
	},
	defaultVariants: {
		variant: 'default',
		size: 'md',
		shape: 'pill',
	},
});

export const tagCloseVariants = cva('inline-flex items-center justify-center rounded-full cursor-pointer p-0');

export const tagSelectableVariants = cva(
	['inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-medium text-fluid-sm', 'cursor-pointer select-none'],
	{
		variants: {
			variant: {
				default: 'bg-muted text-fg',
				outline: 'border border-solid border-border text-fg',
			},
		},
		defaultVariants: {
			variant: 'default',
		},
	},
);

export type TagVariants = VariantProps<typeof tagVariants>;
export type TagSelectableVariants = VariantProps<typeof tagSelectableVariants>;
