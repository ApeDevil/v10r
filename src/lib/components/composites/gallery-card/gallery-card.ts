export interface GalleryCardItem {
	/** Main image URL. Animated formats (GIF / animated SVG / animated WebP) work since it renders <img>. */
	src: string;
	/** Required accessible alt text for the main image. */
	alt: string;
	/** Optional separate thumbnail URL. Defaults to `src`. */
	thumb?: string;
	/** Optional per-item title — shown only when `syncText` is true. */
	title?: string;
	/** Optional per-item text — shown only when `syncText` is true. */
	text?: string;
}

export interface GalleryCardCta {
	label: string;
	href?: string;
	onclick?: () => void;
}
