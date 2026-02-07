import { cva, type VariantProps } from 'class-variance-authority';

export const badgeVariants = cva(
	'inline-flex items-center rounded-full px-2.5 py-0.5 text-fluid-xs font-medium',
	{
		variants: {
			variant: {
				default: 'bg-primary text-primary',
				secondary: 'bg-muted text-muted',
				success: 'bg-success text-success',
				warning: 'bg-warning text-warning',
				error: 'bg-error text-error',
				outline: 'border border-solid border-fg text-fg'
			}
		},
		defaultVariants: {
			variant: 'default'
		}
	}
);

export type BadgeVariants = VariantProps<typeof badgeVariants>;
