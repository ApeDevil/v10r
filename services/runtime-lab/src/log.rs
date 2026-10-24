//! The one way the process writes a log line: it never blocks a request and never panics.
//!
//! `println!` does both, and both were reproduced against this service. It takes stdout's
//! lock and blocks while the pipe is full, so a log reader that stalls (a container log
//! driver in its default blocking mode, a slow collector) stops every worker thread — the
//! accept loop and `/health/live` included. And it panics when the write fails, so a
//! reader that went away turned every request into a reset connection while the process
//! still looked alive.
//!
//! Here a request appends its line to a bounded buffer under a short lock and returns; it
//! never wakes anything. One writer thread owns stdout: every `DRAIN_INTERVAL` it swaps the
//! buffer out and writes the batch in one `write`, ignoring errors — there is nowhere left
//! to report them. A line that does not fit (`BACKLOG`) is dropped and counted, and the
//! count is written as its own `{"event":"log_dropped","lines":n}` line once the writer
//! catches up: losing a log line is the price of never losing a request to logging. What the
//! count cannot cover: a batch whose write fails (the reader is gone — there is no one to
//! tell), lines emitted after the final flush, and a last line cut short when the process
//! exits with the writer blocked.
//!
//! Why no channel: a first version woke the writer for every line. Under a 0.1 CPU quota
//! that wake-up, paid from the same quota as the requests, cost a fifth of burst throughput
//! and tripled p95; draining on a timer instead was faster than `println!` itself
//! (docs/blueprint/architecture/external-service.md#measurement).

use std::io::{BufWriter, Write};
use std::sync::{Arc, Condvar, Mutex, MutexGuard, OnceLock};
use std::time::{Duration, Instant};

/// Lines held while the writer is behind. An access-log line is ~200 bytes, so a stalled
/// reader costs at most two buffers of this — a few hundred KiB.
pub const BACKLOG: usize = 1024;
/// How often the writer drains: the most a line waits before it is written. 50 wake-ups a
/// second on an idle service, a few microseconds each.
const DRAIN_INTERVAL: Duration = Duration::from_millis(20);
/// The writer's output buffer: one batch leaves in one `write`.
const BATCH_BYTES: usize = 64 * 1024;
/// Longest `flush` waits for queued lines to reach stdout before the process exits. Short
/// on purpose: shutdown must not hang on a reader that is gone.
pub const FLUSH_LIMIT: Duration = Duration::from_secs(1);

#[derive(Default)]
struct Pending {
    lines: Vec<String>,
    dropped: u64,
    /// Flushes asked for, and how many of those the writer has completed.
    flushes_requested: u64,
    flushes_done: u64,
}

pub struct Sink {
    pending: Arc<(Mutex<Pending>, Condvar)>,
    backlog: usize,
}

/// A writer that panicked mid-write must not take the request path with it.
fn lock(mutex: &Mutex<Pending>) -> MutexGuard<'_, Pending> {
    mutex
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

impl Sink {
    pub fn spawn(out: impl Write + Send + 'static, backlog: usize) -> std::io::Result<Sink> {
        let pending = Arc::new((Mutex::new(Pending::default()), Condvar::new()));
        let shared = pending.clone();
        std::thread::Builder::new()
            .name("log-writer".into())
            .spawn(move || write_lines(out, &shared))?;
        Ok(Sink { pending, backlog })
    }

    /// Append one line; never waits for the writer and never wakes it. A full buffer drops
    /// and counts the line.
    pub fn emit(&self, event: &serde_json::Value) {
        let line = event.to_string();
        let mut pending = lock(&self.pending.0);
        if pending.lines.len() < self.backlog {
            pending.lines.push(line);
        } else {
            pending.dropped += 1;
        }
    }

    /// Wake the writer and wait until every line appended so far — and any drop count — is
    /// written, for at most `limit`. Returns whether it was. For process exit only.
    pub fn flush(&self, limit: Duration) -> bool {
        let deadline = Instant::now() + limit;
        let (mutex, signal) = &*self.pending;
        let mut pending = lock(mutex);
        pending.flushes_requested += 1;
        let ticket = pending.flushes_requested;
        signal.notify_all();
        while pending.flushes_done < ticket {
            let left = deadline.saturating_duration_since(Instant::now());
            if left.is_zero() {
                return false;
            }
            pending = signal
                .wait_timeout(pending, left)
                .unwrap_or_else(|poisoned| poisoned.into_inner())
                .0;
        }
        true
    }
}

fn write_lines(out: impl Write, pending: &(Mutex<Pending>, Condvar)) {
    let (mutex, signal) = pending;
    let mut out = BufWriter::with_capacity(BATCH_BYTES, out);
    let mut batch = Vec::new();
    loop {
        let (dropped, ticket) = {
            let mut pending = lock(mutex);
            // Sleep the interval unless a flush is waiting; `emit` never cuts it short.
            if pending.flushes_done == pending.flushes_requested {
                pending = signal
                    .wait_timeout(pending, DRAIN_INTERVAL)
                    .unwrap_or_else(|poisoned| poisoned.into_inner())
                    .0;
            }
            std::mem::swap(&mut pending.lines, &mut batch);
            (
                std::mem::take(&mut pending.dropped),
                pending.flushes_requested,
            )
        };
        // Written outside the lock: a stalled reader blocks this thread, never `emit`.
        for line in batch.drain(..) {
            let _ = writeln!(out, "{line}");
        }
        if dropped > 0 {
            let _ = writeln!(
                out,
                "{}",
                serde_json::json!({ "event": "log_dropped", "lines": dropped })
            );
        }
        let _ = out.flush();
        let mut pending = lock(mutex);
        if pending.flushes_done < ticket {
            pending.flushes_done = ticket;
            signal.notify_all();
        }
    }
}

