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

/**
 * The freshness key of a derived output: `hash(transform, ...inputs)`, stored beside the
 * output. The output is current exactly while a recomputed key matches the stored one.
 *
 * `transform` names the producing code and its version (`'docs-ingest@1'`), which is what a
 * content hash alone cannot see: a chunker change leaves every input byte identical and every
 * stored chunk stale. Inputs are positional — callers pass them in a fixed order — and the
 * JSON encoding keeps `['ab', 'c']` distinct from `['a', 'bc']`. Anything that changes the
 * output must be an input or covered by the transform version; an undeclared input is the
 * one way this key lies.
 */
export function derivationKey(transform: string, inputs: readonly string[]): Promise<string> {
	return contentHash(JSON.stringify([transform, ...inputs]));
}
