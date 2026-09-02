/** Outcome of ingesting an uploaded image WITHOUT persistence (no DB row). */
export interface EphemeralUpload {
	imageId: string;
	storageKey: string;
	width: number;
	height: number;
	fileSize: number;
}
