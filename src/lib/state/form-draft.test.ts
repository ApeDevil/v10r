import { describe, expect, it } from 'vitest';
import { createFormDraftStore, draftDiffers, formDraftKey, isSensitiveField } from './form-draft';

/** A Storage double; `full` makes every write throw like a quota error. */
function memoryStorage(full = false): Storage {
	const map = new Map<string, string>();
	return {
		get length() {
			return map.size;
		},
		clear: () => map.clear(),
		getItem: (k) => map.get(k) ?? null,
		key: (i) => [...map.keys()][i] ?? null,
		removeItem: (k) => void map.delete(k),
		setItem: (k, v) => {
			if (full) throw new DOMException('quota', 'QuotaExceededError');
			map.set(k, v);
		},
	};
}

const template = { subject: '', message: '', password: '', apiToken: '', count: 0, agree: false, tags: [] as string[] };
type Form = typeof template;

function store(storage: Storage, overrides: Partial<Parameters<typeof createFormDraftStore<Form>>[0]> = {}) {
	return createFormDraftStore<Form>({
		formId: 'contact',
		owner: 'usr_1',
		template,
		storage: () => storage,
		now: () => 1_700_000_000_000,
		...overrides,
	});
}

describe('form drafts', () => {
	it('keys drafts per user and form, with anonymous forms apart', () => {
		expect(formDraftKey('contact', 'usr_1')).toBe('v10r:form-draft:usr_1:contact');
		expect(formDraftKey('contact', null)).toBe('v10r:form-draft:anon:contact');
	});

	it('round-trips what the person typed', () => {
		const s = store(memoryStorage());
		expect(s.write({ ...template, subject: 'Hi', message: 'Long text', count: 3, agree: true, tags: ['a'] })).toBe(
			true,
		);
		expect(s.read()).toEqual({
			savedAt: 1_700_000_000_000,
			data: { subject: 'Hi', message: 'Long text', count: 3, agree: true, tags: ['a'] },
		});
	});

	it('never stores credential-like fields or excluded ones', () => {
		const storage = memoryStorage();
		const s = store(storage, { exclude: ['message'] });
		s.write({ ...template, subject: 'Hi', message: 'skip me', password: 'hunter2', apiToken: 'tok_123' });
		const raw = storage.getItem(formDraftKey('contact', 'usr_1')) ?? '';
		expect(raw).not.toContain('hunter2');
		expect(raw).not.toContain('tok_123');
		expect(raw).not.toContain('skip me');
		expect(s.read()?.data).toEqual({ subject: 'Hi', count: 0, agree: false, tags: [] });
	});

	it('recognises credential fields by word, in camelCase, snake_case and kebab-case', () => {
		const secret = [
			'password',
			'newPassword',
			'newpassword',
			'pinCode',
			'pin_code',
			'apiKey',
			'api_key',
			'privateKey',
			'pwd',
			'newPwd',
			'mfaCode',
			'verificationCode',
			'recoveryCode',
			'credential',
			'authKey',
			'accountNumber',
			'card-number',
			'cvv',
			'iban',
			'otp',
			'clientSecret',
			'accessToken',
		];
		const plain = ['subject', 'message', 'name', 'email', 'bio', 'keyword', 'author', 'spinner', 'tags'];
		expect(secret.filter((n) => !isSensitiveField(n))).toEqual([]);
		expect(plain.filter((n) => isSensitiveField(n))).toEqual([]);
	});

	it('another account on the same browser sees no draft', () => {
		const storage = memoryStorage();
		store(storage).write({ ...template, subject: 'mine' });
		expect(store(storage, { owner: 'usr_2' }).read()).toBeNull();
	});

	it('drops a draft of another form version, unknown fields and values of the wrong type', () => {
		const storage = memoryStorage();
		const key = formDraftKey('contact', 'usr_1');
		storage.setItem(key, JSON.stringify({ v: 1, savedAt: 5, data: { subject: 42, message: 'ok', evil: '<x>' } }));
		expect(store(storage).read()).toEqual({ savedAt: 5, data: { message: 'ok' } });
		expect(store(storage, { version: 2 }).read()).toBeNull();
		storage.setItem(key, '{not json');
		expect(store(storage).read()).toBeNull();
		storage.setItem(key, JSON.stringify({ v: 1, savedAt: 5, data: { password: 'x' } }));
		expect(store(storage).read()).toBeNull();
	});

	it('reports a refused write and survives storage that is missing or throws', () => {
		expect(store(memoryStorage(true)).write(template)).toBe(false);
		const missing = store(memoryStorage(), { storage: () => null });
		expect(missing.write(template)).toBe(false);
		expect(missing.read()).toBeNull();
		const throwing = store(memoryStorage(), {
			storage: () => {
				throw new Error('SecurityError');
			},
		});
		expect(throwing.read()).toBeNull();
		expect(() => throwing.clear()).not.toThrow();
	});

	it('clears', () => {
		const s = store(memoryStorage());
		s.write({ ...template, subject: 'x' });
		s.clear();
		expect(s.read()).toBeNull();
	});

	it('offers a draft only when it would change the form', () => {
		expect(draftDiffers({ subject: 'a' }, { ...template, subject: 'a' })).toBe(false);
		expect(draftDiffers({ subject: 'a' }, template)).toBe(true);
		expect(draftDiffers({ tags: ['x'] }, template)).toBe(true);
	});
});
