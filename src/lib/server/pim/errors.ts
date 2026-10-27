import { ServerError } from '#lib/server/errors/index.ts';

/**
 * Why product data was refused. `unreadable_sheet`: the file is not a table a person could
 * check row by row (no header, a nameless column holding values, a repeated header).
 * `invalid_recipe`: a recipe names a column that will not exist when its op runs, or is not
 * a recipe at all — it is refused whole, before any row is touched.
 */
export type ProductDataErrorKind = 'unreadable_sheet' | 'invalid_recipe';

export class ProductDataError extends ServerError {
	constructor(
		public override readonly kind: ProductDataErrorKind,
		message: string,
	) {
		super(kind, message);
		this.name = 'ProductDataError';
	}

	/** Both kinds are a problem with what the caller handed in. */
	override toStatus(): number {
		return 422;
	}
}
