/**
 * `v10r-shipping-receipt/1` — the block `squash-into-main.sh --feedback` prints, completed by
 * the ship procedure with the GitLab sync and deployment results, pasted by the admin to
 * confirm a release. A record of the shipping procedure as the maintainer's session reported
 * it, not an authenticated attestation: the application checks its shape and that it
 * matches the approved implementation, and nothing more.
 */
import * as v from 'valibot';
import { GIT_SHA_PATTERN } from './implementation-report';
import { extractTaggedBlock, type TaggedBlockRefusal } from './tagged-block';

export const SHIPPING_RECEIPT_FORMAT = 'v10r-shipping-receipt/1';

const sha = v.pipe(v.string(), v.toLowerCase(), v.regex(GIT_SHA_PATTERN));

export const shippingReceiptSchema = v.strictObject({
	format: v.literal(SHIPPING_RECEIPT_FORMAT),
	feedbackId: v.pipe(v.string(), v.maxLength(64)),
	branch: v.pipe(v.string(), v.maxLength(120)),
	approvedSha: sha,
	shipCommit: sha,
	gate: v.strictObject({
		validate: v.picklist(['passed', 'failed']),
		validateBuild: v.picklist(['passed', 'failed']),
	}),
	gitlabSync: v.picklist(['success', 'failure', 'pending']),
	deployment: v.strictObject({
		state: v.picklist(['READY', 'ERROR', 'CANCELED', 'pending']),
		url: v.nullable(v.pipe(v.string(), v.maxLength(300))),
		/** The version the deployed site reported when the ship procedure looked, if it did. */
		servedVersion: v.nullable(sha),
	}),
});

export type ShippingReceipt = v.InferOutput<typeof shippingReceiptSchema>;

export type ShippingReceiptRefusal =
	| TaggedBlockRefusal
	| 'invalid_receipt'
	| 'wrong_feedback'
	| 'wrong_branch'
	| 'wrong_sha'
	/** The receipt itself records a failed gate, sync or deployment. */
	| 'release_failed';

export type ParsedShippingReceipt =
	| { ok: true; receipt: ShippingReceipt }
	| { ok: false; refusal: ShippingReceiptRefusal; issues?: string[] };

export function parseShippingReceipt(
	paste: string,
	expected: { feedbackId: string; branch: string; approvedSha: string },
): ParsedShippingReceipt {
	const block = extractTaggedBlock(paste, SHIPPING_RECEIPT_FORMAT);
	if (!block.ok) return { ok: false, refusal: block.refusal };
	const parsed = v.safeParse(shippingReceiptSchema, block.value);
	if (!parsed.success) {
		return {
			ok: false,
			refusal: 'invalid_receipt',
			issues: parsed.issues.slice(0, 5).map((issue) => `${v.getDotPath(issue) ?? '(root)'}: ${issue.message}`),
		};
	}
	const receipt = parsed.output;
	if (receipt.feedbackId !== expected.feedbackId) return { ok: false, refusal: 'wrong_feedback' };
	if (receipt.branch !== expected.branch) return { ok: false, refusal: 'wrong_branch' };
	if (receipt.approvedSha !== expected.approvedSha) return { ok: false, refusal: 'wrong_sha' };
	const shipped =
		receipt.gate.validate === 'passed' &&
		receipt.gate.validateBuild === 'passed' &&
		receipt.gitlabSync === 'success' &&
		receipt.deployment.state === 'READY';
	if (!shipped) return { ok: false, refusal: 'release_failed' };
	return { ok: true, receipt };
}
