import type { DeskFileType } from '$lib/types/db-enums';

/**
 * One panel's context as the desk sends it (`DeskRequestSchema.panelContext`): the text the
 * model reads plus the identity of what it describes — the panel, the file, its saved version,
 * whether the panel holds unsaved edits — and whether the text was cut to the entry cap.
 */
export interface PanelContextEntry {
	panelId?: string;
	panelType: string;
	label: string;
	content: string;
	status?: string;
	contentLevel?: string;
	tokenEstimate?: number;
	truncated?: boolean;
	fileId?: string;
	fileType?: DeskFileType;
	version?: number;
	dirty?: boolean;
}
