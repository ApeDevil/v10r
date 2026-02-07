import { cva, type VariantProps } from 'class-variance-authority';

export const accordionItemVariants = cva(
	'border-b border-border overflow-hidden',
	{
		variants: {
			variant: {
				default: '',
				bordered: 'border border-border rounded-md mb-2',
				filled: 'bg-subtle border border-border rounded-md mb-2'
			}
		},
		defaultVariants: {
			variant: 'default'
		}
	}
);

export const accordionTriggerVariants = cva(
	'flex w-full items-center justify-between gap-2 py-4 font-medium transition-all',
	{
		variants: {
			size: {
				sm: 'text-fluid-sm px-2',
				md: 'text-fluid-base px-3',
				lg: 'text-fluid-lg px-4'
			}
		},
		defaultVariants: {
			size: 'md'
		}
	}
);

export const accordionContentVariants = cva(
	'overflow-hidden text-fg/90 transition-all duration-normal',
	{
		variants: {
			size: {
				sm: 'text-fluid-sm px-2 pb-3',
				md: 'text-fluid-base px-3 pb-4',
				lg: 'text-fluid-lg px-4 pb-5'
			}
		},
		defaultVariants: {
			size: 'md'
		}
	}
);

export const accordionChevronVariants = cva(
	'i-lucide-chevron-down shrink-0 text-muted transition-transform duration-normal',
	{
		variants: {
			size: {
				sm: 'h-3 w-3',
				md: 'h-4 w-4',
				lg: 'h-5 w-5'
			}
		},
		defaultVariants: {
			size: 'md'
		}
	}
);

export type AccordionItemVariants = VariantProps<typeof accordionItemVariants>;
export type AccordionTriggerVariants = VariantProps<typeof accordionTriggerVariants>;
export type AccordionContentVariants = VariantProps<typeof accordionContentVariants>;
export type AccordionChevronVariants = VariantProps<typeof accordionChevronVariants>;

export type AccordionVariants = AccordionItemVariants &
	AccordionTriggerVariants &
	AccordionContentVariants;
