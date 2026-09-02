import type { DeskFileType, PostStatus } from '$lib/types/db-enums';
export interface AssetListItem {
	id: string;
	fileName: string;
	mimeType: string;
	fileSize: number;
	storageKey: string;
	altText: string | null;
	width: number | null;
	height: number | null;
	folderId: string | null;
	createdAt: string;
	downloadUrl: string | null;
}

export interface ExplorerPostItem {
	id: string;
	slug: string;
	status: PostStatus;
	title: string;
	folderId: string | null;
	updatedAt: string;
}

export interface UploadingItem {
	id: string;
	fileName: string;
	status: 'uploading' | 'error';
	error?: string;
}

/** Unified file entry from desk.file API. */
export interface FileListItem {
	id: string;
	type: DeskFileType;
	name: string;
	folderId: string | null;
	aiContext: boolean;
	createdAt: string;
	updatedAt: string;
}

/** Folder entry from desk.folder API. */
export interface FolderListItem {
	id: string;
	parentId: string | null;
	name: string;
	createdAt: string;
	updatedAt: string;
}
