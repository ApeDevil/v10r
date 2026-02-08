import { cva, type VariantProps } from 'class-variance-authority';

export const resizableHandleVariants = cva(
	[
		'relative shrink-0 select-none bg-border',
		'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
	],
	{
		variants: {
			direction: {
				horizontal: 'w-px h-full cursor-col-resize',
				vertical: 'h-px w-full cursor-row-resize'
			}
		},
		defaultVariants: {
			direction: 'horizontal'
		}
	}
);

export type ResizableHandleVariants = VariantProps<typeof resizableHandleVariants>;
