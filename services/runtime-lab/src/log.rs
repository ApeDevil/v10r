//! The one way the process writes a log line: it never blocks a request and never panics.
//!
//! `println!` does both, and both were reproduced against this service. It takes stdout's
//! lock and blocks while the pipe is full, so a log reader that stalls (a container log
//! driver in its default blocking mode, a slow collector) stops every worker thread — the
//! accept loop and `/health/live` included. And it panics when the write fails, so a
//! reader that went away turned every request into a reset connection while the process
//! still looked alive.
//!
//! Here a request only enqueues its line. One writer thread owns stdout. The queue is
//! bounded (`BACKLOG` lines), so a stalled reader costs bounded memory; a line that does
//! not fit is dropped and counted, and the count is written as its own
//! `{"event":"log_dropped","lines":n}` line once the writer catches up — losing a log line
//! is the price of never losing a request to logging, and the loss is never silent.
//! Write errors are ignored by the writer: there is nowhere left to report them.

use std::io::Write;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{self, Receiver, SyncSender, TrySendError};
use std::sync::{Arc, OnceLock};
use std::time::{Duration, Instant};

/// Lines held while the writer is behind. An access-log line is ~200 bytes, so a stalled
/// reader costs at most a few hundred KiB.
pub const BACKLOG: usize = 1024;
/// Longest `flush` waits for queued lines to reach stdout before the process exits. Short
/// on purpose: shutdown must not hang on a reader that is gone.
pub const FLUSH_LIMIT: Duration = Duration::from_secs(1);

enum Message {
    Line(String),
    Flush(mpsc::Sender<()>),
}

pub struct Sink {
    queue: SyncSender<Message>,
    dropped: Arc<AtomicU64>,
}

impl Sink {
    pub fn spawn(out: impl Write + Send + 'static, backlog: usize) -> std::io::Result<Sink> {
        let (queue, received) = mpsc::sync_channel(backlog);
        let dropped = Arc::new(AtomicU64::new(0));
        let counter = dropped.clone();
        std::thread::Builder::new()
            .name("log-writer".into())
            .spawn(move || write_lines(out, received, &counter))?;
        Ok(Sink { queue, dropped })
    }

    /// Enqueue one line; never waits. A full queue (or a dead writer) drops and counts it.
    pub fn emit(&self, event: &serde_json::Value) {
        if self
            .queue
            .try_send(Message::Line(event.to_string()))
            .is_err()
        {
            self.dropped.fetch_add(1, Ordering::Relaxed);
        }
    }

    /// Wait until every line queued so far — and any drop count — is written, for at most
    /// `limit`. Returns whether it was. For process exit only.
    pub fn flush(&self, limit: Duration) -> bool {
        let deadline = Instant::now() + limit;
        let (done, written) = mpsc::channel();
        let mut message = Message::Flush(done);
        // The queue may be full because the writer is stalled; retry until the deadline
        // rather than block on `send`.
        loop {
            match self.queue.try_send(message) {
                Ok(()) => break,
                Err(TrySendError::Disconnected(_)) => return false,
                Err(TrySendError::Full(returned)) => {
                    if Instant::now() >= deadline {
                        return false;
                    }
                    message = returned;
                    std::thread::sleep(Duration::from_millis(5));
                }
            }
        }
        written
            .recv_timeout(deadline.saturating_duration_since(Instant::now()))
            .is_ok()
    }
}

fn write_lines(mut out: impl Write, received: Receiver<Message>, dropped: &AtomicU64) {
    for message in received {
        let flushed = match message {
            Message::Line(line) => {
                let _ = writeln!(out, "{line}");
                None
            }
            Message::Flush(done) => Some(done),
        };
        let lost = dropped.swap(0, Ordering::Relaxed);
        if lost > 0 {
            let _ = writeln!(
                out,
                "{}",
                serde_json::json!({ "event": "log_dropped", "lines": lost })
            );
        }
        let _ = out.flush();
        if let Some(done) = flushed {
            let _ = done.send(());
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
        let sink = Sink::spawn(gate.clone(), 4).unwrap();

        let started = Instant::now();
        for n in 0..100 {
            sink.emit(&line(n));
        }
        assert!(
            started.elapsed() < Duration::from_millis(500),
            "emit waited on a stalled writer: {:?}",
            started.elapsed()
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
        assert!(written <= 6, "the queue is bounded: {written} written");
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
