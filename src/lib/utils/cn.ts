/**
 * Class name utility for merging UnoCSS classes.
 * Uses clsx for combining class names with conditionals.
 */

import { type ClassValue, clsx } from 'clsx';

/**
 * Merge class names with clsx.
 * Use for combining CVA variants with additional classes.
 */
export function cn(...inputs: ClassValue[]) {
	return clsx(inputs);
}
