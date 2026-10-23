/**
 * Form drafts: what a person typed, kept in the browser until they submit, so a closed tab,
 * a crash or an expired session costs nothing.
 *
 * Framework-free — `form-draft.svelte.ts` binds it to a Superforms form. Storage is injected
 * (`() => Storage | null`, like `spreadsheet-drafts.ts`), so private mode, a full quota or SSR
 * degrade to "no draft" instead of an exception.
 *
 * What a draft never holds: fields outside the form's own shape, values whose type differs
 * from the form's, and anything that looks like a credential — password, token, card number
 * and the like are dropped by name before a write, whatever the caller excluded. A draft is a
 * convenience, not a record: sign-out's `Clear-Site-Data: "storage"` erases it on purpose.
 */

/**
 * Words that mark a field a draft never stores, whatever the form says. Field names are split
 * into words first (`pinCode` → pin, code; `api_key` → api, key), so a word list matches the
 * names people actually write; over-excluding a harmless field only means it is not drafted.
 */
const SENSITIVE_WORDS = new Set([
	'password',
	'passwd',
	'passphrase',
	'pass',
	'pwd',
	'secret',
	'token',
	'otp',
	'totp',
	'mfa',
	'pin',
	'code',
	'key',
	'apikey',
	'credential',
	'credentials',
	'auth',
	'cvc',
	'cvv',
	'card',
	'iban',
	'ssn',
	'account',
	'routing',
	'private',
]);
/** Credential words that also hide inside a single lower-case word (`newpassword`). */
const SENSITIVE_INFIX = /password|passwd|secret|token|apikey|credential/;

export function isSensitiveField(name: string): boolean {
	const words = name
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
		.toLowerCase()
		.split(/[^a-z0-9]+/)
		.filter(Boolean);
	return words.some((w) => SENSITIVE_WORDS.has(w) || SENSITIVE_INFIX.test(w));
}

type DraftValue = string | number | boolean | string[];

export interface FormDraft<T> {
	savedAt: number;
	data: Partial<T>;
}

export interface FormDraftStore<T> {
	/** The stored draft, sanitised against the form's shape — or null when there is none. */
	read(): FormDraft<T> | null;
	/** Store the form's current data; false when the browser refused (quota, private mode). */
	write(data: T): boolean;
	clear(): void;
}

export interface FormDraftStoreOptions<T> {
	formId: string;
	/** The signed-in user's id, or null for a public form. Keys never cross accounts. */
	owner: string | null;
	/** The form's initial data: it fixes which fields exist and what type each one has. */
	template: T;
	/** Bump when the form's shape changes; a draft of another version is dropped. */
	version?: number;
	exclude?: readonly (keyof T & string)[];
	storage: () => Storage | null;
	now?: () => number;
}

export function formDraftKey(formId: string, owner: string | null): string {
	return `v10r:form-draft:${owner ?? 'anon'}:${formId}`;
}

function isDraftValue(value: unknown): value is DraftValue {
	return (
		typeof value === 'string' ||
		typeof value === 'boolean' ||
		(typeof value === 'number' && Number.isFinite(value)) ||
		(Array.isArray(value) && value.every((v) => typeof v === 'string'))
	);
}

/** The fields of `template` a draft may hold. */
function draftableFields<T extends object>(template: T, exclude: readonly string[]): string[] {
	return Object.entries(template)
		.filter(([name, value]) => !exclude.includes(name) && !isSensitiveField(name) && isDraftValue(value))
		.map(([name]) => name);
}

function sameKind(a: unknown, b: unknown): boolean {
	return Array.isArray(a) ? Array.isArray(b) : typeof a === typeof b;
}

/** Keep only the draftable fields of `data` that have the template's type. */
function sanitize<T extends object>(data: unknown, template: T, fields: readonly string[]): Partial<T> {
	if (typeof data !== 'object' || data === null) return {};
	const source = data as Record<string, unknown>;
	const clean: Record<string, unknown> = {};
	for (const name of fields) {
		const value = source[name];
		if (isDraftValue(value) && sameKind(value, (template as Record<string, unknown>)[name])) clean[name] = value;
	}
	return clean as Partial<T>;
}

/** True when restoring `draft` would change `current` — a draft equal to the form is no offer. */
export function draftDiffers<T extends object>(draft: Partial<T>, current: T): boolean {
	return Object.entries(draft).some(
		([name, value]) => JSON.stringify(value) !== JSON.stringify((current as Record<string, unknown>)[name]),
	);
}

export function createFormDraftStore<T extends object>(options: FormDraftStoreOptions<T>): FormDraftStore<T> {
	const key = formDraftKey(options.formId, options.owner);
	const version = options.version ?? 1;
	const fields = draftableFields(options.template, options.exclude ?? []);
	const now = options.now ?? Date.now;

	function storage(): Storage | null {
		try {
			return options.storage();
		} catch {
			return null;
		}
	}

	return {
		read() {
			let raw: string | null;
			try {
				raw = storage()?.getItem(key) ?? null;
			} catch {
				return null;
			}
			if (!raw) return null;
			let envelope: unknown;
			try {
				envelope = JSON.parse(raw);
			} catch {
				return null;
			}
			const { v, savedAt, data } = (envelope ?? {}) as { v?: unknown; savedAt?: unknown; data?: unknown };
			if (v !== version || typeof savedAt !== 'number') return null;
			const clean = sanitize(data, options.template, fields);
			return Object.keys(clean).length > 0 ? { savedAt, data: clean } : null;
		},

		write(data) {
			const target = storage();
			if (!target) return false;
			try {
				target.setItem(
					key,
					JSON.stringify({ v: version, savedAt: now(), data: sanitize(data, options.template, fields) }),
				);
				return true;
			} catch {
				return false;
			}
		},

		clear() {
			try {
				storage()?.removeItem(key);
			} catch {
				// Nothing to clear if storage is gone.
			}
		},
	};
}
