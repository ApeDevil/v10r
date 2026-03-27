import { cva, type VariantProps } from 'class-variance-authority';

export const carouselRootVariants = cva('relative w-full', {
	variants: {
		orientation: {
			horizontal: '',
			vertical: 'h-full',
		},
	},
	defaultVariants: {
		orientation: 'horizontal',
	},
});

export const carouselContentVariants = cva(
	[
		'flex overflow-x-auto overflow-y-hidden scroll-smooth',
		'snap-x snap-mandatory',
		'scrollbar-hide',
		'-webkit-overflow-scrolling-touch',
	],
	{
		variants: {
			orientation: {
				horizontal: 'flex-row',
				vertical: 'flex-col overflow-x-hidden overflow-y-auto snap-y',
			},
		},
		defaultVariants: {
			orientation: 'horizontal',
		},
	},
);

export const carouselItemVariants = cva('flex-shrink-0 snap-start snap-always', {
	variants: {
		orientation: {
			horizontal: 'w-full',
			vertical: 'h-full',
		},
	},
	defaultVariants: {
		orientation: 'horizontal',
	},
});

export const carouselButtonVariants = cva(
	[
		'absolute z-10',
		'inline-flex items-center justify-center',
		'h-10 w-10 rounded-full',
		'bg-surface-3/90 text-fg',
		'border border-border',
		'shadow-md',
		'transition-all duration-fast',
		'hover:bg-surface-3 hover:scale-110',
		'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
		'disabled:pointer-events-none disabled:opacity-30',
	],
	{
		variants: {
			orientation: {
				horizontal: 'top-1/2 -translate-y-1/2',
				vertical: 'left-1/2 -translate-x-1/2',
			},
			direction: {
				prev: '',
				next: '',
			},
		},
		compoundVariants: [
			{
				orientation: 'horizontal',
				direction: 'prev',
				class: 'left-2',
			},
			{
				orientation: 'horizontal',
				direction: 'next',
				class: 'right-2',
			},
			{
				orientation: 'vertical',
				direction: 'prev',
				class: 'top-2',
			},
			{
				orientation: 'vertical',
				direction: 'next',
				class: 'bottom-2',
			},
		],
		defaultVariants: {
			orientation: 'horizontal',
		},
	},
);

export const carouselDotsVariants = cva('flex items-center justify-center gap-2 mt-4', {
	variants: {
		orientation: {
			horizontal: 'flex-row',
			vertical: 'flex-col',
		},
	},
	defaultVariants: {
		orientation: 'horizontal',
	},
});

export const carouselDotVariants = cva(
	[
		'h-2 w-2 rounded-full',
		'transition-all duration-fast',
		'border border-border',
		'cursor-pointer',
		'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
	],
	{
		variants: {
			active: {
				true: 'bg-primary w-6 scale-110',
				false: 'bg-border hover:bg-muted',
			},
		},
		defaultVariants: {
			active: false,
		},
	},
);

export type CarouselRootVariants = VariantProps<typeof carouselRootVariants>;
export type CarouselContentVariants = VariantProps<typeof carouselContentVariants>;
export type CarouselItemVariants = VariantProps<typeof carouselItemVariants>;
export type CarouselButtonVariants = VariantProps<typeof carouselButtonVariants>;
export type CarouselDotsVariants = VariantProps<typeof carouselDotsVariants>;
export type CarouselDotVariants = VariantProps<typeof carouselDotVariants>;
