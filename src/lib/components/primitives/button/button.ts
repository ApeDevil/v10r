import { cva, type VariantProps } from 'class-variance-authority';

export const buttonVariants = cva(
	[
		'inline-flex items-center justify-center',
		'rounded-md font-medium',
		'transition-colors duration-fast',
		'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary',
		'disabled:pointer-events-none disabled:opacity-50'
	],
	{
		variants: {
			variant: {
				default: 'bg-primary text-white hover:bg-primary-hover',
				secondary: 'bg-muted text-fg hover:bg-border',
				outline: 'border border-border bg-transparent hover:bg-muted',
				ghost: 'hover:bg-muted',
				destructive: 'bg-error text-white hover:bg-error/90'
			},
			size: {
				sm: 'h-8 px-3 text-sm',
				md: 'h-10 px-4',
				lg: 'h-12 px-6 text-lg',
				icon: 'h-10 w-10'
			}
		},
		defaultVariants: {
			variant: 'default',
			size: 'md'
		}
	}
);

export type ButtonVariants = VariantProps<typeof buttonVariants>;
