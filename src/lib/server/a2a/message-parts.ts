/** Building A2A message parts. The SDK's `Part` is the proto shape: a `$case` union plus fields every part carries. */
import type { Part } from '@a2a-js/sdk';

export function textPart(text: string): Part {
	return { content: { $case: 'text', value: text }, mediaType: 'text/plain', filename: '', metadata: undefined };
}

export function dataPart(value: unknown): Part {
	return { content: { $case: 'data', value }, mediaType: 'application/json', filename: '', metadata: undefined };
}
