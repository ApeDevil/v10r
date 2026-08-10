/**
 * Public surface of the file-as-source content module.
 * Cross-domain primitives for content/<domain>/<slug>/{en,de,ru}.md → DB sync.
 */

export { getPreviewDrift } from './drift';
export {
	FrontmatterError,
	localeFromFilename,
	type ParsedContentFile,
	parseContentFile,
	serializeContentFile,
} from './frontmatter';
export { contentHash } from './hash';
export {
	findOrphanedSourcePaths,
	getSystemAuthor,
	listContentSlugs,
	loadPost,
	type PushOptions,
	pushPost,
	summarizeActions,
} from './push';
export * from './types';
