import { cva, type VariantProps } from 'class-variance-authority';

export const chartRootVariants = cva(
	'relative flex flex-col gap-2',
	{
		variants: {
			size: {
				sm: 'text-xs',
				md: 'text-sm',
				lg: 'text-base'
			}
		},
		defaultVariants: {
			size: 'md'
		}
	}
);

export const chartGridVariants = cva(
	'stroke-border',
	{
		variants: {
			style: {
				solid: 'stroke-opacity-30',
				dashed: 'stroke-opacity-20 stroke-dasharray-2',
				dotted: 'stroke-opacity-15'
			}
		},
		defaultVariants: {
			style: 'solid'
		}
	}
);

export const chartAxisVariants = cva(
	'fill-muted',
	{
		variants: {
			weight: {
				normal: 'font-normal',
				medium: 'font-medium',
				semibold: 'font-semibold'
			}
		},
		defaultVariants: {
			weight: 'normal'
		}
	}
);

export const chartTooltipVariants = cva([
	'absolute z-10 pointer-events-none',
	'rounded-md border border-border',
	'bg-surface-3 px-3 py-2 shadow-lg',
	'text-sm text-fg',
	'transition-opacity duration-fast'
]);

export type ChartRootVariants = VariantProps<typeof chartRootVariants>;
export type ChartGridVariants = VariantProps<typeof chartGridVariants>;
export type ChartAxisVariants = VariantProps<typeof chartAxisVariants>;
