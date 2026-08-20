#!/usr/bin/env bash
# Compile crates/kernel → vendored artifacts in src/lib/wasm/kernel/.
#
# Runs in an ephemeral Rust container so the v10r dev container stays Rust-free
# and `bun run validate` never needs a Rust toolchain. The output is COMMITTED —
# build-manifest.json included: kernel-manifest.test.ts recomputes its hashes and
# fails the gate when the crate sources and the committed artifacts drift apart.
# Rebuild only when crates/kernel changes, then commit the regenerated files.
#
# Reproducibility pins (change together): RUST_IMAGE below — digest-pinned; the
# tag part is a mutable alias kept for readability only — plus
# crates/kernel/rust-toolchain.toml, crates/kernel/Cargo.lock, and
# BINDGEN_VERSION, which must equal the wasm-bindgen version in Cargo.toml (the
# CLI hard-errors on any mismatch). The digest is the multi-platform manifest
# digest; x86_64 is the canonical build architecture.
#
# Named volumes cache the crate registry and the compiled wasm-bindgen-cli, so
# only the first ever run pays the ~minutes of CLI compilation.
set -euo pipefail

cd "$(dirname "$0")/../.."

RUST_IMAGE="docker.io/library/rust:1.97-slim@sha256:8e8cf8f7fd54a2d23d5a743b3a03f56e26b6c774276c33fa0595111704ebb15c"
BINDGEN_VERSION="0.2.127"

podman run --rm \
	-v "$PWD:/work" \
	-v v10r-cargo-registry:/usr/local/cargo/registry \
	-v v10r-wasm-tools:/tools \
	-w /work/crates/kernel \
	"$RUST_IMAGE" bash -euo pipefail -c "
		cargo build --release --target wasm32-unknown-unknown

		if [ \"\$(/tools/bin/wasm-bindgen --version 2>/dev/null || true)\" != 'wasm-bindgen $BINDGEN_VERSION' ]; then
			cargo install wasm-bindgen-cli --version '$BINDGEN_VERSION' --locked --root /tools
		fi

		/tools/bin/wasm-bindgen --target web \
			--out-dir /work/src/lib/wasm/kernel --out-name kernel \
			target/wasm32-unknown-unknown/release/v10r_kernel.wasm
	"

# Freshness manifest: hashes of everything that determines the artifacts, plus
# the artifacts themselves. It proves "current files == files present when this
# script last ran" — it cannot prove the binary semantically implements lib.rs;
# byte-diffing a container rebuild is the stronger, slower check and stays manual.
sha() { sha256sum "$1" | cut -d' ' -f1; }
cat > src/lib/wasm/kernel/build-manifest.json <<EOF
{
	"image": "$RUST_IMAGE",
	"bindgenVersion": "$BINDGEN_VERSION",
	"inputs": {
		"crates/kernel/Cargo.lock": "$(sha crates/kernel/Cargo.lock)",
		"crates/kernel/Cargo.toml": "$(sha crates/kernel/Cargo.toml)",
		"crates/kernel/rust-toolchain.toml": "$(sha crates/kernel/rust-toolchain.toml)",
		"crates/kernel/src/lib.rs": "$(sha crates/kernel/src/lib.rs)"
	},
	"outputs": {
		"kernel.d.ts": "$(sha src/lib/wasm/kernel/kernel.d.ts)",
		"kernel.js": "$(sha src/lib/wasm/kernel/kernel.js)",
		"kernel_bg.wasm": "$(sha src/lib/wasm/kernel/kernel_bg.wasm)",
		"kernel_bg.wasm.d.ts": "$(sha src/lib/wasm/kernel/kernel_bg.wasm.d.ts)"
	}
}
EOF

ls -l src/lib/wasm/kernel/
