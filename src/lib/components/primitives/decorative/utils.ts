/** Generate a unique ID for SVG defs (filters, patterns, clipPaths). */
export function createDecorativeId(prefix: string): string {
	return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}
