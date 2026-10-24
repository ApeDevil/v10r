#!/usr/bin/env bash
# Supply-chain audit for services/runtime-lab: cargo-deny against services/runtime-lab/deny.toml
# — RustSec advisories (vulnerable, yanked, unsound, unmaintained), licenses, crate sources.
#
#   bash scripts/external-service/audit.sh           # in the pinned Rust image (local sessions)
#   bash scripts/external-service/audit.sh --host    # with the host's cargo-deny (cloud sessions)
#
# Not part of `bun run validate`, for the reason `bun run audit` is not: it needs the network
# (the advisory database) and its verdict changes with the database, not with the commit.
# The container path installs cargo-deny once into a named volume (v10r-cargo-tools).
set -euo pipefail

cd "$(dirname "$0")/../.."

CRATE=services/runtime-lab
# The same digest as Containerfile, check.sh and scripts/wasm/build.sh.
RUST_IMAGE="docker.io/library/rust:1.97-slim@sha256:8e8cf8f7fd54a2d23d5a743b3a03f56e26b6c774276c33fa0595111704ebb15c"
CARGO_DENY_VERSION="0.20.2"
AUDIT='cargo deny --locked check advisories bans licenses sources'

if [ "${1:-}" = "--host" ]; then
	command -v cargo-deny >/dev/null || { echo "audit: cargo-deny not found — cargo install cargo-deny --locked --version $CARGO_DENY_VERSION" >&2; exit 2; }
	echo "audit: host $(cargo deny --version)"
	(cd "$CRATE" && bash -euo pipefail -c "$AUDIT")
else
	ENGINE="${CONTAINER_ENGINE:-$(command -v podman >/dev/null && echo podman || echo docker)}"
	"$ENGINE" run --rm \
		-v "$PWD/$CRATE:/work:ro" \
		-v v10r-cargo-registry:/usr/local/cargo/registry \
		-v v10r-cargo-tools:/tools \
		-e CARGO_TARGET_DIR=/tmp/target \
		-w /work \
		"$RUST_IMAGE" bash -euo pipefail -c "
			[ -x /tools/bin/cargo-deny ] || cargo install --locked --root /tools cargo-deny --version $CARGO_DENY_VERSION
			export PATH=/tools/bin:\$PATH
			echo \"audit: container \$(cargo deny --version)\"
			$AUDIT"
fi
echo "audit: passed"
