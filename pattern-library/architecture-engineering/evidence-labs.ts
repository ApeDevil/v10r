/**
 * The existing v10r experiments that measure architectural trade-offs, and the gaps where no
 * measurement exists yet. Architecture Engineering links to these labs; it does not copy
 * their numbers, so a figure has one owner (the lab or its doc) and cannot drift here.
 *
 * Every ref is checked by `patterns:validate` like a decision's evidence.
 */
import type { EvidenceKind } from './vocabulary.ts';

export interface EvidenceLab {
	id: string;
	title: string;
	question: string;
	/** `available` = something can be run or read; `missing` = no v10r measurement exists yet. */
	status: 'available' | 'missing';
	kind: EvidenceKind;
	/** What the lab accounts for — initialization, data transfer, memory, processing, … */
	accounts_for: string[];
	refs: { label: string; ref: string }[];
	limitations: string;
	/** Decision ids this evidence informs. */
	decisions: string[];
	patterns: string[];
}

export const EVIDENCE_LABS: readonly EvidenceLab[] = [
	{
		id: 'javascript-vs-rust-wasm',
		title: 'JavaScript vs Rust/Wasm',
		question: 'When does a Rust kernel compiled to WebAssembly beat its JavaScript twin?',
		status: 'available',
		kind: 'live-measurement',
		accounts_for: [
			'Module initialization (first-run cost reported separately)',
			'Data transfer across the JS/Wasm boundary (copy-in and copy-out timed separately)',
			'Memory discipline (resident buffers vs a deliberate per-call-copy case)',
			'Processing time (medians over counterbalanced rounds, byte-parity gated)',
			'Worker overhead (the kernel runs in a Web Worker)',
		],
		refs: [
			{ label: 'Run the benchmark', ref: '/showcases/wasm' },
			{ label: 'Benchmark protocol', ref: 'docs/blueprint/architecture/wasm.md#honest-benchmarking' },
			{ label: 'Harness code', ref: 'src/lib/wasm/bench.ts' },
		],
		limitations:
			'Numbers are measured on your device when you run it and are not recorded. One kernel (a blur); the result does not generalize to other workloads.',
		decisions: ['compute-runtime', 'compute-acceleration'],
		patterns: ['architecture-wasm-kernel', 'main-thread-budget'],
	},
	{
		id: 'app-server-vs-external-service',
		title: 'Application server vs external compute service',
		question: 'What does a separately deployed service cost per call, at start-up and in operations?',
		status: 'available',
		kind: 'measured',
		accounts_for: [
			'Network overhead (round trip split into service time and client time via Server-Timing)',
			'Service initialization (a wake check that can observe a cold start)',
			'Failure handling (deadlines, one failure kind per cause, retry only idempotent calls)',
			'Deployment complexity (a second image, credential and contract)',
			'Runtime isolation (its own process, memory and CPU limits)',
		],
		refs: [
			{ label: 'Call the service', ref: '/showcases/external-service' },
			{ label: 'Measured figures and conditions', ref: 'docs/blueprint/architecture/external-service.md#measurement' },
		],
		limitations:
			'Loopback, controlled-lab and one hosted region (Render Free, Frankfurt, 2026-10-23); the doc lists what is still unmeasured hosted.',
		decisions: ['compute-placement', 'deployment-shape', 'interaction-style'],
		patterns: ['architecture-external-service', 'resilience-policy', 'deadline-propagation'],
	},
	{
		id: 'application-vs-database-processing',
		title: 'Application vs database processing',
		question: 'When is SQL-side filtering or aggregation preferable to transferring rows to the application?',
		status: 'missing',
		kind: 'estimate',
		accounts_for: ['Round trips per operation (query budgets) — not bytes transferred or processing time'],
		refs: [
			{ label: 'Query budgets', ref: 'docs/blueprint/velocity/data.md#query-budget-and-hot-query-proof' },
			{ label: 'Query budget table', ref: 'src/lib/server/db/query-budget.ts' },
		],
		limitations:
			'v10r has no measurement comparing SQL-side and application-side processing yet. The processing-locality decision rests on documented reasoning until one exists.',
		decisions: ['processing-locality'],
		patterns: ['query-budget', 'databases-queries-mutations-split'],
	},
];
