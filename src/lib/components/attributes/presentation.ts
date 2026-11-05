/**
 * Words and lazy loading for the editor. Kept apart from the components so the mapping from a
 * finding or refusal code to its sentence has one home, and tests can read it without a DOM.
 */
import type { AttributeDiagnosticCode, AttributeRefusalCode } from '#lib/dynamic-attributes/index.ts';
import * as m from '#lib/paraglide/messages.js';
import type { AttributeControl, AttributeControlComponent } from './controls.ts';

/** The sentence a row shows for a soft finding; null for findings shown elsewhere. */
export function findingMessage(code: AttributeDiagnosticCode): string | null {
	switch (code) {
		case 'duplicate_label':
			return m.attributes_finding_duplicate_label();
		case 'below_min':
			return m.attributes_finding_below_min();
		case 'above_max':
			return m.attributes_finding_above_max();
		case 'not_integer':
			return m.attributes_finding_not_integer();
		case 'unknown_option':
			return m.attributes_finding_unknown_option();
		// Shown by the row itself (placeholder, unknown-kind notice, previous-value notice).
		case 'empty_label':
		case 'unknown_kind':
		case 'previous_value':
			return null;
	}
}

/** Why an action did not happen, announced in the editor's live region. */
export function refusalMessage(code: AttributeRefusalCode): string {
	switch (code) {
		case 'too_many_attributes':
			return m.attributes_refusal_too_many();
		case 'too_large':
			return m.attributes_refusal_too_large();
		case 'invalid_label':
			return m.attributes_refusal_invalid_label();
		case 'invalid_value':
			return m.attributes_refusal_invalid_value();
		case 'unknown_kind':
			return m.attributes_refusal_unknown_kind();
		default:
			return m.attributes_refusal_generic();
	}
}

const loaded = new Map<AttributeControl, Promise<AttributeControlComponent>>();

/** Import a lazy control once, however many rows show it. */
export function loadControl(control: AttributeControl): Promise<AttributeControlComponent> {
	let promise = loaded.get(control);
	if (!promise) {
		promise = (control.load as NonNullable<AttributeControl['load']>)().then((module) => module.default);
		loaded.set(control, promise);
	}
	return promise;
}
