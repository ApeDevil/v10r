import { cva, type VariantProps } from 'class-variance-authority';

export const chipVariants = cva(
	'inline-flex items-center rounded-full font-medium border-0 cursor-default',
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
	'inline-flex items-center justify-center rounded-full border-0 cursor-pointer p-0',
	{
		variants: {
			size: {
				sm: 'h-3.5 w-3.5',
				md: 'h-4 w-4'
			}
		},
		defaultVariants: {
			size: 'md'
		}
	}
);

export const filterChipVariants = cva(
	[
		'inline-flex items-center rounded-full font-medium border-0',
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
