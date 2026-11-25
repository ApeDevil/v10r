"""An independent A2A peer: a deterministic "performance specialist" for architecture models.

Written against the Python `a2a-sdk` (not v10r's JS SDK) with its own rules, so an interop run
between it and v10r exercises two implementations of A2A 1.0 that share no code. No language
model, no API keys: the same model always yields the same findings.

It reads the same architecture model JSON v10r's Architecture Studio exports (format 1) and
answers with a review report in the shared envelope:

    {"format": 1, "skill": "performance-review", "model": {"id", "name"},
     "counts": {...}, "findings": [{"code", "severity", "category", "subject",
                                    "detected", "why", "fix"}]}

Rules (its own, not v10r's):
  sync.chain-depth         a synchronous call chain of 3 or more hops (latency adds up)
  cache.absent             a database read synchronously with no cache component in the model
  availability.single-point a component whose loss disconnects the rest (articulation point)
  request.cpu-bound        a cpu-intensive component reached synchronously
  retry.without-timeout    a synchronous call that retries but states no timeout

Run:  uv run --no-project --with 'a2a-sdk[http-server]==1.3.1' --with uvicorn \
          python scripts/a2a/peer/performance_agent.py --port 9999 [--allow-fixtures]

`--allow-fixtures` enables, and advertises on the card, the interop run's adversarial skills —
off by default:

  malformed-findings-fixture  a report with deliberately invalid entries (dropped and counted)
  invalid-report-fixture      a completed task whose report has the wrong envelope (refused whole)
  rejecting-review-fixture    rejects every task (the peer declines)
  slow-review-fixture         works for 30 s; cancellable — `CancelTask` ends it as CANCELED
"""

from __future__ import annotations

import argparse
import asyncio
import sys

import uvicorn
from a2a.helpers import get_data_parts, new_data_part, new_task_from_user_message, new_text_message, new_text_part
from a2a.server.agent_execution import AgentExecutor, RequestContext
from a2a.server.events import EventQueue
from a2a.server.request_handlers import DefaultRequestHandler
from a2a.server.routes import create_agent_card_routes, create_jsonrpc_routes
from a2a.server.tasks import InMemoryTaskStore, TaskUpdater
from a2a.types import AgentCapabilities, AgentCard, AgentInterface, AgentSkill, TaskState
from starlette.applications import Starlette

AGENT_VERSION = '1.0.0'
SKILL_ID = 'performance-review'
FIXTURE_SKILL_ID = 'malformed-findings-fixture'
INVALID_REPORT_SKILL_ID = 'invalid-report-fixture'
REJECTING_SKILL_ID = 'rejecting-review-fixture'
SLOW_SKILL_ID = 'slow-review-fixture'
FIXTURE_SKILLS = (FIXTURE_SKILL_ID, INVALID_REPORT_SKILL_ID, REJECTING_SKILL_ID, SLOW_SKILL_ID)
SLOW_SECONDS = 30
MAX_NODES = 200
MAX_CONNECTIONS = 600
SEVERITY_ORDER = {'error': 0, 'warning': 1, 'unknown': 2, 'recommendation': 3}
STORE_KINDS = {'relational-db', 'graph-db'}


def finding(code: str, severity: str, subject: str, detected: str, why: str, fix: str) -> dict:
    return {
        'code': code,
        'severity': severity,
        'category': 'performance',
        'subject': subject,
        'detected': detected,
        'why': why,
        'fix': fix,
    }


def read_model(data: object) -> tuple[dict | None, str | None]:
    """Fail-closed structural read: enough to run the rules safely, refused otherwise."""
    if not isinstance(data, dict):
        return None, 'the data part is not an object'
    if data.get('format') != 1:
        return None, 'unsupported model format (this peer reads format 1)'
    nodes, connections = data.get('nodes'), data.get('connections')
    if not isinstance(nodes, list) or not isinstance(connections, list):
        return None, 'the model needs nodes and connections lists'
    if len(nodes) > MAX_NODES or len(connections) > MAX_CONNECTIONS:
        return None, 'the model exceeds the size limits'
    ids = set()
    for node in nodes:
        if not isinstance(node, dict) or not isinstance(node.get('id'), str) or not isinstance(node.get('kind'), str):
            return None, 'every node needs a string id and kind'
        ids.add(node['id'])
    for connection in connections:
        if not isinstance(connection, dict) or connection.get('from') not in ids or connection.get('to') not in ids:
            return None, 'every connection must join two known nodes'
    return data, None


def longest_sync_chain(nodes: list[dict], sync: list[dict]) -> list[str]:
    """The longest simple path over synchronous connections (models are small; DFS is fine)."""
    out: dict[str, list[str]] = {node['id']: [] for node in nodes}
    for connection in sync:
        out[connection['from']].append(connection['to'])
    best: list[str] = []

    def walk(path: list[str]) -> None:
        nonlocal best
        if len(path) > len(best):
            best = list(path)
        for nxt in sorted(out[path[-1]]):
            if nxt not in path:
                path.append(nxt)
                walk(path)
                path.pop()

    for node in sorted(out):
        walk([node])
    return best


