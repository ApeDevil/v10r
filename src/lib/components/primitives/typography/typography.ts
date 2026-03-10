import { cva, type VariantProps } from 'class-variance-authority';

export const typographyVariants = cva('', {
	variants: {
		variant: {
			h1: 'text-fluid-4xl font-bold tracking-tight color-fg',
			h2: 'text-fluid-3xl font-semibold tracking-tight color-fg',
			h3: 'text-fluid-2xl font-semibold color-fg',
			h4: 'text-fluid-xl font-semibold color-fg',
			h5: 'text-fluid-lg font-semibold color-fg',
			h6: 'text-fluid-base font-semibold color-fg',
			body: 'text-fluid-base leading-relaxed color-body',
			lead: 'text-fluid-lg color-muted leading-relaxed',
			large: 'text-fluid-lg font-medium color-fg',
			small: 'text-fluid-sm color-fg',
			muted: 'text-fluid-sm color-muted',
			code: 'font-mono text-fluid-sm bg-subtle px-1.5 py-0.5 rounded color-fg',
			blockquote: 'text-fluid-base italic border-l-4 border-primary pl-4 color-fg',
		},
	},
	defaultVariants: {
		variant: 'body',
	},
});

export type TypographyVariants = VariantProps<typeof typographyVariants>;
