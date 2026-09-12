/**
 * AI turn milestones — a paste-into-the-console probe for one chatbot or deskbot conversation.
 *
 * Open `/showcases/ai/chatbot` (or any page with the Vely panel) — or `/desk` with a Bot panel —
 * paste this whole file into the DevTools console, then chat. Every `/api/ai/chatbot` and
 * `/api/ai/deskbot` request is teed and its SSE frames parsed on the way to the app, so the
 * numbers are what the browser actually saw:
 *
 *   tHeaders    response headers arrived            tStart      the assistant `start` frame
 *   tFirstText  first non-blank text delta           tFirstPaint that text rendered in `.chat-prose`
 *   tLastText   last text delta                      tFinish     the `finish` frame
 *   tReady      Stop gave way to Send (turn over)     reqBytes    request body size
 *   metaFrames / metaBytes   `message-metadata` frames and their wire size
 *   toolParts   every `tool-*` part with its offset  errors      `error` frames (text)
 *   proposal    a desk turn ended on an approval card (its id, and when the card's metadata landed)
 *
 * Desk approvals are their own record (`window.__vely.approvals`): `tApprove` (the POST to
 * `/api/ai/proposals/:id/approve` left), `tOutcome` (its response, with the server's status and
 * how many steps ran), `tRefreshed` (the panel showing the changed file answered `ai:file_refreshed`
 * — the visible outcome, read from the I/O log entry the session writes, so the I/O Log panel
 * must be open and visible). Human review time is the gap between the turn's `tReady` and
 * `tApprove`, reported separately, never optimized.
 *
 * All offsets are ms from the moment the request was sent. `window.__vely.turns` holds one
 * entry per turn; `__dump(i)` prints turn `i` (default: the last one) without headers or
 * cookies, plus the server's per-step pipeline (`pipeline:step` events from the final
 * `message-metadata` frame — the `generate` step's detail carries `preStreamMs`, per-step
 * `firstTokenMs`, tool execution ms and the `finalize` stages).
 *
 * Costs Gemini quota with every turn — manual on purpose. Pair runs (baseline, candidate,
 * baseline, …) and report medians; the fixtures and pacing are in `scripts/perf/README.md`
 * ("Paired runs"). Reload the page to uninstall.
 */
