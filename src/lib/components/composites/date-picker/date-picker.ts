import { cva, type VariantProps } from 'class-variance-authority';

export const datePickerRootVariants = cva(
	[
		// Root container
	],
	{
		variants: {},
		defaultVariants: {},
	},
);

export const datePickerTriggerVariants = cva(
	[
		'flex h-10 w-full items-center justify-between rounded-md border bg-bg px-3 py-2',
		'text-fluid-base text-fg placeholder:text-muted',
		'transition-colors duration-fast',
		'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
		'disabled:cursor-not-allowed disabled:opacity-50',
		'data-[state=open]:ring-2 data-[state=open]:ring-primary',
	],
	{
		variants: {
			error: {
				true: 'border-error',
				false: 'border-border',
			},
		},
		defaultVariants: {
			error: false,
		},
	},
);

export const datePickerContentVariants = cva(
	[
		'z-popover rounded-md border border-border bg-surface-2 p-0 shadow-md outline-none',
		'data-[state=open]:animate-in data-[state=closed]:animate-out',
		'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
		'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
		'data-[side=bottom]:slide-in-from-top-2',
		'data-[side=left]:slide-in-from-right-2',
		'data-[side=right]:slide-in-from-left-2',
		'data-[side=top]:slide-in-from-bottom-2',
	],
	{
		variants: {},
		defaultVariants: {},
	},
);

export const datePickerCalendarVariants = cva(['rounded-md border-none bg-transparent p-3'], {
	variants: {},
	defaultVariants: {},
});

export const datePickerLabelVariants = cva(['block text-fluid-sm font-medium text-fg mb-2'], {
	variants: {},
	defaultVariants: {},
});

export type DatePickerRootVariants = VariantProps<typeof datePickerRootVariants>;
export type DatePickerTriggerVariants = VariantProps<typeof datePickerTriggerVariants>;
export type DatePickerContentVariants = VariantProps<typeof datePickerContentVariants>;
export type DatePickerCalendarVariants = VariantProps<typeof datePickerCalendarVariants>;
export type DatePickerLabelVariants = VariantProps<typeof datePickerLabelVariants>;
