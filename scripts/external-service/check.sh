#!/usr/bin/env bash
# The Rust gate for services/order-rules: fmt, clippy, tests — then a freshness manifest.
#
#   bash scripts/external-service/check.sh           # in the pinned rust container (local sessions)
#   bash scripts/external-service/check.sh --host    # with the host's cargo (cloud sessions)
#   UPDATE_OPENAPI=1 bash scripts/external-service/check.sh   # also regenerate openapi.json
#
# Like scripts/wasm/build.sh, this keeps Rust out of `bun run validate`: the gate never
# runs cargo. Instead this script, only when every check passes, records sha256 hashes of
# the crate's inputs and of openapi.json in services/order-rules/check-manifest.json, and
# contract-freshness.test.ts recomputes them. A Rust edit without a passing run of this
# script turns `validate` red. Honest limit: the manifest proves "these files passed the
# checks when this script last ran", trusting the script — not that they would pass again
# on a different toolchain.
#
# Reproducibility pins: RUST_IMAGE is the digest the Containerfile and scripts/wasm/build.sh
# use; the channel in rust-toolchain.toml is that image's rustc. Named volumes cache the
# crate registry (shared with the wasm build) and the rustfmt/clippy components.
set -euo pipefail

cd "$(dirname "$0")/../.."

RUST_IMAGE="docker.io/library/rust:1.97-slim@sha256:8e8cf8f7fd54a2d23d5a743b3a03f56e26b6c774276c33fa0595111704ebb15c"
CRATE=services/order-rules
CHECKS='cargo fmt --check && cargo clippy --locked --all-targets -- -D warnings && cargo test --locked'

if [ "${1:-}" = "--host" ]; then
	(cd "$CRATE" && bash -euo pipefail -c "$CHECKS")
else
	ENGINE="${CONTAINER_ENGINE:-$(command -v podman >/dev/null && echo podman || echo docker)}"
	"$ENGINE" run --rm \
		-v "$PWD/$CRATE:/work" \
		-v v10r-cargo-registry:/usr/local/cargo/registry \
		-v v10r-rustup:/usr/local/rustup \
		-e UPDATE_OPENAPI \
		-w /work \
		"$RUST_IMAGE" bash -euo pipefail -c "rustup component add rustfmt clippy >/dev/null && $CHECKS"
fi

sha() { sha256sum "$1" | cut -d' ' -f1; }
{
	printf '{\n\t"image": "%s",\n\t"checks": "%s",\n\t"inputs": {\n' "$RUST_IMAGE" "$CHECKS"
	inputs=("$CRATE/Cargo.lock" "$CRATE/Cargo.toml" "$CRATE/rust-toolchain.toml")
	while IFS= read -r file; do inputs+=("$file"); done < <(find "$CRATE/src" -type f | LC_ALL=C sort)
	last=$(( ${#inputs[@]} - 1 ))
	for i in "${!inputs[@]}"; do
		sep=','; [ "$i" = "$last" ] && sep=''
		printf '\t\t"%s": "%s"%s\n' "${inputs[$i]}" "$(sha "${inputs[$i]}")" "$sep"
	done
	printf '\t},\n\t"outputs": {\n\t\t"%s": "%s"\n\t}\n}\n' "$CRATE/openapi.json" "$(sha "$CRATE/openapi.json")"
} > "$CRATE/check-manifest.json"

echo "check: passed — wrote $CRATE/check-manifest.json"
