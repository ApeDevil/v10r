/** Core types for the R2 object store layer. */

export interface ObjectInfo {
	key: string;
	size: number;
	lastModified: Date;
	etag: string;
	contentType?: string;
}

export interface ObjectDetail extends ObjectInfo {
	metadata: Record<string, string>;
	cacheControl?: string;
	contentEncoding?: string;
}

export interface BucketStats {
	objectCount: number;
	totalSize: number;
}

export interface PresignedUrlResult {
	url: string;
	expiresIn: number;
	expiresAt: string;
}

export interface UploadResult {
	key: string;
	etag: string;
	size: number;
	contentType: string;
}

export interface RangeResult {
	data: Uint8Array;
	contentRange: string;
	contentLength: number;
}

/** Format bytes into a human-readable string. */
export function formatBytes(bytes: number): string {
	if (bytes === 0) return '0 B';
	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	const i = Math.floor(Math.log(bytes) / Math.log(1024));
	const value = bytes / 1024 ** i;
	return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
