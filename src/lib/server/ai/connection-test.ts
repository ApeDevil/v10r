/**
 * Connection test — one minimal generation against a concrete provider/model.
 *
 * A model-specific request is more useful than listing models: it proves the key is
 * accepted, the model id resolves, and the account is not rate-limited right now — the
 * three things an administrator wants to know before saving. It proves nothing about
 * tool calling or vision; `model-capabilities.ts` says what the model is trusted to do.
 *
 * The prompt is fixed and synthetic, output is capped, there is exactly one attempt, and
 * the result carries a classified outcome plus timing — never the provider's response
 * text or error body, which can echo request details.
 */
import { APICallError, generateText, type LanguageModel } from 'ai';
import { CONNECTION_TEST_MAX_OUTPUT_TOKENS, CONNECTION_TEST_PROMPT, CONNECTION_TEST_TIMEOUT_MS } from './config';
import { classifyAiError } from './errors';

export type ConnectionTestOutcome =
	| 'ok'
	| 'invalid_key'
	| 'model_not_found'
	| 'rate_limited'
	| 'timeout'
	| 'network'
	| 'unknown';

export interface ConnectionTestResult {
	outcome: ConnectionTestOutcome;
	latencyMs: number;
	testedAt: string;
}

function classifyFailure(err: unknown): ConnectionTestOutcome {
	if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) return 'timeout';
	if (APICallError.isInstance(err)) {
		const status = err.statusCode;
		if (status === 401 || status === 403) return 'invalid_key';
		if (status === 404) return 'model_not_found';
		if (status === 429) return 'rate_limited';
		if (status === undefined) return 'network';
	}
	switch (classifyAiError(err).kind) {
		case 'authentication':
			return 'invalid_key';
		case 'model':
			return 'model_not_found';
		case 'rate_limit':
			return 'rate_limited';
		case 'timeout':
			return 'timeout';
		case 'unavailable':
			return 'network';
		default:
			return 'unknown';
	}
}

export async function testLanguageModel(model: LanguageModel): Promise<ConnectionTestResult> {
	const startedAt = performance.now();
	const testedAt = new Date().toISOString();
	try {
		// A resolved call is the proof; the text is not asserted on — a thinking model may spend
		// the whole output cap before emitting a token and still have answered the question.
		await generateText({
			model,
			prompt: CONNECTION_TEST_PROMPT,
			maxOutputTokens: CONNECTION_TEST_MAX_OUTPUT_TOKENS,
			maxRetries: 0,
			abortSignal: AbortSignal.timeout(CONNECTION_TEST_TIMEOUT_MS),
		});
		return { outcome: 'ok', latencyMs: Math.round(performance.now() - startedAt), testedAt };
	} catch (err) {
		return { outcome: classifyFailure(err), latencyMs: Math.round(performance.now() - startedAt), testedAt };
	}
}
