import { cva, type VariantProps } from 'class-variance-authority';

export const buttonVariants = cva(
	[
		'inline-flex items-center justify-center',
		'rounded-md font-medium border-0',
		'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary',
		'disabled:pointer-events-none disabled:opacity-50',
	],
	{
		variants: {
			variant: {
				default: 'bg-fg text-bg hover:bg-primary hover:text-white',
				primary: 'bg-primary text-white',
				secondary: 'bg-border text-fg hover:bg-border/80',
				outline: 'border border-border bg-transparent text-fg',
				ghost: 'text-fg',
				destructive: 'border-error bg-transparent text-fg',
			},
			size: {
				sm: 'h-8 px-3 text-sm',
				md: 'h-10 px-4',
				lg: 'h-12 px-6 text-lg',
				icon: 'h-10 w-10',
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'md',
		},
	},
);

export type ButtonVariants = VariantProps<typeof buttonVariants>;
