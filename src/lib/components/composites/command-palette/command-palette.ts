import { cva, type VariantProps } from 'class-variance-authority';

export const commandPaletteOverlayVariants = cva(['fixed inset-0 z-overlay bg-black/50']);

export const commandPaletteContentVariants = cva([
	'fixed left-1/2 top-1/4 z-modal -translate-x-1/2',
	'w-[calc(100vw-2rem)] max-w-lg rounded-lg',
	'max-h-[calc(75dvh-1rem)] overflow-y-auto',
	'border',
]);

export type CommandPaletteOverlayVariants = VariantProps<typeof commandPaletteOverlayVariants>;
export type CommandPaletteContentVariants = VariantProps<typeof commandPaletteContentVariants>;
