/** The Khronos glTF validator ships no types; this is the slice the export tests read. */
declare module 'gltf-validator' {
	interface ValidationReport {
		issues: { numErrors: number; numWarnings: number; messages: { code: string; message: string; severity: number }[] };
		info: { totalTriangleCount: number };
	}
	export function validateBytes(data: Uint8Array, options?: Record<string, unknown>): Promise<ValidationReport>;
}
