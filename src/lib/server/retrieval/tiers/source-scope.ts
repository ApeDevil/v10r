/**
 * The corpus boundary inside a tenant, as a chunk predicate. `chunk` carries no `source`
 * column, so the scope is a semi-join on the LIMITed vector walk's own filter list: the
 * documents of that source, alive. Empty when no source was asked for — the chatbot's
 * queries keep their exact shape (and plan), only the deskbot pays the subquery.
 */
import { type SQL, sql } from 'drizzle-orm';
import type { DocumentSource } from '../types';

export function sourceScope(userId: string, source: DocumentSource | undefined): SQL {
	if (!source) return sql``;
	return sql`AND c.document_id IN (
		SELECT d.id FROM retrieval.document d
		WHERE d.user_id = ${userId} AND d.source = ${source} AND d.deleted_at IS NULL
	)`;
}
