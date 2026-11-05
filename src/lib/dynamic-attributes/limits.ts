/**
 * Resource bounds of one attribute record. Every bound is checked when a record is parsed
 * and when an operation would cross it, so the editor refuses the 201st attribute with the
 * same rule the server uses to refuse a 201-attribute upload.
 *
 * The defaults are measured, not guessed: a record at every bound at once serializes under
 * `recordBytes`, parses in about a millisecond and renders without virtualization (see
 * `docs/blueprint/dynamic-attributes/README.md#performance`). An application may lower a
 * bound freely; raising one past these defaults is a decision for that application's server.
 */
export interface AttributeLimits {
	/** Attributes in one record. */
	attributes: number;
	/** Characters in a label. */
	labelLength: number;
	/** Characters in a single-line text value. */
	textLength: number;
	/** Characters in a multiline text value. */
	multilineLength: number;
	/** Items in a list value. */
	listItems: number;
	/** Characters in one list item. */
	listItemLength: number;
	/** Options of one selection attribute. */
	options: number;
	/** Removed attributes kept for restoring. The oldest beyond this is forgotten. */
	removed: number;
	/** UTF-8 bytes of the serialized record. */
	recordBytes: number;
	/** Opaque JSON (an unknown kind's value or config): containers deep. */
	opaqueDepth: number;
	/** Opaque JSON: array items plus object keys. */
	opaqueEntries: number;
}

export const DEFAULT_ATTRIBUTE_LIMITS: Readonly<AttributeLimits> = Object.freeze({
	attributes: 200,
	labelLength: 120,
	textLength: 2_000,
	multilineLength: 20_000,
	listItems: 100,
	listItemLength: 500,
	options: 100,
	removed: 20,
	recordBytes: 256 * 1024,
	opaqueDepth: 6,
	opaqueEntries: 500,
});
