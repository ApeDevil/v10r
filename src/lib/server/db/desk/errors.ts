/**
 * DESK FOLDER DOMAIN ERRORS — re-exports from the shared folder-tree module.
 *
 * The typed errors and PG-violation detection live in `$lib/server/db/shared/folder-tree.ts`
 * so blog post/asset folders and desk folders share one error vocabulary. This
 * barrel re-exports them under the desk domain for local imports.
 */
export {
	FolderCycleError,
	FolderNameConflictError,
	FolderNotEmptyError,
	FolderNotFoundError,
	isUniqueViolation,
	PG_UNIQUE_VIOLATION,
} from '../shared/folder-tree';
