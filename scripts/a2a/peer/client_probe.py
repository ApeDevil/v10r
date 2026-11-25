"""A Python a2a-sdk client probing v10r's A2A server (the other direction of the interop run).

Runs against any base URL serving v10r's Agent Card and JSON-RPC binding, and prints ONE JSON
object to stdout: {"sdk": <a2a-sdk version>, "checks": [{"name", "ok", "detail"}]}. Exit code 1
when any check fails.

Run:  uv run --no-project --with 'a2a-sdk[http-server]==1.3.1' \
          python scripts/a2a/peer/client_probe.py --base-url http://127.0.0.1:PORT --model model.json
"""

from __future__ import annotations

import argparse
import asyncio
import importlib.metadata
import json
import sys
import uuid

import httpx
from a2a.client import A2ACardResolver, ClientConfig, create_client
from a2a.helpers import get_data_parts, new_data_part
from a2a.types import CancelTaskRequest, GetTaskRequest, Message, Role, SendMessageRequest, TaskState

CHECKS: list[dict] = []


def check(name: str, ok: bool, detail: str = '') -> None:
    CHECKS.append({'name': name, 'ok': bool(ok), 'detail': detail})


def review_message(model: object, skill: str | None) -> SendMessageRequest:
    message = Message(role=Role.ROLE_USER, message_id=str(uuid.uuid4()), parts=[new_data_part(model)])
    if skill:
        message.metadata.update({'skill': skill})
    return SendMessageRequest(message=message)


async def final_task(client, request):
    """Drive send_message to the end; return (last task snapshot, terminal state, events seen)."""
    task, state, kinds = None, None, []
    async for event in client.send_message(request):
        kind = event.WhichOneof('payload')
        kinds.append(kind)
        if kind == 'task':
            task = event.task
            state = event.task.status.state
        elif kind == 'status_update':
            state = event.status_update.status.state
        elif kind == 'artifact_update' and task is not None:
            task.artifacts.append(event.artifact_update.artifact)
    return task, state, kinds


async def probe(base_url: str, model: object) -> None:
    async with httpx.AsyncClient(timeout=10) as http:
        card = await A2ACardResolver(httpx_client=http, base_url=base_url).get_agent_card()
    skills = sorted(skill.id for skill in card.skills)
    check(
        'card: resolves with both review skills',
        skills == ['architecture-review', 'architecture-security-review'],
        f'{card.name} {card.version}; skills={skills}',
    )
    check(
        'card: JSONRPC interface at protocol 1.0',
        any(i.protocol_binding == 'JSONRPC' and i.protocol_version == '1.0' for i in card.supported_interfaces),
        ', '.join(f'{i.protocol_binding}@{i.protocol_version}' for i in card.supported_interfaces),
    )

    blocking = await create_client(agent=card, client_config=ClientConfig(streaming=False))
    try:
        task, state, _ = await final_task(blocking, review_message(model, 'architecture-security-review'))
        data = [part for artifact in task.artifacts for part in get_data_parts(artifact.parts)] if task else []
        findings = data[0].get('findings', []) if data else []
        check(
            'send: security review completes with findings',
            state == TaskState.TASK_STATE_COMPLETED and len(findings) > 0,
            f'state={TaskState.Name(state) if state is not None else None}; findings={len(findings)}',
        )
        check(
            'send: every finding is a security finding',
            bool(findings) and all(entry.get('category') == 'security' for entry in findings),
            ', '.join(sorted({str(entry.get('code')) for entry in findings})),
        )

        task, state, _ = await final_task(blocking, review_message({'format': 1, 'id': 'Not Valid'}, None))
        check(
            'send: an invalid model is rejected',
            state == TaskState.TASK_STATE_REJECTED,
            f'state={TaskState.Name(state) if state is not None else None}',
        )

        for name, call in (
            ('get_task', lambda: blocking.get_task(GetTaskRequest(id='no-such-task'))),
            ('cancel_task', lambda: blocking.cancel_task(CancelTaskRequest(id='no-such-task'))),
        ):
            try:
                await call()
                check(f'{name}: an unknown task is an error', False, 'no error raised')
            except Exception as error:  # noqa: BLE001 — the SDK's error type is the detail
                check(f'{name}: an unknown task is an error', 'not found' in str(error).lower(), type(error).__name__)
    finally:
        await blocking.close()

    streaming = await create_client(agent=card, client_config=ClientConfig(streaming=True))
    try:
        task, state, kinds = await final_task(streaming, review_message(model, 'architecture-review'))
        check(
            'stream: SSE events end in completed with an artifact',
            state == TaskState.TASK_STATE_COMPLETED and 'artifact_update' in kinds,
            ' -> '.join(kinds),
        )
    finally:
        await streaming.close()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', required=True)
    parser.add_argument('--model', required=True)
    args = parser.parse_args()
    with open(args.model, encoding='utf-8') as handle:
        model = json.load(handle)
    try:
        asyncio.run(probe(args.base_url, model))
    except Exception as error:  # noqa: BLE001 — reported as a failed check, never a traceback-only exit
        check('probe: ran to the end', False, f'{type(error).__name__}: {error}')
    print(json.dumps({'sdk': importlib.metadata.version('a2a-sdk'), 'checks': CHECKS}))
    return 0 if CHECKS and all(entry['ok'] for entry in CHECKS) else 1


if __name__ == '__main__':
    sys.exit(main())
