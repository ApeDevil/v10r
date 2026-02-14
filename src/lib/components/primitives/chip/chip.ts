import { cva, type VariantProps } from 'class-variance-authority';

export const chipVariants = cva(
	'inline-flex items-center rounded-full font-medium cursor-default',
	{
		variants: {
			variant: {
				default: 'bg-primary text-primary',
				secondary: 'bg-muted text-muted',
				success: 'bg-success text-success',
				warning: 'bg-warning text-warning',
				error: 'bg-error text-error',
				outline: 'border border-solid border-border text-fg'
			},
			size: {
				sm: 'gap-1 px-2 py-0.5 text-fluid-xs',
				md: 'gap-1.5 px-2.5 py-1 text-fluid-sm'
			}
		},
		defaultVariants: {
			variant: 'default',
			size: 'md'
		}
	}
);

export const chipCloseVariants = cva(
	'inline-flex items-center justify-center rounded-full cursor-pointer p-0'
);

export const filterChipVariants = cva(
	[
		'inline-flex items-center rounded-full font-medium',
		'cursor-pointer select-none'
	],
	{
		variants: {
			variant: {
				default: 'bg-muted text-fg',
				outline: 'border border-solid border-border text-fg'
			},
			size: {
				sm: 'gap-1 px-2.5 py-0.5 text-fluid-xs',
				md: 'gap-1.5 px-3 py-1 text-fluid-sm'
			}
		},
		defaultVariants: {
			variant: 'default',
			size: 'md'
		}
	}
);

export type ChipVariants = VariantProps<typeof chipVariants>;
export type FilterChipVariants = VariantProps<typeof filterChipVariants>;
