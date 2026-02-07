import { cva, type VariantProps } from 'class-variance-authority';

export const resizablePaneGroupVariants = cva(
	['flex overflow-hidden'],
	{
		variants: {
			direction: {
				horizontal: 'flex-row',
				vertical: 'flex-col'
			}
		},
		defaultVariants: {
			direction: 'horizontal'
		}
	}
);

export const resizablePaneVariants = cva(
	['overflow-auto', 'min-w-0 min-h-0'],
	{
		variants: {},
		defaultVariants: {}
	}
);

export const resizableHandleVariants = cva(
	[
		'relative shrink-0 cursor-col-resize select-none',
		'bg-border hover:bg-primary/50',
		'transition-colors duration-fast',
		'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
		'active:bg-primary',
		'data-[direction=vertical]:cursor-row-resize'
	],
	{
		variants: {
			direction: {
				horizontal: 'w-1 h-full',
				vertical: 'h-1 w-full'
			},
			withHandle: {
				true: 'hover:bg-primary/70',
				false: ''
			}
		},
		defaultVariants: {
			direction: 'horizontal',
			withHandle: false
		}
	}
);

export type ResizablePaneGroupVariants = VariantProps<typeof resizablePaneGroupVariants>;
export type ResizablePaneVariants = VariantProps<typeof resizablePaneVariants>;
export type ResizableHandleVariants = VariantProps<typeof resizableHandleVariants>;

export interface ResizableContext {
	readonly direction: 'horizontal' | 'vertical';
	readonly sizes: number[];
	registerPane(defaultSize: number, min: number, max: number): number;
	registerHandle(): number;
	resize(handleIndex: number, deltaPx: number): void;
	getGroupEl(): HTMLElement | undefined;
	getConstraints(paneIndex: number): { min: number; max: number };
}
