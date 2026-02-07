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
				sm: 'h-[1.25rem] w-[2.25rem]',   // 20px × 36px
				md: 'h-6 w-[2.75rem]',             // 24px × 44px
				lg: 'h-[1.75rem] w-[3.25rem]'      // 28px × 52px
			}
		},
		defaultVariants: {
			size: 'md'
		}
	}
);

export const switchThumbVariants = cva(
	[
		'pointer-events-none block rounded-full bg-white dark:bg-black shadow-sm ring-0',
		'transition-transform duration-fast'
	],
	{
		variants: {
			size: {
				sm: 'h-[1rem] w-[1rem] data-[state=checked]:translate-x-[18px] data-[state=unchecked]:translate-x-[2px]',
				md: 'h-[1.25rem] w-[1.25rem] data-[state=checked]:translate-x-[22px] data-[state=unchecked]:translate-x-[2px]',
				lg: 'h-6 w-6 data-[state=checked]:translate-x-[26px] data-[state=unchecked]:translate-x-[2px]'
			}
		},
		defaultVariants: {
			size: 'md'
		}
	}
);

export type SwitchVariants = VariantProps<typeof switchRootVariants>;
