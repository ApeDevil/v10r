import { cva, type VariantProps } from 'class-variance-authority';

/** CVA variants for viz container sizing and aspect ratios */
export const chartContainerVariants = cva(
	'relative w-full',
	{
		variants: {
			aspect: {
				video: 'aspect-video',
				square: 'aspect-square',
				wide: 'aspect-[21/9]',
				chart: 'aspect-[3/2]',
				auto: '',
			},
		},
		defaultVariants: { aspect: 'chart' },
	}
);

export type ChartContainerVariants = VariantProps<typeof chartContainerVariants>;