def articulation_points(nodes: list[dict], connections: list[dict]) -> list[str]:
    adjacency: dict[str, set[str]] = {node['id']: set() for node in nodes}
    for connection in connections:
        adjacency[connection['from']].add(connection['to'])
        adjacency[connection['to']].add(connection['from'])
    order: dict[str, int] = {}
    low: dict[str, int] = {}
    points: set[str] = set()

    def visit(node: str, parent: str | None, counter: list[int]) -> None:
        order[node] = low[node] = counter[0]
        counter[0] += 1
        children = 0
        for nxt in sorted(adjacency[node]):
            if nxt not in order:
                children += 1
                visit(nxt, node, counter)
                low[node] = min(low[node], low[nxt])
                if parent is not None and low[nxt] >= order[node]:
                    points.add(node)
            elif nxt != parent:
                low[node] = min(low[node], order[nxt])
        if parent is None and children > 1:
            points.add(node)

    counter = [0]
    for node in sorted(adjacency):
        if node not in order:
            visit(node, None, counter)
    return sorted(points)


def review(model: dict) -> list[dict]:
    nodes, connections = model['nodes'], model['connections']
    by_id = {node['id']: node for node in nodes}
    sync = [c for c in connections if c.get('mode') == 'sync']
    findings: list[dict] = []

    chain = longest_sync_chain(nodes, sync)
    if len(chain) - 1 >= 3:
        findings.append(finding(
            'sync.chain-depth', 'warning', f'nodes/{chain[0]}',
            f'{len(chain) - 1} synchronous hops: {" -> ".join(chain)}',
            'Each synchronous hop adds its latency and its failure probability to the caller.',
            'Make a hop asynchronous (queue or outbox), or collapse components that always call each other.',
        ))

    has_cache = any(node['kind'] == 'cache' for node in nodes)
    for connection in sorted(sync, key=lambda c: c.get('id', '')):
        target = by_id[connection['to']]
        if target['kind'] in STORE_KINDS and not has_cache:
            findings.append(finding(
                'cache.absent', 'recommendation', f'connections/{connection.get("id", "")}',
                f'{target["id"]} is read synchronously and the model has no cache component',
                'Every read pays the database round trip; hot reads have nowhere cheaper to come from.',
                'Add a cache in front of the hot reads, or state why freshness forbids one.',
            ))
        traits = target.get('traits') if isinstance(target.get('traits'), dict) else {}
        if traits.get('cpu_intensive') is True:
            findings.append(finding(
                'request.cpu-bound', 'warning', f'nodes/{target["id"]}',
                f'{target["id"]} is cpu-intensive and called synchronously by {connection["from"]}',
                'The caller waits for the CPU work; tail latency follows the slowest computation.',
                'Hand the work to a background worker and answer with a job reference.',
            ))
        if connection.get('failure_handling') == 'retry':
            findings.append(finding(
                'retry.without-timeout', 'warning', f'connections/{connection.get("id", "")}',
                'the call retries but states no timeout',
                'Retries without a timeout multiply the wait on a hung dependency.',
                'Use timeout-and-retry with a bounded budget.',
            ))

    if len(nodes) >= 3:
        for point in articulation_points(nodes, connections):
            findings.append(finding(
                'availability.single-point', 'warning', f'nodes/{point}',
                f'{point} is the only path between parts of the model',
                'Its outage or saturation stops every flow that crosses it.',
                'Add redundancy or an alternative path, or state the availability it is expected to hold.',
            ))

    findings.sort(key=lambda f: (SEVERITY_ORDER[f['severity']], f['code'], f['subject']))
    return findings


def report(model: dict, findings: list[dict]) -> dict:
    counts = {severity: 0 for severity in ('error', 'warning', 'recommendation', 'unknown')}
    for entry in findings:
        counts[entry['severity']] += 1
    return {
        'format': 1,
        'skill': SKILL_ID,
        'model': {'id': str(model.get('id', '')), 'name': str(model.get('name', ''))},
        'counts': counts,
        'findings': findings,
    }


MALFORMED_FINDINGS = [
    finding('sync.chain-depth', 'warning', 'nodes/x', 'a valid entry among invalid ones', 'why', 'fix'),
    {'code': 'NOT A CODE', 'severity': 'warning', 'subject': 'nodes/x', 'detected': 'bad code'},
    {'code': 'severity.invented', 'severity': 'catastrophic', 'subject': 'nodes/x', 'detected': 'bad severity'},
    {'code': 'detected.missing', 'severity': 'warning', 'subject': 'nodes/x'},
    'not an object',
]


