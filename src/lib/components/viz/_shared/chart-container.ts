import { cva, type VariantProps } from 'class-variance-authority';

/** CVA variants for viz container sizing and aspect ratios */
export const chartContainerVariants = cva('relative w-full', {
	variants: {
		aspect: {
			square: 'aspect-square',
			chart: 'aspect-[3/2]',
			auto: '',
		},
	},
	defaultVariants: { aspect: 'chart' },
});

export type ChartContainerVariants = VariantProps<typeof chartContainerVariants>;
