/** The Studio's notice codes, resolved to the current locale's copy. */
import * as m from '#lib/paraglide/messages.js';

const NOTICES: Record<string, () => string> = {
	transferred: m.studio_notice_transferred,
	saved: m.studio_notice_saved,
	'save-unavailable': m.studio_notice_save_unavailable,
	'save-quota': m.studio_notice_save_quota,
	'open-missing': m.studio_notice_open_missing,
	'open-corrupt': m.studio_notice_open_corrupt,
	'working-corrupt': m.studio_notice_working_corrupt,
	'variant-created': m.studio_notice_variant_created,
	'import-invalid': m.studio_notice_import_invalid,
	imported: m.studio_notice_imported,
	'example-loaded': m.studio_notice_example_loaded,
};

export function noticeText(code: string): string {
	return (NOTICES[code] ?? m.studio_notice_unknown)();
}
