import { cva } from 'class-variance-authority';

export const chartRootVariants = cva('relative flex flex-col gap-2 text-sm');

export const chartGridVariants = cva('stroke-border stroke-opacity-30', { variants: {}, defaultVariants: {} });

export const chartAxisVariants = cva('fill-muted font-normal', { variants: {}, defaultVariants: {} });

export const chartTooltipVariants = cva([
	'absolute z-10 pointer-events-none',
	'rounded-md border border-border',
	'bg-surface-3 px-3 py-2 shadow-lg',
	'text-sm text-fg',
	'transition-opacity duration-fast',
]);
