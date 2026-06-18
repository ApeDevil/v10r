import { ServerError } from '$lib/server/errors';

export type ImageMetaErrorKind = 'validation' | 'forbidden' | 'not_found' | 'unsupported' | 'too_large';

/** Domain error for the Image Metadata Reader. Maps to HTTP status via toStatus(). */
export class ImageMetaError extends ServerError {
	constructor(
		public readonly kind: ImageMetaErrorKind,
		message: string,
	) {
		super(kind, message);
		this.name = 'ImageMetaError';
	}

	override toStatus(): number {
		switch (this.kind) {
			case 'validation':
				return 400;
			case 'forbidden':
				return 403;
			case 'not_found':
				return 404;
			case 'unsupported':
				return 415;
			case 'too_large':
				return 413;
			default:
				return 500;
		}
	}
}
