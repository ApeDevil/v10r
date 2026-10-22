/**
 * Plain-language reasons for the composition core's diagnostic codes. The core speaks in
 * codes so every surface can word them for its own audience; this is the showcase's wording.
 */
import * as m from '$lib/paraglide/messages';
import type { CompositionDiagnostic, DiagnosticCode, PortMismatch } from '$lib/product-composition';

const REASONS: Record<Exclude<DiagnosticCode, 'port.incompatible'>, () => string> = {
	'definition.missing': m.showcase_3d_compose_diagnostic_definition_missing,
	'composition.recursive': m.showcase_3d_compose_diagnostic_composition_recursive,
	'coupling.unresolved': m.showcase_3d_compose_diagnostic_coupling_unresolved,
	'coupling.self': m.showcase_3d_compose_diagnostic_coupling_self,
	'coupling.duplicate': m.showcase_3d_compose_diagnostic_coupling_duplicate,
	'port.capacity': m.showcase_3d_compose_diagnostic_port_capacity,
	'port.open': m.showcase_3d_compose_diagnostic_port_open,
	'mate.misaligned': m.showcase_3d_compose_diagnostic_mate_misaligned,
	'conduit.unresolved': m.showcase_3d_compose_diagnostic_conduit_unresolved,
	'conduit.mode': m.showcase_3d_compose_diagnostic_conduit_mode,
	'conduit.duplicate': m.showcase_3d_compose_diagnostic_conduit_duplicate,
	'passage.unresolved': m.showcase_3d_compose_diagnostic_passage_unresolved,
	'passage.self': m.showcase_3d_compose_diagnostic_passage_self,
	'exposed-port.unresolved': m.showcase_3d_compose_diagnostic_exposed_port_unresolved,
	'exposed-port.shared': m.showcase_3d_compose_diagnostic_exposed_port_shared,
	'id.duplicate': m.showcase_3d_compose_diagnostic_id_duplicate,
	'occurrence.unresolved': m.showcase_3d_compose_diagnostic_occurrence_unresolved,
	'waypoint.unresolved': m.showcase_3d_compose_diagnostic_waypoint_unresolved,
};

export function mismatchText(mismatch: PortMismatch): string {
	switch (mismatch.code) {
		case 'standard.unknown':
			return m.showcase_3d_compose_mismatch_standard_unknown();
		case 'standard.mismatch':
			return m.showcase_3d_compose_mismatch_standard();
		case 'gender.mismatch':
			return m.showcase_3d_compose_mismatch_gender();
		case 'direction.mismatch':
			return m.showcase_3d_compose_mismatch_direction();
		case 'parameter.mismatch':
			return m.showcase_3d_compose_mismatch_parameter({ parameter: mismatch.parameter ?? '' });
	}
}

export function diagnosticText(diagnostic: CompositionDiagnostic): string {
	if (diagnostic.code === 'port.incompatible') {
		const reasons = (diagnostic.mismatches ?? []).map(mismatchText).join('; ');
		return m.showcase_3d_compose_diagnostic_port_incompatible({ reasons });
	}
	return REASONS[diagnostic.code]();
}
