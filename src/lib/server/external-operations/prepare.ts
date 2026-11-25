/**
 * The proposal half of an external operation — no database, no transport of its own: the
 * adapter describes the disclosure and the binding, the content screen classifies the
 * arguments, nothing is sent. The turn then writes the proposal and its
 * `agent_external_operation` row together (`execution.ts` holds the approve half).
 */
import { createHash } from 'node:crypto';
import { canonicalJson } from '#lib/utils/canonical-json.ts';
import { screenExternalArguments } from './content-screen';
import type {
	ExternalDisclosure,
	ExternalOperationAdapter,
	ExternalOperationBinding,
	ExternalOperationRequest,
} from './contract';
import { externalArgumentBytes, MAX_EXTERNAL_ARGUMENT_BYTES } from './outgoing-arguments';

/** sha-256 of the canonical JSON of `args` — what a binding's `argumentsDigest` is. */
export function externalArgumentsDigest(args: unknown): string {
	return createHash('sha256').update(canonicalJson(args)).digest('hex');
}

/** An operation ready to be put in front of a human: nothing has been sent. */
export interface PreparedExternalOperation {
	request: Omit<ExternalOperationRequest, 'readContent'>;
	/** The model-facing tool name it was proposed under. */
	toolName: string;
	disclosure: ExternalDisclosure;
	binding: ExternalOperationBinding;
}

export type ExternalPreparationRefusal = string;

/**
 * The proposal half. Refuses what can never be sent (arguments too large to inspect whole, the adapter's
 * disclosure check, a secret,
 * relayed untrusted markup) so it is never put in front of a human; otherwise returns the
 * disclosure the card shows and the binding the approval will hold.
 */
export async function prepareExternalOperation(
	adapter: ExternalOperationAdapter,
	request: ExternalOperationRequest,
	options: { toolName: string; secrets?: readonly string[] },
): Promise<{ ok: true; prepared: PreparedExternalOperation } | { ok: false; reason: ExternalPreparationRefusal }> {
	if (adapter.protocol !== request.protocol) return { ok: false, reason: 'protocol_mismatch' };
	if (externalArgumentBytes(request.arguments) > MAX_EXTERNAL_ARGUMENT_BYTES) {
		return { ok: false, reason: 'arguments_too_large' };
	}
	const screen = screenExternalArguments(request.arguments, {
		readContent: request.readContent,
		...(options.secrets ? { secrets: options.secrets } : {}),
	});
	if (!screen.ok) return { ok: false, reason: screen.reason };
	const preparation = await adapter.prepare(request);
	if (!preparation.ok) return preparation;
	const { binding } = preparation;
	if (
		binding.protocol !== request.protocol ||
		binding.peerId !== request.peerId ||
		binding.operation !== request.operation ||
		binding.userId !== request.userId ||
		binding.argumentsDigest !== externalArgumentsDigest(request.arguments)
	) {
		return { ok: false, reason: 'binding_mismatch' };
	}
	const { readContent: _read, ...sent } = request;
	return {
		ok: true,
		prepared: {
			request: sent,
			toolName: options.toolName,
			disclosure: { ...preparation.disclosure, contentClass: screen.contentClass, quotedFrom: screen.quotedFrom },
			binding,
		},
	};
}