(() => {
	const TURN_ROUTES = ['/api/ai/chatbot', '/api/ai/deskbot'];
	const APPROVE_ROUTE = /\/api\/ai\/proposals\/([^/]+)\/approve$/;
	const tap = { turns: [], approvals: [], longTasks: [] };
	window.__vely = tap;

	const since = (turn) => Math.round(performance.now() - turn.tSend);

	const parseFrame = (turn, payload, t) => {
		if (payload === '[DONE]') return;
		let frame;
		try {
			frame = JSON.parse(payload);
		} catch {
			return;
		}
		switch (frame.type) {
			case 'start':
				turn.tStart = t;
				break;
			case 'text-delta': {
				const delta = frame.delta || '';
				turn.textDeltas += 1;
				turn.textBytes += delta.length;
				if (turn.tFirstText === undefined && delta.trim()) turn.tFirstText = t;
				turn.tLastText = t;
				break;
			}
			case 'message-metadata':
				turn.metaFrames += 1;
				turn.metaBytes += payload.length;
				turn.lastMeta = frame.messageMetadata;
				if (frame.messageMetadata?.harness?.proposal && !turn.proposal) {
					turn.proposal = { id: frame.messageMetadata.harness.proposal.id, tCard: t };
				}
				break;
			case 'finish':
				turn.tFinish = t;
				break;
			case 'error':
				turn.errors.push({ t, text: frame.errorText });
				break;
			default:
				if (frame.type.startsWith('tool-')) turn.toolParts.push({ t, type: frame.type, name: frame.toolName });
				else turn.otherFrames.push({ t, type: frame.type });
		}
	};

	const originalFetch = window.fetch;
	window.fetch = async function velyTurnTap(input, init) {
		const url = typeof input === 'string' ? input : input?.url || '';
		const approve = APPROVE_ROUTE.exec(url);
		if (approve && (init?.method ?? 'GET').toUpperCase() === 'POST') {
			// An approval: from the click to the server's verdict, then to the panel's reload.
			const lastTurn = tap.turns.at(-1);
			const record = {
				proposalId: approve[1],
				tApprove: performance.now(),
				reviewMs:
					lastTurn?.tReady !== undefined ? Math.round(performance.now() - lastTurn.tSend - lastTurn.tReady) : null,
				// Only I/O Log entries written AFTER the click count as this approval's reload — an
				// earlier approval's "File reloaded" line is still on the page.
				logEntriesAtApprove: document.querySelectorAll('.io-log-entry').length,
				current: true,
			};
			tap.approvals.push(record);
			const response = await originalFetch.apply(this, [input, init]);
			record.tOutcome = Math.round(performance.now() - record.tApprove);
			record.status = response.status;
			try {
				const { data } = await response.clone().json();
				record.outcome = data?.status;
				record.stepsRun = data?.steps?.length;
				record.effects = data?.effects?.length;
			} catch {
				// a refusal body has no outcome
			}
			return response;
		}
		if (!TURN_ROUTES.some((route) => url.includes(route))) return originalFetch.apply(this, [input, init]);

		const turn = {
			tSend: performance.now(),
			reqBytes: typeof init?.body === 'string' ? init.body.length : 0,
			bytes: 0,
			chunks: 0,
			textDeltas: 0,
			textBytes: 0,
			metaFrames: 0,
			metaBytes: 0,
			toolParts: [],
			otherFrames: [],
			errors: [],
			current: true,
		};
		tap.turns.push(turn);

		const response = await originalFetch.apply(this, [input, init]);
		turn.tHeaders = since(turn);
		turn.status = response.status;
		turn.convId = response.headers.get('x-conversation-id');
		if (!response.body) return response;

		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		let buffer = '';
		const teed = new ReadableStream({
			async pull(controller) {
				const { done, value } = await reader.read();
				if (done) {
					turn.tDone = since(turn);
					controller.close();
					return;
				}
				const t = since(turn);
				if (turn.tFirstByte === undefined) turn.tFirstByte = t;
				turn.bytes += value.byteLength;
				turn.chunks += 1;
				buffer += decoder.decode(value, { stream: true });
				let end = buffer.indexOf('\n\n');
				while (end >= 0) {
					const raw = buffer.slice(0, end);
					buffer = buffer.slice(end + 2);
					const line = raw.split('\n').find((l) => l.startsWith('data: '));
					if (line) parseFrame(turn, line.slice(6), t);
					end = buffer.indexOf('\n\n');
				}
				controller.enqueue(value);
			},
			cancel(reason) {
				turn.cancelled = true;
				return reader.cancel(reason);
			},
		});
		return new Response(teed, { status: response.status, statusText: response.statusText, headers: response.headers });
	};

	// Paint + composer milestones come from the DOM, not the wire.
	const observer = new MutationObserver(() => {
		const turn = tap.turns.find((candidate) => candidate.current);
		if (!turn) return;
		const t = since(turn);
		const proses = document.querySelectorAll('.chat-prose');
		const last = proses[proses.length - 1];
		if (turn.tFirstPaint === undefined && turn.tFirstText !== undefined && last && last.textContent.trim()) {
			turn.tFirstPaint = t;
		}
		// The composer stays typeable while the answer streams (slice 3); what flips is the
		// primary button — Send becomes Stop for the turn's duration. Ready is only read once
		// the wire says the turn is over: the `start` frame re-renders the composer for a moment
		// and a Stop-less sample taken then would end the turn at its first byte.
		const stop = document.querySelector('.chat-input-container [aria-label="Stop"]');
		if (stop && turn.tPending === undefined) turn.tPending = t;
		const over = turn.tFinish !== undefined || turn.tDone !== undefined || turn.errors.length > 0;
		if (!stop && over && turn.tReady === undefined) {
			turn.tReady = t;
			turn.current = false;
		}
		// The visible outcome of an approval: the desk-bot session logs the panel's answer to
		// `ai:refresh_file` ("File reloaded at version N" / "Reload not confirmed …") in the I/O Log.
		const approval = tap.approvals.find((candidate) => candidate.current);
		if (approval && approval.tOutcome !== undefined) {
			const logged = [...document.querySelectorAll('.io-log-entry')]
				.slice(approval.logEntriesAtApprove)
				.some((el) => /File reloaded|Reload not confirmed|reload failed/.test(el.textContent || ''));
			if (logged) {
				approval.tRefreshed = Math.round(performance.now() - approval.tApprove);
				approval.current = false;
			}
		}
	});
	observer.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });

	try {
		new PerformanceObserver((list) => {
			for (const entry of list.getEntries()) {
				tap.longTasks.push({ start: Math.round(entry.startTime), ms: Math.round(entry.duration) });
			}
		}).observe({ entryTypes: ['longtask'] });
	} catch {
		// Long-task timing is a Chromium extra; the milestones above do not depend on it.
	}

	/** Print one turn (default: the last) — milestones, sizes and the server pipeline, nothing else. */
	window.__dump = (index = tap.turns.length - 1) => {
		const turn = tap.turns[index];
		if (!turn) return 'no such turn';
		const { lastMeta, current, tSend, ...milestones } = turn;
		const pipeline = (lastMeta?.pipeline ?? [])
			.filter((event) => event.type === 'pipeline:step')
			.map((event) => ({
				step: event.instanceKey ?? event.step,
				status: event.status,
				startMs: event.startOffsetMs,
				ms: event.durationMs,
				...(event.step === 'generate' && event.detail ? { detail: event.detail } : {}),
			}));
		return JSON.stringify({ ...milestones, pipeline }, null, 2);
	};

	/** Print one approval (default: the last) — click → verdict → visible reload, plus the review gap. */
	window.__dumpApproval = (index = tap.approvals.length - 1) => {
		const approval = tap.approvals[index];
		if (!approval) return 'no approval yet';
		const { current, tApprove, logEntriesAtApprove, ...milestones } = approval;
		return JSON.stringify(milestones, null, 2);
	};

	return `turn tap installed — chat, then __dump() / __dumpApproval() (turns so far: ${tap.turns.length})`;
})();
