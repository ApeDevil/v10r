import { cva, type VariantProps } from 'class-variance-authority';

export interface PaneDefinition {
	id: string;
	label: string;
	defaultSize: number;
	minSize?: number;
	maxSize?: number;
	collapsible?: boolean;
	collapsedSize?: number;
}

export const tabBarVariants = cva(['flex items-center gap-1'], {
	variants: {
		direction: {
			horizontal: 'flex-row border-b border-border px-1 py-1',
			vertical: 'flex-col border-r border-border px-1 py-1',
		},
	},
	defaultVariants: {
		direction: 'horizontal',
	},
});

export const tabVariants = cva(
	[
		'inline-flex items-center gap-2',
		'text-fluid-sm font-medium',
		'rounded px-3 py-1.5',
		'select-none',
		'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
	],
	{
		variants: {
			active: {
				true: 'text-fg',
				false: 'text-muted',
			},
		},
		defaultVariants: {
			active: false,
		},
	},
);

export const gripVariants = cva(
	[
		'inline-flex items-center justify-center',
		'rounded',
		'text-muted',
		'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
	],
	{
		variants: {
			direction: {
				horizontal: 'cursor-grab',
				vertical: 'cursor-grab',
			},
		},
		defaultVariants: {
			direction: 'horizontal',
		},
	},
);

export type TabBarVariants = VariantProps<typeof tabBarVariants>;
export type TabVariants = VariantProps<typeof tabVariants>;
export type GripVariants = VariantProps<typeof gripVariants>;
