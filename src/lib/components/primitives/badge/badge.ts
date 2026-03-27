import { cva, type VariantProps } from 'class-variance-authority';
import { pillColorVariants } from '../pill-variants';

export const badgeVariants = cva('inline-flex items-center rounded-full px-2.5 py-0.5 text-fluid-xs font-medium', {
	variants: {
		variant: pillColorVariants,
	},
	defaultVariants: {
		variant: 'default',
	},
});

export type BadgeVariants = VariantProps<typeof badgeVariants>;
