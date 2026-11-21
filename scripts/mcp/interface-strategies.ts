/**
 * Offline cost model of the interface strategies an agent could use against v10r's MCP tools —
 * the evidence the decision record's Code Mode (D4) and tool-discovery (D5) revisit triggers cite.
 *
 * Deterministic and oracle-driven, like the rest of `mcp:bench`: every strategy runs the SAME
 * scripted calls (`pattern-library/bench/workflows.json`) against the real handlers, so only the
 * interface cost differs. Tokens are ceil(chars / 4) estimates; ratios are meaningful, absolute
 * counts approximate.
 *
 * Strategies, per workflow:
 *  - `direct`      every tool definition in context + each call (args, envelope) + each full result.
 *                  Run twice: with the pre-progressive calls (`baseline`) and the cheapest
 *                  progressive variant (`progressive`) — what v10r ships.
 *  - `code-mode`   the tools as generated TypeScript declarations instead of JSON schemas, one
 *                  script (generated from the calls) in one execute call, and only the FINAL
 *                  result back in context. A lower bound: an oracle script never needs to look at
 *                  an intermediate result to decide its next call, and the sandbox is free.
 *  - `discovery`   one `search_tools` meta-tool in context; each distinct tool is found by one
 *                  search returning its full definition plus two runners-up, then called directly.
 *  - `hybrid`      a rule chosen up front: `direct` while the catalogue's definitions stay under a
 *                  threshold, else `discovery` for tasks of ≤ 2 calls and `code-mode` beyond.
 *
 * What this cannot measure: model round trips actually taken, tool-selection accuracy, generated-
 * code failures, sandbox cost, latency through a real client. Those need a live evaluation lane,
 * which is a separate decision (roadmap B2).
 */

export interface ToolDefinition {
	name: string;
	description: string;
	inputSchema: Record<string, unknown>;
}

/** One executed step of a scripted workflow: the call, and the text its real handler returned. */
export interface MeasuredStep {
	tool: string;
	args: Record<string, unknown>;
	resultText: string;
}

export interface StrategyCost {
	calls: number;
	definitionTokens: number;
	callTokens: number;
	resultTokens: number;
	/** Results the model saw before the last one — the most any programmatic strategy can keep out. */
	intermediateTokens: number;
	total: number;
	/**
	 * `total` with the definitions read from a prompt cache — what a client that keeps its tool
	 * definitions in a cached prefix pays on every turn after the first. Results never are.
	 */
	totalWithCachedDefinitions: number;
}

export interface StrategyModel {
	estimateTokens(text: string): number;
	/** Per round trip, the envelope a model pays beyond the arguments. */
	callOverheadTokens: number;
}

/** Above this many definition tokens, `hybrid` stops loading every definition up front. */
export const HYBRID_DEFINITION_THRESHOLD_TOKENS = 5_000;

/**
 * Price of a cached input token relative to an uncached one. 0.1 is Anthropic's published
 * cache-read multiplier; an assumption about the client, so it is reported beside the plain total,
 * never instead of it.
 */
export const CACHED_DEFINITION_COST_RATIO = 0.1;

/** Synthetic catalogue sizes for the crossover search. 8 is the real catalogue. */
export const CATALOGUE_SCALES = [8, 32, 128, 512] as const;

/** The discovery meta-tool, as a client would define it. */
const SEARCH_TOOLS_DEFINITION: ToolDefinition = {
	name: 'search_tools',
	description:
		'Search the available tools by what you want to do. Returns the best matches with their full definitions; call a returned tool directly afterwards.',
	inputSchema: {
		type: 'object',
		properties: { query: { type: 'string', description: 'What the tool should do.' } },
		required: ['query'],
	},
};

/** The code-mode executor, as a client would define it. */
const EXECUTE_DEFINITION: ToolDefinition = {
	name: 'execute',
	description:
		'Run a TypeScript async function body against the `tools` API declared below. Only the returned value comes back.',
	inputSchema: { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] },
};

