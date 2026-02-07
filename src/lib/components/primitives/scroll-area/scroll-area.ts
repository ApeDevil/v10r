import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Root container variants for scroll area
 */
export const scrollAreaVariants = cva('relative overflow-hidden', {
	variants: {},
	defaultVariants: {}
});

/**
 * Scrollbar track variants
 */
export const scrollbarVariants = cva(
	'flex touch-none select-none transition-colors duration-[var(--duration-fast)] ease-[var(--ease-default)]',
	{
		variants: {
			orientation: {
				vertical:
					'h-full w-2.5 border-l border-l-transparent p-px data-[state=visible]:animate-in data-[state=hidden]:animate-out data-[state=hidden]:fade-out-0 data-[state=visible]:fade-in-0',
				horizontal:
					'h-2.5 flex-col border-t border-t-transparent p-px data-[state=visible]:animate-in data-[state=hidden]:animate-out data-[state=hidden]:fade-out-0 data-[state=visible]:fade-in-0'
			},
			size: {
				sm: '',
				md: ''
			}
		},
		compoundVariants: [
			{
				orientation: 'vertical',
				size: 'sm',
				class: 'w-2'
			},
			{
				orientation: 'horizontal',
				size: 'sm',
				class: 'h-2'
			}
		],
		defaultVariants: {
			orientation: 'vertical',
			size: 'md'
		}
	}
);

/**
 * Scrollbar thumb variants
 */
export const scrollThumbVariants = cva(
	'relative flex-1 rounded-full bg-border transition-colors duration-[var(--duration-fast)] hover:bg-muted',
	{
		variants: {},
		defaultVariants: {}
	}
);

export type ScrollAreaVariants = VariantProps<typeof scrollAreaVariants>;
export type ScrollbarVariants = VariantProps<typeof scrollbarVariants>;
export type ScrollThumbVariants = VariantProps<typeof scrollThumbVariants>;
