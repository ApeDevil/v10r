/**
 * The MCP client — how v10r's agent loop consumes tools from external MCP servers ("peers").
 *
 * The other direction of `src/lib/server/mcp/`, which SERVES v10r's tools. Here v10r is the
 * client: it connects through the official `@modelcontextprotocol/client`, reads a peer's tools
 * behind bounds, and projects them into the catalogue's own vocabulary (`risk`, `executor`,
 * `reach`, `resultOrigin`) by operator policy — no second tool registry, no second approval path.
 * Every external tool is `reach: 'external'` and `resultOrigin: 'user'`; only an operator-listed
 * tool is `read`, every other one waits for approval (`mcp-client.gate.test.ts`), and an approved
 * call runs through `executeApprovedPeerCall`, once, with a receipt.
 *
 * Server-only: the package and `node:dns` never reach a client bundle because nothing outside
 * `#lib/server/` imports this module.
 */
export {
	createInMemoryPeerCallReceiptStore,
	type ExecutePeerCallDeps,
	executeApprovedPeerCall,
	type PeerCallDelivery,
	type PeerCallReceipt,
	type PeerCallReceiptStore,
	type PeerReceiptOutcome,
	type PeerReceiptReason,
} from './approved-execution';
export {
	type CreatePeerCallApprovalInput,
	createPeerCallApproval,
	type PeerCallApproval,
	type PeerCallApprovalDraft,
	type PeerCallRefusal,
	type PeerCallVerification,
	peerArgumentsHash,
	peerPermissionDigest,
	type VerifyPeerCallContext,
	verifyApprovedPeerCall,
} from './call-approval';
export { PEER_CALLS_PER_TURN, PEER_SECRET_PREFIX } from './config';
export {
	type DisclosureRefusal,
	type PeerCallCredential,
	type PeerCallDisclosure,
	type PreparedPeerArguments,
	preparePeerArguments,
} from './disclosure';
export {
	checkPeerEndpoint,
	type EndpointOptions,
	type EndpointProblem,
	PeerEndpointError,
	parsePeerUrl,
} from './endpoint-guard';
export { createMcpOperationAdapter, type McpOperationAdapterOptions, mcpPolicyDigest } from './operation-adapter';
export {
	environmentSecretResolver,
	isPeerSecretRef,
	type McpPeer,
	type PeerAuth,
	type PeerConfigProblem,
	type PeerDisclosurePolicy,
	type PeerToolPolicy,
	type PeerToolReversibility,
	type PeerToolRule,
	peerConfigProblems,
	peerToolMutates,
	peerToolReversibility,
	type SecretResolver,
} from './peer';
export {
	type CallPeerToolOptions,
	callPeerTool,
	createPeerCallBudget,
	type PeerCallBudget,
	type PeerCallFlag,
	type PeerCallOutcome,
	type PeerCallResult,
} from './peer-call';
export {
	audienceAdmits,
	connectDirectoryPeer,
	type DirectoryPeer,
	directoryPeerOf,
	discoverDirectoryPeerTools,
	loadDirectoryPeer,
	loadMountablePeers,
	type PeerConfigDraft,
	type PeerConfigRejection,
	type PeerDiscovery,
	type PeerTestOutcome,
	savePeerConfig,
	testDirectoryPeer,
} from './peer-directory';
export { toPeerToolSet } from './peer-tool-set';
export {
	type ConnectPeerOptions,
	connectPeer,
	detectToolDrift,
	fingerprintsOf,
	listPeerTools,
	PeerConfigError,
	type PeerConnection,
	type PeerListingFlag,
	type PeerTool,
	type PeerToolFlag,
	type PeerToolHints,
	type PeerToolListing,
	type ToolDrift,
	type ToolFingerprints,
	toolFingerprint,
} from './peer-tools';
export {
	type PeerCatalogueEntry,
	type PeerCatalogueProjection,
	type PeerToolDefinition,
	type PeerToolDescriptor,
	type PeerToolProjection,
	type ProjectedPeerTool,
	type ProjectionOptions,
	peerToolDescription,
	peerToolName,
	peerToolRisk,
	projectPeerCatalogue,
	projectPeerTools,
	RESERVED_TOOL_NAMES,
	type RefusedPeerReason,
	type WithheldReason,
} from './projection';