function schemaToTs(schema: unknown): string {
	if (typeof schema !== 'object' || schema === null) return 'unknown';
	const node = schema as Record<string, unknown>;
	if (Array.isArray(node.enum)) return node.enum.map((value) => JSON.stringify(value)).join(' | ');
	switch (node.type) {
		case 'string':
			return 'string';
		case 'number':
		case 'integer':
			return 'number';
		case 'boolean':
			return 'boolean';
		case 'array':
			return `Array<${schemaToTs(node.items)}>`;
		case 'object': {
			const properties = (node.properties ?? {}) as Record<string, unknown>;
			const required = new Set(Array.isArray(node.required) ? (node.required as string[]) : []);
			const fields = Object.entries(properties).map(([key, value]) => {
				const description = (value as Record<string, unknown>)?.description;
				const doc = typeof description === 'string' ? `/** ${description} */ ` : '';
				return `${doc}${key}${required.has(key) ? '' : '?'}: ${schemaToTs(value)};`;
			});
			return fields.length > 0 ? `{ ${fields.join(' ')} }` : 'Record<string, unknown>';
		}
		default:
			return 'unknown';
	}
}

/** The tools as a code-mode client presents them: one typed declaration each, descriptions kept. */
export function typescriptDeclarations(tools: readonly ToolDefinition[]): string {
	const members = tools.map(
		(tool) => `\t/** ${tool.description} */\n\t${tool.name}(args: ${schemaToTs(tool.inputSchema)}): Promise<string>;`,
	);
	return `declare const tools: {\n${members.join('\n')}\n};`;
}

/** The script an oracle would write for a workflow: every call in order, the last result returned. */
export function workflowScript(steps: readonly MeasuredStep[]): string {
	const lines = steps.map((step, index) => `const r${index} = await tools.${step.tool}(${JSON.stringify(step.args)});`);
	return [...lines, `return r${steps.length - 1};`].join('\n');
}

/**
 * A synthetic catalogue of `size` tools: the real definitions cloned under distinct names, so the
 * per-tool definition cost stays realistic while the catalogue grows.
 */
export function syntheticCatalogue(tools: readonly ToolDefinition[], size: number): ToolDefinition[] {
	return Array.from({ length: size }, (_, index) => {
		const source = tools[index % tools.length];
		const copy = Math.floor(index / tools.length);
		return copy === 0
			? source
			: { ...source, name: `${source.name}_v${copy}`, description: `${source.description} (variant ${copy})` };
	});
}

function definitionsTokens(tools: readonly ToolDefinition[], model: StrategyModel): number {
	return model.estimateTokens(JSON.stringify({ tools }));
}

function direct(steps: readonly MeasuredStep[], catalogue: readonly ToolDefinition[], model: StrategyModel) {
	const results = steps.map((step) => model.estimateTokens(step.resultText));
	const callTokens = steps.reduce(
		(sum, step) => sum + model.estimateTokens(JSON.stringify(step.args)) + model.callOverheadTokens,
		0,
	);
	const resultTokens = results.reduce((sum, value) => sum + value, 0);
	const definitionTokens = definitionsTokens(catalogue, model);
	return cost(steps.length, definitionTokens, callTokens, resultTokens, resultTokens - (results.at(-1) ?? 0));
}

function codeMode(steps: readonly MeasuredStep[], catalogue: readonly ToolDefinition[], model: StrategyModel) {
	const definitionTokens =
		definitionsTokens([EXECUTE_DEFINITION], model) + model.estimateTokens(typescriptDeclarations(catalogue));
	const callTokens = model.estimateTokens(workflowScript(steps)) + model.callOverheadTokens;
	const resultTokens = model.estimateTokens(steps.at(-1)?.resultText ?? '');
	return cost(1, definitionTokens, callTokens, resultTokens, 0);
}

function discovery(steps: readonly MeasuredStep[], catalogue: readonly ToolDefinition[], model: StrategyModel) {
	const perToolDefinition = definitionsTokens(catalogue, model) / catalogue.length;
	const distinct = [...new Set(steps.map((step) => step.tool))];
	// One search per distinct tool: its own definition plus two runners-up, at the catalogue's mean size.
	const searchTokens = distinct.reduce((sum, name) => {
		const found = catalogue.find((tool) => tool.name === name);
		const own = found ? model.estimateTokens(JSON.stringify(found)) : perToolDefinition;
		return sum + own + 2 * perToolDefinition;
	}, 0);
	const searchCalls =
		distinct.length * (model.estimateTokens('{"query":"…a short task phrase…"}') + model.callOverheadTokens);
	const plain = direct(steps, [], model);
	return cost(
		steps.length + distinct.length,
		definitionsTokens([SEARCH_TOOLS_DEFINITION], model),
		plain.callTokens + searchCalls,
		plain.resultTokens + Math.round(searchTokens),
		plain.intermediateTokens + Math.round(searchTokens),
	);
}

