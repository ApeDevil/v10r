/**
 * DESK FOLDER DOMAIN ERRORS — re-exports from the shared folder-tree module.
 *
 * The typed errors and PG-violation detection live in `$lib/server/db/shared/folder-tree.ts`
 * so blog post/asset folders and desk folders share one error vocabulary. Keep this
 * barrel for legacy import paths within the desk domain.
 */
export {
	FolderCycleError,
	FolderNameConflictError,
	FolderNotEmptyError,
	FolderNotFoundError,
	PG_UNIQUE_VIOLATION,
	isUniqueViolation,
} from '../shared/folder-tree';
