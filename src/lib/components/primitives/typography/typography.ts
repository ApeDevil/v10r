import { cva, type VariantProps } from 'class-variance-authority';

export const typographyVariants = cva('color-fg', {
	variants: {
		variant: {
			h1: 'text-fluid-4xl font-bold tracking-tight',
			h2: 'text-fluid-3xl font-semibold tracking-tight',
			h3: 'text-fluid-2xl font-semibold',
			h4: 'text-fluid-xl font-semibold',
			h5: 'text-fluid-lg font-semibold',
			h6: 'text-fluid-base font-semibold',
			body: 'text-fluid-base leading-relaxed',
			lead: 'text-fluid-lg color-muted leading-relaxed',
			large: 'text-fluid-lg font-medium',
			small: 'text-fluid-sm',
			muted: 'text-fluid-sm color-muted',
			code: 'font-mono text-fluid-sm bg-subtle px-1.5 py-0.5 rounded',
			blockquote: 'text-fluid-base italic border-l-4 border-primary pl-4'
		}
	},
	defaultVariants: {
		variant: 'body'
	}
});

export type TypographyVariants = VariantProps<typeof typographyVariants>;
