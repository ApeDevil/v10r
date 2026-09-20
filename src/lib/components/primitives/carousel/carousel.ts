import { cva } from 'class-variance-authority';

export const carouselRootVariants = cva('relative w-full');

export const carouselContentVariants = cva([
	'flex flex-row overflow-x-auto overflow-y-hidden scroll-smooth',
	'snap-x snap-mandatory',
	'scrollbar-hide',
	'-webkit-overflow-scrolling-touch',
]);

export const carouselItemVariants = cva('w-full flex-shrink-0 snap-start snap-always');

export const carouselButtonVariants = cva(
	[
		'absolute z-10 top-1/2 -translate-y-1/2',
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
			direction: {
				prev: 'left-2',
				next: 'right-2',
			},
		},
	},
);

export const carouselDotsVariants = cva('flex flex-row items-center justify-center gap-2 mt-4');

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
