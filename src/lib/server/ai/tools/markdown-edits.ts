/**
 * The targeted-edit contract `desk_edit_markdown` shares between the gated tool (which
 * checks it against the current document to give the model early feedback) and the replay
 * door (which applies it): each `find` must occur EXACTLY once in the document as it stands
 * when the edit is applied. Zero matches means the model quoted text that is not there;
 * two means the edit is ambiguous — both refuse the whole batch, so nothing is half-edited.
 */
export interface MarkdownEdit {
	find: string;
	replace: string;
}

export function applyMarkdownEdits(
	content: string,
	edits: readonly MarkdownEdit[],
): { content: string } | { error: string } {
	let next = content;
	for (const [index, edit] of edits.entries()) {
		const first = next.indexOf(edit.find);
		if (first === -1) {
			return {
				error: `Edit ${index + 1}: the text to find does not occur in the document. Read it again and quote it exactly.`,
			};
		}
		if (next.indexOf(edit.find, first + 1) !== -1) {
			return {
				error: `Edit ${index + 1}: the text to find occurs more than once. Include more surrounding text so it is unique.`,
			};
		}
		next = `${next.slice(0, first)}${edit.replace}${next.slice(first + edit.find.length)}`;
	}
	return { content: next };
}
