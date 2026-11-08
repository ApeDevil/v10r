/** A vocabulary id as words: `under-100ms` → "under 100ms", `server-request` → "server request". */
export function humanize(id: string): string {
	return id.replace(/-/g, ' ');
}
