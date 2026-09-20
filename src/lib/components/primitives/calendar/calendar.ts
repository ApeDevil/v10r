import { cva } from 'class-variance-authority';

export const calendarRootVariants = cva(
	['inline-block rounded-md border border-border bg-surface-1 p-4', 'shadow-sm'],
	{
		variants: {},
		defaultVariants: {},
	},
);

export const calendarHeaderVariants = cva(['flex items-center justify-between', 'mb-4'], {
	variants: {},
	defaultVariants: {},
});

export const calendarHeadingVariants = cva(['text-fluid-base font-semibold text-fg'], {
	variants: {},
	defaultVariants: {},
});

export const calendarNavButtonVariants = cva(
	[
		'inline-flex h-8 w-8 items-center justify-center',
		'rounded-md',
		'text-muted hover:bg-fg-alpha hover:text-fg',
		'transition-colors duration-fast',
		'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
		'disabled:pointer-events-none disabled:opacity-50',
	],
	{
		variants: {},
		defaultVariants: {},
	},
);

export const calendarGridVariants = cva(['w-full border-collapse', 'text-fluid-sm'], {
	variants: {},
	defaultVariants: {},
});

export const calendarHeadCellVariants = cva(['w-9 h-9', 'text-muted font-medium text-center', 'pb-2'], {
	variants: {},
	defaultVariants: {},
});

export const calendarCellVariants = cva(
	['relative h-9 w-9 p-0', 'text-fg text-center text-fluid-sm', 'focus-within:relative focus-within:z-20'],
	{ variants: {}, defaultVariants: {} },
);

export const calendarDayVariants = cva(
	[
		'inline-flex h-9 w-9 items-center justify-center',
		'rounded-md',
		'font-normal',
		'transition-colors duration-fast',
		'hover:bg-fg-alpha hover:text-fg',
		'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary',
		'disabled:pointer-events-none disabled:opacity-50',
	],
	{ variants: {}, defaultVariants: {} },
);
