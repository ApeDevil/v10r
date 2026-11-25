/**
 * What one external call discloses, and the check that it discloses nothing more.
 *
 * Risk and disclosure are two different questions. Risk (`projection.ts`) is "can this call
 * change something?" — an operator's read-only tool runs unattended. Disclosure is "what leaves
 * the deployment?" — and an external `read` discloses exactly as much as a `write`: its
 * arguments, to a third party, under the deployment's credential for that peer. So every call,
 * read or write, passes `preparePeerArguments` before a byte is sent:
 *
 *  - the arguments are the MODEL-SUPPLIED object of this one call, nothing else — no
 *    conversation, document, desk content, session or user token is ever added (there is no
 *    parameter that could add one);
 *  - they are plain JSON (canonicalized; the canonical text is what is hashed, sized and sent);
 *  - they conform to the tool's advertised `inputSchema` (the SDK's own validator; a schema the
 *    validator cannot compile proves nothing, so the call is refused);
 *  - they fit the peer's `maxArgumentBytes`;
 *  - every top-level field is one the operator allowed for the tool (`argumentFields`), when set;
 *  - they do not contain the peer's own resolved secret (a model can only learn it from a
 *    leak; sending it back out would be the leak's second half).
 *
 * The result carries a `PeerCallDisclosure`: destination origin, what is sent, which fields,
 * how many bytes, under whose credential — data an approval card can show as it is.
 */
import { AjvJsonSchemaValidator } from '@modelcontextprotocol/client/validators/ajv';
import { canonicalJson } from '#lib/utils/canonical-json.ts';
import { DEFAULT_PEER_ARGUMENT_BYTES, MAX_PEER_ARGUMENT_BYTES } from './config';
import type { McpPeer, SecretResolver } from './peer';
import type { PeerTool } from './peer-tools';

/** Who the peer sees as the caller. Never the user: v10r holds no delegated user credential. */
export type PeerCallCredential = { kind: 'none' } | { kind: 'deployment_bearer'; secretRef: string };

/** What one call sends out, shown before it is approved and kept on its receipt. */
export interface PeerCallDisclosure {
	peerId: string;
	remoteName: string;
	/** The origin the arguments go to. */
	destination: string;
	/** The only thing v10r ever sends: this call's validated arguments. */
	sends: 'tool_arguments_only';
	/** The top-level fields sent, sorted. */
	argumentFields: string[];
	/** UTF-8 bytes of the canonical arguments. */
	argumentBytes: number;
	credential: PeerCallCredential;
}

export type DisclosureRefusal =
	| 'arguments_not_object'
	| 'arguments_not_json'
	| 'arguments_invalid'
	| 'schema_unverifiable'
	| 'arguments_too_large'
	| 'argument_field_not_allowed'
	| 'credential_in_arguments';

export type PreparedPeerArguments =
	| {
			ok: true;
			/** The arguments as they will be sent: the canonical JSON, parsed back. */
			arguments: Record<string, unknown>;
			/** The canonical JSON text — what is hashed and sized. */
			canonical: string;
			disclosure: PeerCallDisclosure;
	  }
	| { ok: false; reason: DisclosureRefusal };

const validators = new AjvJsonSchemaValidator();

/** `value` against a JSON Schema with the SDK's validator; `null` when the schema does not compile. */
export function conformsToSchema(schema: Record<string, unknown>, value: unknown): boolean | null {
	let validate: ReturnType<typeof validators.getValidator>;
	try {
		validate = validators.getValidator(schema as Parameters<typeof validators.getValidator>[0]);
	} catch {
		return null;
	}
	return validate(value).valid;
}

export function peerCallCredential(peer: McpPeer): PeerCallCredential {
	return peer.auth.kind === 'bearer' ? { kind: 'deployment_bearer', secretRef: peer.auth.secretRef } : { kind: 'none' };
}

export function peerArgumentLimit(peer: McpPeer): number {
	return Math.min(peer.disclosure?.maxArgumentBytes ?? DEFAULT_PEER_ARGUMENT_BYTES, MAX_PEER_ARGUMENT_BYTES);
}

/** Checks and canonicalizes one call's arguments; nothing is sent unless this says `ok`. */
export function preparePeerArguments(
	peer: McpPeer,
	tool: Pick<PeerTool, 'name' | 'inputSchema'>,
	args: unknown,
	resolveSecret?: SecretResolver,
): PreparedPeerArguments {
	if (args === null || typeof args !== 'object' || Array.isArray(args))
		return { ok: false, reason: 'arguments_not_object' };
	let canonical: string;
	let parsed: Record<string, unknown>;
	try {
		canonical = canonicalJson(args);
		parsed = JSON.parse(canonical) as Record<string, unknown>;
	} catch {
		return { ok: false, reason: 'arguments_not_json' };
	}
	const argumentBytes = Buffer.byteLength(canonical, 'utf8');
	if (argumentBytes > peerArgumentLimit(peer)) return { ok: false, reason: 'arguments_too_large' };
	const fields = Object.keys(parsed).sort();
	const allowed = peer.policy.toolRules?.[tool.name]?.argumentFields;
	if (allowed && fields.some((field) => !allowed.includes(field))) {
		return { ok: false, reason: 'argument_field_not_allowed' };
	}
	const valid = conformsToSchema(tool.inputSchema, parsed);
	if (valid === null) return { ok: false, reason: 'schema_unverifiable' };
	if (!valid) return { ok: false, reason: 'arguments_invalid' };
	if (peer.auth.kind === 'bearer') {
		const secret = resolveSecret?.(peer.auth.secretRef);
		if (secret && (canonical.includes(secret) || canonical.includes(JSON.stringify(secret).slice(1, -1)))) {
			return { ok: false, reason: 'credential_in_arguments' };
		}
	}
	return {
		ok: true,
		arguments: parsed,
		canonical,
		disclosure: {
			peerId: peer.id,
			remoteName: tool.name,
			destination: new URL(peer.url).origin,
			sends: 'tool_arguments_only',
			argumentFields: fields,
			argumentBytes,
			credential: peerCallCredential(peer),
		},
	};
}
