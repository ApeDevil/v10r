import { cva, type VariantProps } from 'class-variance-authority';

export const toggleVariants = cva(
	[
		'inline-flex items-center justify-center',
		'rounded-md font-medium border-0',
		'transition-colors duration-fast',
		'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary',
		'disabled:pointer-events-none disabled:opacity-50',
		'data-[state=off]:bg-transparent data-[state=off]:text-fg data-[state=off]:hover:bg-subtle',
		'data-[state=on]:bg-subtle data-[state=on]:text-fg'
	],
	{
		variants: {
			variant: {
				default: '',
				outline: [
					'border border-border',
					'data-[state=off]:border-border data-[state=off]:hover:bg-subtle',
					'data-[state=on]:border-border data-[state=on]:bg-subtle'
				]
			},
			size: {
				sm: 'h-8 px-2.5 text-sm',
				md: 'h-10 px-3',
				lg: 'h-12 px-4 text-lg'
			}
		},
		defaultVariants: {
			variant: 'default',
			size: 'md'
		}
	}
);

export type ToggleVariants = VariantProps<typeof toggleVariants>;