/// The process-wide sink on stdout. `None` only if the writer thread could not be started,
/// in which case lines are discarded: a service that cannot log still serves.
fn stdout_sink() -> Option<&'static Sink> {
    static SINK: OnceLock<Option<Sink>> = OnceLock::new();
    SINK.get_or_init(|| {
        // Unit tests drive the router in-process; their access lines are not test output.
        #[cfg(test)]
        let out = std::io::sink();
        #[cfg(not(test))]
        let out = std::io::stdout();
        Sink::spawn(out, BACKLOG).ok()
    })
    .as_ref()
}

/// Write one JSON log line to stdout, without ever waiting for stdout.
pub fn emit(event: serde_json::Value) {
    if let Some(sink) = stdout_sink() {
        sink.emit(&event);
    }
}

/// Before exit: give queued lines up to `FLUSH_LIMIT` to reach stdout.
pub fn flush() {
    if let Some(sink) = stdout_sink() {
        sink.flush(FLUSH_LIMIT);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Condvar, Mutex};

    /// Whether the gate is open, and what got through it.
    #[derive(Default)]
    struct GateState {
        open: bool,
        written: Vec<u8>,
    }

    /// A writer that holds every write until it is opened — a log reader that stalled.
    #[derive(Clone, Default)]
    struct Gate {
        state: Arc<(Mutex<GateState>, Condvar)>,
    }

    impl Gate {
        fn open(&self) {
            let (lock, wake) = &*self.state;
            lock.lock().unwrap().open = true;
            wake.notify_all();
        }
        fn lines(&self) -> Vec<serde_json::Value> {
            let bytes = self.state.0.lock().unwrap().written.clone();
            String::from_utf8(bytes)
                .unwrap()
                .lines()
                .map(|line| serde_json::from_str(line).unwrap())
                .collect()
        }
    }

    impl Write for Gate {
        fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
            let (lock, wake) = &*self.state;
            let mut state = wake
                .wait_while(lock.lock().unwrap(), |state| !state.open)
                .unwrap();
            state.written.extend_from_slice(buf);
            Ok(buf.len())
        }
        fn flush(&mut self) -> std::io::Result<()> {
            Ok(())
        }
    }

    /// A writer whose reader has gone: every write fails (EPIPE).
    struct Closed;

    impl Write for Closed {
        fn write(&mut self, _: &[u8]) -> std::io::Result<usize> {
            Err(std::io::ErrorKind::BrokenPipe.into())
        }
        fn flush(&mut self) -> std::io::Result<()> {
            Err(std::io::ErrorKind::BrokenPipe.into())
        }
    }

    fn line(n: usize) -> serde_json::Value {
        serde_json::json!({ "event": "request", "n": n })
    }

    #[test]
    fn a_stalled_reader_never_blocks_emit_and_every_loss_is_counted() {
        let gate = Gate::default();
        let sink = Arc::new(Sink::spawn(gate.clone(), 4).unwrap());

        // On a thread, so an emit that waits on the writer fails this test instead of hanging
        // `cargo test` — the regression this test exists for.
        let (done, emitted) = std::sync::mpsc::channel();
        let emitter = sink.clone();
        std::thread::spawn(move || {
            for n in 0..100 {
                emitter.emit(&line(n));
            }
            let _ = done.send(());
        });
        assert!(
            emitted.recv_timeout(Duration::from_millis(500)).is_ok(),
            "emit waited on a stalled writer"
        );
        // Nothing can be flushed while the reader is stalled — and flush says so in time.
        assert!(!sink.flush(Duration::from_millis(50)));

        gate.open();
        assert!(sink.flush(Duration::from_secs(5)));
        let lines = gate.lines();
        let written = lines.iter().filter(|l| l["event"] == "request").count() as u64;
        let dropped: u64 = lines
            .iter()
            .filter(|l| l["event"] == "log_dropped")
            .map(|l| l["lines"].as_u64().unwrap())
            .sum();
        // At most the batch the writer held when it stalled plus one queue-full behind it.
        assert!(written <= 4 * 2, "the queue is bounded: {written} written");
        assert_eq!(written + dropped, 100, "{lines:?}");
    }

    #[test]
    fn a_closed_reader_is_ignored_not_panicked_on() {
        let sink = Sink::spawn(Closed, 8).unwrap();
        for n in 0..32 {
            sink.emit(&line(n));
        }
        // The writer thread is still alive and answering: it did not panic on EPIPE.
        assert!(sink.flush(Duration::from_secs(5)));
    }

    #[test]
    fn lines_keep_their_order() {
        let gate = Gate::default();
        gate.open();
        let sink = Sink::spawn(gate.clone(), BACKLOG).unwrap();
        for n in 0..50 {
            sink.emit(&line(n));
        }
        assert!(sink.flush(Duration::from_secs(5)));
        let order: Vec<u64> = gate
            .lines()
            .iter()
            .map(|l| l["n"].as_u64().unwrap())
            .collect();
        assert_eq!(order, (0..50).collect::<Vec<_>>());
    }
}
