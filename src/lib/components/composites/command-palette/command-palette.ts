import { cva, type VariantProps } from 'class-variance-authority';

export const commandPaletteOverlayVariants = cva(['fixed inset-0 z-overlay bg-black/50']);

export const commandPaletteContentVariants = cva([
	'fixed left-1/2 top-1/4 z-modal -translate-x-1/2',
	'w-full max-w-lg rounded-lg',
	'border border-border bg-surface-3 shadow-xl',
]);

export type CommandPaletteOverlayVariants = VariantProps<typeof commandPaletteOverlayVariants>;
export type CommandPaletteContentVariants = VariantProps<typeof commandPaletteContentVariants>;
