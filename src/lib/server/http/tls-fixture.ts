/**
 * A throwaway self-signed TLS certificate for one host name — test fixture for the pinned fetch
 * and the MCP client's TLS path. Made with the `openssl` CLI for each run (nothing committed);
 * null when `openssl` is not installed, so a suite can skip rather than fail.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function selfSignedCertificate(name: string): { key: string; cert: string } | null {
	const dir = mkdtempSync(join(tmpdir(), 'v10r-tls-'));
	try {
		execFileSync(
			'openssl',
			[
				'req',
				'-x509',
				'-newkey',
				'ec',
				'-pkeyopt',
				'ec_paramgen_curve:prime256v1',
				'-nodes',
				'-keyout',
				join(dir, 'key.pem'),
				'-out',
				join(dir, 'cert.pem'),
				'-days',
				'1',
				'-subj',
				`/CN=${name}`,
				'-addext',
				`subjectAltName=DNS:${name}`,
			],
			{ stdio: 'ignore' },
		);
		return { key: readFileSync(join(dir, 'key.pem'), 'utf8'), cert: readFileSync(join(dir, 'cert.pem'), 'utf8') };
	} catch {
		return null;
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}
