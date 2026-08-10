import { describe, expect, it } from 'vitest';
import { escapeHtml } from './providers/email';
import { DIGEST_BODY_LIMITS, type DigestItem, renderDigest, renderNotification } from './render-message';

const item = (messageKey: string): DigestItem => ({ messageKey, messageParams: {} });

describe('renderNotification', () => {
	it('renders in the requested locale', () => {
		expect(renderNotification('notif_mention', {}, 'de')).not.toBe(renderNotification('notif_mention', {}, 'en'));
	});

	it('surfaces an unknown key rather than rendering empty', () => {
		expect(renderNotification('notif_does_not_exist', {}, 'en')).toBe('notif_does_not_exist');
	});
});

describe('renderDigest', () => {
	it('subjects the count and lists one bullet per item', () => {
		const { subject, body } = renderDigest([item('notif_mention'), item('notif_comment')], 'en');
		expect(subject).toContain('2');
		expect(body.split('•')).toHaveLength(3); // intro + 2 items
	});

	it('renders in the recipient locale', () => {
		const en = renderDigest([item('notif_mention')], 'en');
		const de = renderDigest([item('notif_mention')], 'de');
		expect(de.subject).not.toBe(en.subject);
		expect(de.body).not.toBe(en.body);
	});

	it('REPORTS overflow rather than silently truncating', () => {
		const many = Array.from({ length: 50 }, () => item('notif_mention'));
		const { body } = renderDigest(many, 'en', 200);
		expect(body).toMatch(/\+\d+ more/);
		expect(body.length).toBeLessThanOrEqual(200);
	});

	it('respects the per-channel budget', () => {
		const many = Array.from({ length: 400 }, () => item('notif_mention'));
		const tg = renderDigest(many, 'en', DIGEST_BODY_LIMITS.telegram);
		const dc = renderDigest(many, 'en', DIGEST_BODY_LIMITS.discord);
		// Telegram caps at 4096 and Discord lower — exceeding either is a REJECTED
		// send, not a truncated one, so these must hold hard.
		expect(tg.body.length).toBeLessThanOrEqual(DIGEST_BODY_LIMITS.telegram);
		expect(dc.body.length).toBeLessThanOrEqual(DIGEST_BODY_LIMITS.discord);
		expect(dc.body.length).toBeLessThan(tg.body.length);
	});

	it('a single item needs no overflow marker', () => {
		expect(renderDigest([item('notif_mention')], 'en').body).not.toMatch(/more/);
	});
});

describe('escapeHtml', () => {
	// `notif_custom` is literally "{text}" and carries free user input, so an
	// unescaped body was an HTML injection into every recipient's inbox.
	it('neutralises markup', () => {
		expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
	});

	it('escapes ampersands first so entities are not double-broken', () => {
		expect(escapeHtml('&lt;')).toBe('&amp;lt;');
	});

	it('escapes quotes for attribute contexts', () => {
		expect(escapeHtml(`"x" 'y'`)).toBe('&quot;x&quot; &#39;y&#39;');
	});
});
