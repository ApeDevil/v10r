import { cva, type VariantProps } from 'class-variance-authority';

export const spinnerVariants = cva(
	'inline-block rounded-full border-solid border-2 border-t-transparent animate-spin',
	{
		variants: {
			size: {
				sm: 'w-4 h-4',
				md: 'w-6 h-6',
				lg: 'w-8 h-8'
			},
			variant: {
				primary: 'border-primary',
				muted: 'border-muted'
			}
		},
		defaultVariants: {
			size: 'md',
			variant: 'primary'
		}
	}
);

export type SpinnerVariants = VariantProps<typeof spinnerVariants>;
