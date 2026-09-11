/**
 * The one `content_hash` — SHA-256 hex of the text, as `blog.revision`,
 * `retrieval.document` and `retrieval.chunk` store it.
 *
 * Blog revision idempotency, the retrieval re-ingest skip gate and `content:push` /
 * `content:check` drift detection all compare these values across tables, so one
 * function has to produce all of them: three private copies agreed only by accident.
 *
 * Dependency-free on purpose — `retrieval/plan.ts` reaches it by relative path so the
 * standalone docs-ingest script can run under bare Bun.
 */
export async function contentHash(markdown: string): Promise<string> {
	const encoded = new TextEncoder().encode(markdown);
	const buffer = await crypto.subtle.digest('SHA-256', encoded);
	const bytes = new Uint8Array(buffer);
	return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
