/**
 * External operations — the one approval, disclosure, claim and receipt path for an assistant
 * action that leaves the deployment. Protocols plug in as `ExternalOperationAdapter`s supplied
 * by the caller (`ExternalOperationAdapters`); this domain imports none of them. The MCP adapter
 * is `#lib/server/ai/mcp-client/operation-adapter.ts`; an `a2a` adapter registers the same way.
 * See `docs/blueprint/ai/external-operations.md`.
 */
export {
	type ContentScreen,
	type ContentScreenRefusal,
	deploymentSecretValues,
	previewExternalArguments,
	QUOTE_WINDOW_CHARS,
	screenExternalArguments,
} from './content-screen';
export type {
	ExternalContentClass,
	ExternalDelivery,
	ExternalDisclosure,
	ExternalDisclosureDraft,
	ExternalEnvelopeField,
	ExternalExecutionResult,
	ExternalOperationAdapter,
	ExternalOperationAdapters,
	ExternalOperationBinding,
	ExternalOperationRequest,
	ExternalOutcome,
	ExternalPreparation,
	ExternalProtocol,
	ExternalReadContent,
	ExternalRemoteTask,
	ExternalReversibility,
} from './contract';
export {
	type ApproveExternalOptions,
	createExternalOperationExecutor,
	type ExternalApproval,
	type ExternalApprovalRefusal,
	type ExternalOperationActor,
	type ExternalOperationExecutor,
	type ExternalOperationExecutorOptions,
	type ExternalReceiptMessage,
	externalOperationCard,
	externalOperationRecord,
	externalReceiptMessageId,
	externalReceiptText,
	externalReceiptView,
} from './execution';
export {
	type ExternalOutgoingArguments,
	externalOutgoingDocument,
	MAX_EXTERNAL_ARGUMENT_BYTES,
} from './outgoing-arguments';
export {
	type ExternalPreparationRefusal,
	externalArgumentsDigest,
	type PreparedExternalOperation,
	prepareExternalOperation,
} from './prepare';
