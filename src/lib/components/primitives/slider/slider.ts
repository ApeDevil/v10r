import { cva, type VariantProps } from 'class-variance-authority';

export const sliderRootVariants = cva(['relative flex items-center select-none touch-none'], {
	variants: {
		orientation: {
			horizontal: 'w-full flex-row',
			vertical: 'h-full flex-col'
		}
	},
	defaultVariants: {
		orientation: 'horizontal'
	}
});

export const sliderTrackVariants = cva(
	['relative grow overflow-hidden rounded-full bg-muted/20'],
	{
		variants: {
			size: {
				sm: 'h-1',
				md: 'h-1.5',
				lg: 'h-2'
			},
			orientation: {
				horizontal: '',
				vertical: 'w-1.5 h-full'
			}
		},
		defaultVariants: {
			size: 'md',
			orientation: 'horizontal'
		}
	}
);

export const sliderRangeVariants = cva(['absolute h-full rounded-full bg-primary']);

export const sliderThumbVariants = cva(
	[
		'block rounded-full border-2 border-primary bg-white shadow-md',
		'transition-colors duration-fast',
		'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
		'disabled:pointer-events-none disabled:opacity-50',
		'hover:bg-primary/5'
	],
	{
		variants: {
			size: {
				sm: 'h-4 w-4',
				md: 'h-5 w-5',
				lg: 'h-6 w-6'
			}
		},
		defaultVariants: {
			size: 'md'
		}
	}
);

export type SliderRootVariants = VariantProps<typeof sliderRootVariants>;
export type SliderTrackVariants = VariantProps<typeof sliderTrackVariants>;
export type SliderThumbVariants = VariantProps<typeof sliderThumbVariants>;
