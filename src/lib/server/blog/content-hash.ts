/** Compute SHA-256 hash of markdown content. Used as RAG re-ingest skip gate. */
export async function contentHash(markdown: string): Promise<string> {
	const encoded = new TextEncoder().encode(markdown);
	const buffer = await crypto.subtle.digest('SHA-256', encoded);
	const bytes = new Uint8Array(buffer);
	return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
