import { describe, expect, it } from 'vitest';
import {
	callbackFormActionSource,
	classifyCallbackDestination,
	matchesRegisteredRedirectUri,
	permitFormActionSource,
} from './callback-destination';

const SITE = 'https://www.v10r.dev';
const CHATGPT = 'https://chatgpt.com/connector_platform_oauth_redirect';
const context = (
	signedRedirectUri: string | null,
	registered: string[] = signedRedirectUri ? [signedRedirectUri] : [],
) => ({
	siteOrigin: SITE,
	signedRedirectUri,
	registeredRedirectUris: registered,
});

describe('classifyCallbackDestination', () => {
	it('follows the signed, registered callback and permits only it', () => {
		const location = `${CHATGPT}?code=abc&state=s&iss=${encodeURIComponent(`${SITE}/api/auth`)}`;
		expect(classifyCallbackDestination(location, context(CHATGPT))).toEqual({
			kind: 'callback',
			location,
			callbackUri: CHATGPT,
		});
	});

	it('keeps answers on this site local (the authorization server error page)', () => {
		expect(classifyCallbackDestination(`${SITE}/api/auth/error?error=x`, context(null))).toEqual({
			kind: 'local',
			location: '/api/auth/error?error=x',
		});
	});

	it('refuses a callback that is not the signed one, or not registered', () => {
		expect(classifyCallbackDestination('https://evil.example/cb?code=a', context(CHATGPT)).kind).toBe('refused');
		expect(classifyCallbackDestination(`${CHATGPT}/other?code=a`, context(CHATGPT)).kind).toBe('refused');
		expect(classifyCallbackDestination(`${CHATGPT}?code=a`, context(CHATGPT, ['https://chatgpt.com/x'])).kind).toBe(
			'refused',
		);
		expect(classifyCallbackDestination(`${CHATGPT}?code=a`, context(null)).kind).toBe('refused');
	});

	it('refuses executable schemes and credentials in the URL', () => {
		expect(classifyCallbackDestination('javascript:alert(1)', context('javascript:alert(1)')).kind).toBe('refused');
		expect(classifyCallbackDestination('https://user:pw@chatgpt.com/cb', context('https://chatgpt.com/cb')).kind).toBe(
			'refused',
		);
	});

	it('accepts a native app scheme and a loopback callback on its own port', () => {
		const app = 'cursor://anysphere.cursor-retrieval/oauth/callback';
		expect(classifyCallbackDestination(`${app}?code=a`, context(app)).kind).toBe('callback');
		const loopback = 'http://127.0.0.1:50123/callback';
		expect(
			classifyCallbackDestination(`${loopback}?code=a`, context(loopback, ['http://127.0.0.1/callback'])).kind,
		).toBe('callback');
	});
});

describe('matchesRegisteredRedirectUri', () => {
	it('lets only loopback HTTP vary its port', () => {
		expect(matchesRegisteredRedirectUri(['http://127.0.0.1:1/cb'], 'http://127.0.0.1:2/cb')).toBe(true);
		expect(matchesRegisteredRedirectUri(['https://a.example:1/cb'], 'https://a.example:2/cb')).toBe(false);
		expect(matchesRegisteredRedirectUri(['http://127.0.0.1:1/cb'], 'http://127.0.0.1:2/other')).toBe(false);
	});
});

describe('form-action', () => {
	it('derives a safe source and adds it to the directive once', () => {
		expect(callbackFormActionSource(CHATGPT)).toBe('https://chatgpt.com');
		expect(callbackFormActionSource('http://127.0.0.1:33418/callback')).toBe('http://127.0.0.1:33418');
		expect(callbackFormActionSource('cursor://x/cb')).toBe('cursor:');
		expect(callbackFormActionSource('javascript:alert(1)')).toBeNull();
		const policy = "default-src 'self'; form-action 'self'";
		const once = permitFormActionSource(policy, 'https://chatgpt.com');
		expect(once).toBe("default-src 'self'; form-action 'self' https://chatgpt.com");
		expect(permitFormActionSource(once, 'https://chatgpt.com')).toBe(once);
		expect(permitFormActionSource("default-src 'self'", 'https://chatgpt.com')).toBe("default-src 'self'");
	});
});
