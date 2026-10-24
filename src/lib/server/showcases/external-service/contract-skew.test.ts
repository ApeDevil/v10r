import { describe, expect, it } from 'vitest';
import { contractSkew } from './contract-skew';

describe('contractSkew', () => {
	it.each([
		// service, app, skew
		['0.1.1', '0.1.1', 'none'],
		['0.1.0', '0.1.1', 'none'], // a patch never changes the contract
		['0.2.0', '0.1.1', 'breaking'], // in 0.x a minor bump may break
		['1.4.2', '1.4.0', 'none'],
		['1.5.0', '1.4.0', 'service_ahead'], // additive: the app ignores what it does not know
		['1.3.9', '1.4.0', 'service_behind'], // the app expects what the service lacks
		['2.0.0', '1.9.0', 'breaking'],
		['1.0.0', '0.9.0', 'breaking'],
		['1.4.0-rc.1', '1.4.0', 'unknown'],
		['', '1.4.0', 'unknown'],
	])('service %s vs app %s → %s', (service, app, skew) => {
		expect(contractSkew(service, app)).toBe(skew);
	});
});
