/**
 * The review agent's `AgentExecutor`: read the message, run the deterministic checks, publish.
 *
 * Every task reaches a terminal state inside `execute` — the checks are pure functions over a
 * bounded model and take milliseconds — so the event sequence is always one of:
 *
 *   completed: task(WORKING) → artifact(report data + summary text) → status(COMPLETED)
 *   refused:   task(REJECTED, with the reason and the model issues as a data part)
 *
 * That is what makes the per-request `InMemoryTaskStore` in `transport.ts` correct: there is no
 * later moment at which anyone could need the task again.
 */
import { type Artifact, type Message, type Part, Role, type Task, TaskState } from '@a2a-js/sdk';
import { AgentEvent, type AgentExecutor, type ExecutionEventBus, type RequestContext } from '@a2a-js/sdk/server';
import { dataPart, textPart } from './message-parts.ts';
import { buildReviewReport, summarizeReviewReport } from './review-report.ts';
import { readReviewRequest } from './review-request.ts';

/** The artifact's stable name, so a client can pick it out of a task without guessing. */
export const REVIEW_ARTIFACT_NAME = 'architecture-review-report';

function agentMessage(context: RequestContext, parts: Part[]): Message {
	return {
		messageId: crypto.randomUUID(),
		contextId: context.contextId,
		taskId: context.taskId,
		role: Role.ROLE_AGENT,
		parts,
		metadata: undefined,
		extensions: [],
		referenceTaskIds: [],
	};
}

function task(context: RequestContext, state: TaskState, message?: Message): Task {
	return {
		id: context.taskId,
		contextId: context.contextId,
		status: { state, message, timestamp: new Date().toISOString() },
		artifacts: [],
		history: [],
		metadata: undefined,
	};
}

export class ArchitectureReviewExecutor implements AgentExecutor {
	async execute(context: RequestContext, bus: ExecutionEventBus): Promise<void> {
		const request = readReviewRequest(context.userMessage);
		if (!request.ok) {
			const parts = [textPart(`Refused: ${request.reason}.`)];
			if (request.issues.length > 0) parts.push(dataPart({ issues: request.issues }));
			bus.publish(AgentEvent.task(task(context, TaskState.TASK_STATE_REJECTED, agentMessage(context, parts))));
			bus.finished();
			return;
		}

		bus.publish(AgentEvent.task(task(context, TaskState.TASK_STATE_WORKING)));
		const report = buildReviewReport(request.skill, request.model);
		const summary = summarizeReviewReport(report);
		const artifact: Artifact = {
			artifactId: crypto.randomUUID(),
			name: REVIEW_ARTIFACT_NAME,
			description: 'Deterministic Architecture Engineering findings for the submitted model.',
			parts: [dataPart(report), textPart(summary)],
			metadata: undefined,
			extensions: [],
		};
		bus.publish(
			AgentEvent.artifactUpdate({
				taskId: context.taskId,
				contextId: context.contextId,
				artifact,
				append: false,
				lastChunk: true,
				metadata: undefined,
			}),
		);
		bus.publish(
			AgentEvent.statusUpdate({
				taskId: context.taskId,
				contextId: context.contextId,
				status: {
					state: TaskState.TASK_STATE_COMPLETED,
					message: agentMessage(context, [textPart(summary)]),
					timestamp: new Date().toISOString(),
				},
				metadata: undefined,
			}),
		);
		bus.finished();
	}

	/**
	 * Reached only for a task this request's store holds, and every such task is already terminal
	 * (the SDK answers TaskNotCancelable before calling this). Kept honest rather than empty.
	 */
	async cancelTask(taskId: string, bus: ExecutionEventBus): Promise<void> {
		bus.publish(
			AgentEvent.statusUpdate({
				taskId,
				contextId: '',
				status: { state: TaskState.TASK_STATE_CANCELED, message: undefined, timestamp: new Date().toISOString() },
				metadata: undefined,
			}),
		);
		bus.finished();
	}
}
