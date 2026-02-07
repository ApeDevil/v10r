import { cva, type VariantProps } from 'class-variance-authority';

export const calendarRootVariants = cva(
	[
		'inline-block rounded-md border border-border bg-surface-1 p-4',
		'shadow-sm'
	],
	{
		variants: {},
		defaultVariants: {}
	}
);

export const calendarHeaderVariants = cva(
	[
		'flex items-center justify-between',
		'mb-4'
	],
	{
		variants: {},
		defaultVariants: {}
	}
);

export const calendarHeadingVariants = cva(
	[
		'text-fluid-base font-semibold text-fg'
	],
	{
		variants: {},
		defaultVariants: {}
	}
);

export const calendarNavButtonVariants = cva(
	[
		'inline-flex h-8 w-8 items-center justify-center',
		'rounded-md',
		'text-muted hover:bg-fg-alpha hover:text-fg',
		'transition-colors duration-fast',
		'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
		'disabled:pointer-events-none disabled:opacity-50'
	],
	{
		variants: {},
		defaultVariants: {}
	}
);

export const calendarGridVariants = cva(
	[
		'w-full border-collapse',
		'text-fluid-sm'
	],
	{
		variants: {},
		defaultVariants: {}
	}
);

export const calendarHeadCellVariants = cva(
	[
		'w-9 h-9',
		'text-muted font-medium text-center',
		'pb-2'
	],
	{
		variants: {},
		defaultVariants: {}
	}
);

export const calendarCellVariants = cva(
	[
		'relative h-9 w-9 p-0',
		'text-center text-fluid-sm',
		'focus-within:relative focus-within:z-20'
	],
	{
		variants: {
			state: {
				default: 'text-fg',
				selected: '',
				today: '',
				outside: 'text-muted opacity-50',
				disabled: 'text-muted opacity-50 cursor-not-allowed',
				unavailable: 'text-muted line-through opacity-50'
			}
		},
		defaultVariants: {
			state: 'default'
		}
	}
);

export const calendarDayVariants = cva(
	[
		'inline-flex h-9 w-9 items-center justify-center',
		'rounded-md',
		'font-normal',
		'transition-colors duration-fast',
		'hover:bg-fg-alpha hover:text-fg',
		'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary',
		'disabled:pointer-events-none disabled:opacity-50'
	],
	{
		variants: {
			state: {
				default: '',
				selected: 'bg-primary text-white hover:bg-primary-hover hover:text-white',
				today: 'bg-subtle font-semibold',
				outside: '',
				disabled: '',
				unavailable: ''
			}
		},
		compoundVariants: [
			{
				state: ['selected', 'today'],
				class: 'bg-primary text-white hover:bg-primary-hover'
			}
		],
		defaultVariants: {
			state: 'default'
		}
	}
);

export type CalendarRootVariants = VariantProps<typeof calendarRootVariants>;
export type CalendarHeaderVariants = VariantProps<typeof calendarHeaderVariants>;
export type CalendarHeadingVariants = VariantProps<typeof calendarHeadingVariants>;
export type CalendarNavButtonVariants = VariantProps<typeof calendarNavButtonVariants>;
export type CalendarGridVariants = VariantProps<typeof calendarGridVariants>;
export type CalendarHeadCellVariants = VariantProps<typeof calendarHeadCellVariants>;
export type CalendarCellVariants = VariantProps<typeof calendarCellVariants>;
export type CalendarDayVariants = VariantProps<typeof calendarDayVariants>;