function cost(
	calls: number,
	definitionTokens: number,
	callTokens: number,
	resultTokens: number,
	intermediateTokens: number,
): StrategyCost {
	return {
		calls,
		definitionTokens,
		callTokens,
		resultTokens,
		intermediateTokens,
		total: definitionTokens + callTokens + resultTokens,
		totalWithCachedDefinitions: Math.round(definitionTokens * CACHED_DEFINITION_COST_RATIO) + callTokens + resultTokens,
	};
}

function hybrid(steps: readonly MeasuredStep[], catalogue: readonly ToolDefinition[], model: StrategyModel) {
	if (definitionsTokens(catalogue, model) < HYBRID_DEFINITION_THRESHOLD_TOKENS)
		return { rule: 'direct', ...direct(steps, catalogue, model) };
	if (steps.length <= 2) return { rule: 'discovery', ...discovery(steps, catalogue, model) };
	return { rule: 'code-mode', ...codeMode(steps, catalogue, model) };
}

export interface MeasuredWorkflow {
	id: string;
	/** The pre-progressive calls. */
	baseline: readonly MeasuredStep[];
	/** The cheapest progressive variant's calls (what v10r ships). */
	progressive: readonly MeasuredStep[];
}

/** Every strategy for every workflow, on the real catalogue. */
export function compareStrategies(
	workflows: readonly MeasuredWorkflow[],
	tools: readonly ToolDefinition[],
	model: StrategyModel,
) {
	return workflows.map((workflow) => ({
		id: workflow.id,
		'direct-baseline': direct(workflow.baseline, tools, model),
		'direct-progressive': direct(workflow.progressive, tools, model),
		'code-mode': codeMode(workflow.progressive, tools, model),
		discovery: discovery(workflow.progressive, tools, model),
		hybrid: hybrid(workflow.progressive, tools, model),
	}));
}

/**
 * Summed cost of all workflows per strategy at each synthetic catalogue size, and the smallest
 * size at which each alternative beats shipping every definition (`direct-progressive`).
 */
export function catalogueScale(
	workflows: readonly MeasuredWorkflow[],
	tools: readonly ToolDefinition[],
	model: StrategyModel,
) {
	const rows = CATALOGUE_SCALES.map((size) => {
		const catalogue = syntheticCatalogue(tools, size);
		const sum = (strategy: typeof direct, key: 'total' | 'totalWithCachedDefinitions') =>
			workflows.reduce((total, workflow) => total + strategy(workflow.progressive, catalogue, model)[key], 0);
		const totals = (key: 'total' | 'totalWithCachedDefinitions') => ({
			'direct-progressive': sum(direct, key),
			'code-mode': sum(codeMode, key),
			discovery: sum(discovery, key),
			hybrid: sum(hybrid, key),
		});
		return {
			tools: size,
			definitionTokens: definitionsTokens(catalogue, model),
			...totals('total'),
			cachedDefinitions: totals('totalWithCachedDefinitions'),
		};
	});
	// The exact crossover, scanned tool by tool: the smallest catalogue where the alternative is
	// cheaper than shipping every definition. Equal to the real size means "already cheaper today";
	// null means "not within the scanned range".
	const firstBeating = (strategy: typeof direct, key: 'total' | 'totalWithCachedDefinitions') => {
		for (let size = tools.length; size <= CATALOGUE_SCALES[CATALOGUE_SCALES.length - 1]; size += 1) {
			const catalogue = syntheticCatalogue(tools, size);
			const total = (candidate: typeof direct) =>
				workflows.reduce((sum, workflow) => sum + candidate(workflow.progressive, catalogue, model)[key], 0);
			if (total(strategy) < total(direct)) return size;
		}
		return null;
	};
	return {
		rows,
		crossover: {
			'code-mode': firstBeating(codeMode, 'total'),
			discovery: firstBeating(discovery, 'total'),
		},
		crossoverWithCachedDefinitions: {
			'code-mode': firstBeating(codeMode, 'totalWithCachedDefinitions'),
			discovery: firstBeating(discovery, 'totalWithCachedDefinitions'),
		},
	};
}
