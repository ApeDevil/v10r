export interface AssetListItem {
	id: string;
	fileName: string;
	mimeType: string;
	fileSize: number;
	storageKey: string;
	altText: string | null;
	width: number | null;
	height: number | null;
	createdAt: string;
	downloadUrl: string | null;
}

export interface PostListItem {
	id: string;
	slug: string;
	status: 'draft' | 'published' | 'archived';
	title: string;
	updatedAt: string;
}

export interface UploadingItem {
	id: string;
	fileName: string;
	status: 'uploading' | 'error';
	error?: string;
}
