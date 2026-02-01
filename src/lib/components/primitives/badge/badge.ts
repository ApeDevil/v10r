import { cva, type VariantProps } from 'class-variance-authority';

export const badgeVariants = cva(
	'inline-flex items-center rounded-full px-2.5 py-0.5 text-fluid-xs font-medium',
	{
		variants: {
			variant: {
				default: 'bg-primary/10 text-primary',
				secondary: 'bg-muted/20 text-muted',
				success: 'bg-success/10 text-success',
				warning: 'bg-warning/10 text-warning',
				error: 'bg-error/10 text-error',
				outline: 'border border-border text-fg'
			}
		},
		defaultVariants: {
			variant: 'default'
		}
	}
);

export type BadgeVariants = VariantProps<typeof badgeVariants>;
