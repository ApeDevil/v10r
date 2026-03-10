import { cva, type VariantProps } from 'class-variance-authority';

/** Root container class for scroll area */
export const SCROLL_AREA_CLASS = 'relative overflow-hidden';

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
					'h-2.5 flex-col border-t border-t-transparent p-px data-[state=visible]:animate-in data-[state=hidden]:animate-out data-[state=hidden]:fade-out-0 data-[state=visible]:fade-in-0',
			},
			size: {
				sm: '',
				md: '',
			},
		},
		compoundVariants: [
			{
				orientation: 'vertical',
				size: 'sm',
				class: 'w-2',
			},
			{
				orientation: 'horizontal',
				size: 'sm',
				class: 'h-2',
			},
		],
		defaultVariants: {
			orientation: 'vertical',
			size: 'md',
		},
	},
);

/** Scrollbar thumb class */
export const SCROLL_THUMB_CLASS =
	'relative flex-1 rounded-full bg-border transition-colors duration-[var(--duration-fast)] hover:bg-muted';

export type ScrollbarVariants = VariantProps<typeof scrollbarVariants>;