class PerformanceAgentExecutor(AgentExecutor):
    def __init__(self, allow_fixtures: bool) -> None:
        self.allow_fixtures = allow_fixtures
        self.running: dict[str, asyncio.Event] = {}

    async def execute(self, context: RequestContext, event_queue: EventQueue) -> None:
        task = context.current_task or new_task_from_user_message(context.message)
        if not context.current_task:
            await event_queue.enqueue_event(task)
        updater = TaskUpdater(event_queue=event_queue, task_id=task.id, context_id=task.context_id)

        metadata = dict(context.message.metadata) if context.message.metadata else {}
        skill = metadata.get('skill', SKILL_ID)
        fixture = skill if self.allow_fixtures and skill in FIXTURE_SKILLS else None
        if skill != SKILL_ID and not fixture:
            await updater.reject(new_text_message(f'Refused: unknown skill; this peer offers {SKILL_ID}.'))
            return
        if fixture == REJECTING_SKILL_ID:
            await updater.reject(new_text_message('Refused: this fixture declines every review.'))
            return
        data_parts = get_data_parts(context.message.parts)
        if len(data_parts) != 1:
            await updater.reject(new_text_message('Refused: expected exactly one data part (the architecture model).'))
            return
        model, problem = read_model(data_parts[0])
        if model is None:
            await updater.reject(new_text_message(f'Refused: {problem}.'))
            return

        await updater.start_work()
        if fixture == SLOW_SKILL_ID:
            stop = asyncio.Event()
            self.running[task.id] = stop
            try:
                await asyncio.wait_for(stop.wait(), timeout=SLOW_SECONDS)
                return  # cancelled: cancel() already reported CANCELED
            except TimeoutError:
                pass
            finally:
                self.running.pop(task.id, None)
        if fixture == FIXTURE_SKILL_ID:
            body = {**report(model, []), 'findings': MALFORMED_FINDINGS}
        elif fixture == INVALID_REPORT_SKILL_ID:
            body = {**report(model, review(model)), 'format': 99}
        else:
            body = report(model, review(model))
        total = len(body['findings'])
        summary = f'performance-review of "{body["model"]["name"]}": {total} finding{"" if total == 1 else "s"}.'
        await updater.add_artifact(
            parts=[new_data_part(body, media_type='application/json'), new_text_part(summary, media_type='text/plain')],
            name='performance-review-report',
        )
        await updater.complete(new_text_message(summary))

    async def cancel(self, context: RequestContext, event_queue: EventQueue) -> None:
        # Only the slow fixture outlives a moment; every other task completes inside execute().
        stop = self.running.get(context.task_id or '')
        if stop is None:
            raise NotImplementedError('only a running slow-review-fixture task can be cancelled')
        updater = TaskUpdater(event_queue=event_queue, task_id=context.task_id, context_id=context.context_id)
        await updater.cancel(new_text_message("Cancelled at the caller's request."))
        stop.set()


def fixture_skill(skill_id: str) -> AgentSkill:
    return AgentSkill(
        id=skill_id,
        name=f'Interop fixture: {skill_id}',
        description='Adversarial interop fixture, served only with --allow-fixtures.',
        tags=['fixture'],
        examples=['An ArchitectureModel JSON data part'],
        input_modes=['application/json'],
        output_modes=['application/json', 'text/plain'],
    )


def build_card(base_url: str, allow_fixtures: bool) -> AgentCard:
    return AgentCard(
        name='Independent performance review agent',
        description='Deterministic performance review of a v10r architecture model (format 1). Python a2a-sdk peer.',
        version=AGENT_VERSION,
        default_input_modes=['application/json'],
        default_output_modes=['application/json', 'text/plain'],
        capabilities=AgentCapabilities(streaming=True),
        supported_interfaces=[AgentInterface(protocol_binding='JSONRPC', url=base_url, protocol_version='1.0')],
        skills=[
            AgentSkill(
                id=SKILL_ID,
                name='Performance review',
                description='Sync chain depth, missing cache, single points of failure, cpu-bound request paths.',
                tags=['architecture', 'performance', 'deterministic'],
                examples=['An ArchitectureModel JSON data part'],
                input_modes=['application/json'],
                output_modes=['application/json', 'text/plain'],
            ),
            *([fixture_skill(skill_id) for skill_id in FIXTURE_SKILLS] if allow_fixtures else []),
        ],
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=9999)
    parser.add_argument('--allow-fixtures', action='store_true')
    args = parser.parse_args()

    base_url = f'http://{args.host}:{args.port}'
    card = build_card(base_url, args.allow_fixtures)
    handler = DefaultRequestHandler(
        agent_executor=PerformanceAgentExecutor(args.allow_fixtures),
        task_store=InMemoryTaskStore(),
        agent_card=card,
    )
    app = Starlette(routes=[*create_agent_card_routes(card), *create_jsonrpc_routes(handler, '/')])
    uvicorn.run(app, host=args.host, port=args.port, log_level='warning')
    return 0


if __name__ == '__main__':
    sys.exit(main())
