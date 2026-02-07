import { cva, type VariantProps } from 'class-variance-authority';

export const progressTrackVariants = cva(
	'relative w-full overflow-hidden rounded-full bg-muted/20',
	{
		variants: {
			size: {
				sm: 'h-1.5',
				md: 'h-2.5',
				lg: 'h-4'
			}
		},
		defaultVariants: {
			size: 'md'
		}
	}
);

export const progressIndicatorVariants = cva(
	'h-full rounded-full transition-all duration-normal',
	{
		variants: {
			variant: {
				default: 'bg-primary',
				success: 'bg-success',
				warning: 'bg-warning',
				error: 'bg-error'
			}
		},
		defaultVariants: {
			variant: 'default'
		}
	}
);

export type ProgressTrackVariants = VariantProps<typeof progressTrackVariants>;
export type ProgressIndicatorVariants = VariantProps<typeof progressIndicatorVariants>;
