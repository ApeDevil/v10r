/**
 * The admin page's presenter: the source-connection cards' copy, resolved once per
 * request on the server, for the same reason `labels.ts` does it for the showcase — a
 * Paraglide message called from a `.svelte` ships all three locales to the browser, and
 * the client-JS ratchet has no room for a dictionary the page never needs. `load` returns
 * the maps; the actions return their own sentences; the page renders strings.
 */
import * as m from '$lib/paraglide/messages';
import type { KeyStatus } from '$lib/server/security';
import type { NameSourceVendor } from '$lib/types/db-enums';
import type { NameSourceTestOutcome } from './connection';

export const NAME_SOURCE_CONNECTION_COPY_KEYS = [
	'title',
	'intro',
	'unavailable_title',
	'unavailable_body',
	'degraded_title',
	'degraded_body',
	'encryption_missing',
	'none_connected',
	'enabled',
	'client_id_label',
	'client_id_hint',
	'client_secret_label',
	'api_key_label',
	'secret_hint_keep',
	'api_base_label',
	'token_url_label',
	'hosts_hint',
	'status_configured',
	'status_not_configured',
	'save',
	'saving',
	'test',
	'testing',
	'remove_secret',
	'remove_secret_confirm_title',
	'test_target_draft',
	'test_target_saved',
	'test_note',
	'saved_at',
	'web_order_note',
] as const;
export type NameSourceConnectionCopyKey = (typeof NAME_SOURCE_CONNECTION_COPY_KEYS)[number];

export interface NameSourceConnectionLabels {
	/** Static page copy, keyed by the message name minus its `admin_name_check_` prefix. */
	copy: Record<NameSourceConnectionCopyKey, string>;
	keyStatuses: Record<KeyStatus, string>;
	testOutcomes: Record<NameSourceTestOutcome, string>;
	vendorNotes: Record<NameSourceVendor, string>;
	/** The remove-secret confirmation, with the vendor's name already in it. */
	removeConfirm: Record<NameSourceVendor, string>;
}

/** Resolve every map in the current request's locale. `vendorNames` are the proper nouns the cards carry. */
export function nameSourceConnectionLabels(vendorNames: Record<NameSourceVendor, string>): NameSourceConnectionLabels {
	return {
		copy: {
			title: m.admin_name_check_title(),
			intro: m.admin_name_check_intro(),
			unavailable_title: m.admin_name_check_unavailable_title(),
			unavailable_body: m.admin_name_check_unavailable_body(),
			degraded_title: m.admin_name_check_degraded_title(),
			degraded_body: m.admin_name_check_degraded_body(),
			encryption_missing: m.admin_name_check_encryption_missing(),
			none_connected: m.admin_name_check_none_connected(),
			enabled: m.admin_name_check_enabled(),
			client_id_label: m.admin_name_check_client_id_label(),
			client_id_hint: m.admin_name_check_client_id_hint(),
			client_secret_label: m.admin_name_check_client_secret_label(),
			api_key_label: m.admin_name_check_api_key_label(),
			secret_hint_keep: m.admin_name_check_secret_hint_keep(),
			api_base_label: m.admin_name_check_api_base_label(),
			token_url_label: m.admin_name_check_token_url_label(),
			hosts_hint: m.admin_name_check_hosts_hint(),
			status_configured: m.admin_name_check_status_configured(),
			status_not_configured: m.admin_name_check_status_not_configured(),
			save: m.admin_name_check_save(),
			saving: m.admin_name_check_saving(),
			test: m.admin_name_check_test(),
			testing: m.admin_name_check_testing(),
			remove_secret: m.admin_name_check_remove_secret(),
			remove_secret_confirm_title: m.admin_name_check_remove_secret_confirm_title(),
			test_target_draft: m.admin_name_check_test_target_draft(),
			test_target_saved: m.admin_name_check_test_target_saved(),
			test_note: m.admin_name_check_test_note(),
			saved_at: m.admin_name_check_saved_at(),
			web_order_note: m.admin_name_check_web_order_note(),
		},
		keyStatuses: {
			none: m.admin_name_check_key_missing(),
			ready: m.admin_name_check_key_stored(),
			undecryptable: m.admin_name_check_key_undecryptable(),
		},
		testOutcomes: {
			ok: m.admin_name_check_test_result_ok(),
			invalid_credentials: m.admin_name_check_test_result_invalid_credentials(),
			rate_limited: m.admin_name_check_test_result_rate_limited(),
			timeout: m.admin_name_check_test_result_timeout(),
			unavailable: m.admin_name_check_test_result_unavailable(),
			unknown: m.admin_name_check_test_result_unknown(),
		},
		vendorNotes: {
			euipo: m.admin_name_check_vendor_note_euipo(),
			tavily: m.admin_name_check_vendor_note_tavily(),
			brave: m.admin_name_check_vendor_note_brave(),
		},
		removeConfirm: {
			euipo: m.admin_name_check_remove_secret_confirm_body({ name: vendorNames.euipo }),
			tavily: m.admin_name_check_remove_secret_confirm_body({ name: vendorNames.tavily }),
			brave: m.admin_name_check_remove_secret_confirm_body({ name: vendorNames.brave }),
		},
	};
}
