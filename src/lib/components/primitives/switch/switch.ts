import { cva, type VariantProps } from 'class-variance-authority';

export const switchRootVariants = cva(
	[
		'inline-flex shrink-0 cursor-pointer items-center rounded-full border-0',
		'transition-colors duration-fast',
		'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
		'disabled:cursor-not-allowed disabled:opacity-50',
		'data-[state=unchecked]:bg-muted/20 data-[state=checked]:bg-primary'
	],
	{
		variants: {
			size: {
				sm: 'h-5 w-9',
				md: 'h-6 w-11',
				lg: 'h-7 w-[3.25rem]'
			}
		},
		defaultVariants: {
			size: 'md'
		}
	}
);

export const switchThumbVariants = cva(
	[
		'pointer-events-none block rounded-full bg-white shadow-sm ring-0',
		'transition-transform duration-fast'
	],
	{
		variants: {
			size: {
				sm: 'h-4 w-4 data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0.5',
				md: 'h-5 w-5 data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0.5',
				lg: 'h-6 w-6 data-[state=checked]:translate-x-6 data-[state=unchecked]:translate-x-0.5'
			}
		},
		defaultVariants: {
			size: 'md'
		}
	}
);

export type SwitchVariants = VariantProps<typeof switchRootVariants>;
