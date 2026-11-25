# Claude Code compatibility check: tool `title` and `readOnlyHint`

Roadmap item **B1**. v10r's tool definitions carry only `name`, `description` and `inputSchema`
because a Claude Code bug once dropped a server's *entire* tool list when any tool carried `title`,
`annotations` or `outputSchema` ([pattern-mcp.md](../pattern-mcp.md) §Client design constraints).
Both fields are stable in the specification and useful — `title` is a display name,
`readOnlyHint: true` lets a client auto-approve a read-only tool — so the question is only whether
the client still breaks. This page is the procedure that answers it. **The fields stay off until a
recorded run says the current Claude Code accepts them.**

## Why it runs locally

The check needs a signed-in Claude Code on the machine that runs it. A cloud session cannot use
ApeDevil's Claude Code, and running one against its own session would test the wrong client and
spend the wrong account. Everything else — the fixture server and the script — is in the repo.

## What it is

| File | Role |
|---|---|
| `scripts/mcp/claude-code-compat/annotated-server.ts` | The real stdio server (the committed bundle `mcp/server.bundle.js`, run as a child) with one change on the way out: `tools/list` results gain the fields named by `V10R_COMPAT_FIELDS` (`none`, `title`, `readOnlyHint`, `both`). Serves stdio, or HTTP with `--http <port>` (a line bridge to the same child). Dependency-free: runs in the bare container like the real server. A fixture only — never registered for real use |
| `scripts/mcp/claude-code-compat/check.sh` | Runs every case — 2 transports × 4 field sets — as one isolated, headless Claude Code turn and reads the session's `system/init` event: the fixture server's connection status and how many of its eight tools the client kept |

Isolation: `--strict-mcp-config` ignores every MCP server you have configured; each turn runs in a
throwaway directory (no project `.mcp.json`, no `CLAUDE.md`); `--allowedTools` admits nothing (or,
with `--call`, only the one fixture tool); nothing is written to your Claude Code configuration.
Cost: eight one-word turns, or eight short tool-calling turns with `--call`.

The fixture is spec-valid: the official SDK client (`@modelcontextprotocol/client` 2.4.0) lists
all eight tools with each field set (verified 2026-11-21). So a failing case isolates the client.

## Run it

On the host (Claude Code installed and signed in; `bun` on PATH, or podman with the repo's
`docker.io/oven/bun:1.3.12` image — the script picks whichever is there):

```bash
scripts/mcp/claude-code-compat/check.sh          # list check
scripts/mcp/claude-code-compat/check.sh --call   # also call one tool per case
```

Each case prints one line, then the transcripts' directory:

```
stdio  none          status=connected  tools=8  called=-   era=modern(2026-07-28) model=<the session's model>
stdio  title         status=connected  tools=8  called=-   era=modern(2026-07-28) model=…
…
http   metaUi        status=connected  tools=8  called=-   era=modern(2026-07-28) model=…
```

`model` is the model the headless session ran on (from its `system/init` event): your Claude Code
default unless `V10R_COMPAT_MODEL` pins one. `era` is the protocol era Claude Code spoke —
`legacy(<version>)` for the 2025-era `initialize` handshake, `modern(2026-07-28)` for the
per-request envelope (bun runtime only; the podman fixture mounts read-only and prints
`unknown`). The fixture serves both eras; the client picks. The server's legacy era is covered
independently by `mcp/smoke.ts` and the conformance lane.

- **Pass** for a case: `status=connected` and `tools=8` (and `called=yes` with `--call`).
- **The control (`none`) must pass on both transports**, or the kit is broken — the script exits 1
  and the field verdicts mean nothing. With `--call` the control also needs `called=yes`: a turn
  that never ran (a usage limit, a sign-in prompt) fails the control and prints the turn's
  result line, so a run that did not happen is never read as a pass.
- **The release check uses your ordinary configuration**: run it without `V10R_COMPAT_MODEL`, so
  the verdict is for the model and settings you actually use, and record that model.

Cloud evidence (2026-11-24, not a verdict): Claude Code 2.1.331 in the cloud container, model
pinned with `V10R_COMPAT_MODEL`: all ten cases `connected`, `tools=8`, `called=yes`, era
`modern(2026-07-28)` on both transports. It is not ApeDevil's configuration or default model, so
B1 stays off until the local run.
- `tools=0` with `status=connected`, or a failed status, on a field case reproduces the bug.

## Record the verdict

Add one row to [matrix.md](./matrix.md) (rows "Tool `title`" and "`annotations.readOnlyHint`"):
the Claude Code version from `summary.txt`, the date, and pass/fail per field and transport.

- **Both fields pass on both transports** → B1 can proceed as a separate change: add `title` and
  `readOnlyHint: true` to the public pattern tools (and `destructiveHint` / `idempotentHint` where
  true on admin), extend `mcp/smoke.ts` to assert them, and update the constraint row in
  pattern-mcp.md. The parity test then carries the fields to both transports.
- **Any field fails** → nothing changes; keep the row's date and re-run on the next Claude Code
  release that mentions MCP tool metadata (the monthly review in [process.md](./process.md) reads
  the changelog).
