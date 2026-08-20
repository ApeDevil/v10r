//! The Rust half of /showcases/wasm.
//!
//! Every algorithm here has a line-for-line JS twin in `src/lib/wasm/filters.ts`.
//! Integer math only (and exactly-representable floats in the scale demo), so both
//! engines produce byte-identical output from identical work — the showcase proves
//! it with checksums, and `src/lib/wasm/kernel-parity.test.ts` gates it in vitest.
//! Change an algorithm on the JS side and the parity test goes red; change this
//! file and `kernel-manifest.test.ts` goes red until the artifact is rebuilt —
//! parity alone would keep passing against the stale committed binary.

use wasm_bindgen::prelude::*;

/// RGBA pixel buffer resident in wasm linear memory.
///
/// JS writes source pixels through a `Uint8Array` view over `pixels_ptr()` and the
/// filters take no data arguments — no per-call marshalling. The scratch buffer is
/// allocated up front so no filter call ever grows wasm memory: growth detaches
/// every outstanding JS view over `memory.buffer`, the classic zero-copy bug.
#[wasm_bindgen]
pub struct PixelKernel {
    width: u32,
    height: u32,
    pixels: Vec<u8>,
    scratch: Vec<u8>,
}

#[wasm_bindgen]
impl PixelKernel {
    #[wasm_bindgen(constructor)]
    pub fn new(width: u32, height: u32) -> PixelKernel {
        let len = (width as usize) * (height as usize) * 4;
        PixelKernel {
            width,
            height,
            pixels: vec![0; len],
            scratch: vec![0; len],
        }
    }

    /// The view taken over this pointer must be re-created after any call that can
    /// allocate (in this kernel: only the constructor) — a stale view over a grown
    /// memory reads a detached buffer.
    pub fn pixels_ptr(&mut self) -> *mut u8 {
        self.pixels.as_mut_ptr()
    }

    pub fn byte_len(&self) -> usize {
        self.pixels.len()
    }

    /// Integer-luma grayscale — the control workload. Three multiplies and a shift
    /// per pixel is memory-bandwidth-bound; the JS JIT keeps pace, and the page
    /// says so. Weights are the Rec.601 luma coefficients scaled to /256.
    pub fn grayscale(&mut self) {
        for px in self.pixels.chunks_exact_mut(4) {
            let y = ((px[0] as u32) * 77 + (px[1] as u32) * 151 + (px[2] as u32) * 28) >> 8;
            let y = y as u8;
            px[0] = y;
            px[1] = y;
            px[2] = y;
        }
    }

    /// Direct 2D box blur, (2r+1)² taps per pixel — the hero workload. Deliberately
    /// the dense direct form, not the separable/sliding-window O(1) trick: the
    /// showcase's independent variable is the language, not the algorithm, and the
    /// JS twin runs these exact loops. Edge handling is clamp-to-edge, so the tap
    /// count is constant and the integer division is exact in both engines.
    pub fn box_blur(&mut self, radius: u32) {
        let w = self.width as i32;
        let h = self.height as i32;
        let r = radius as i32;
        let taps = ((2 * r + 1) * (2 * r + 1)) as u32;

        for y in 0..h {
            for x in 0..w {
                let mut acc = [0u32; 4];
                for dy in -r..=r {
                    let sy = (y + dy).clamp(0, h - 1);
                    let row = (sy * w) as usize * 4;
                    for dx in -r..=r {
                        let sx = (x + dx).clamp(0, w - 1) as usize;
                        let i = row + sx * 4;
                        acc[0] += self.pixels[i] as u32;
                        acc[1] += self.pixels[i + 1] as u32;
                        acc[2] += self.pixels[i + 2] as u32;
                        acc[3] += self.pixels[i + 3] as u32;
                    }
                }
                let o = ((y * w + x) as usize) * 4;
                self.scratch[o] = (acc[0] / taps) as u8;
                self.scratch[o + 1] = (acc[1] / taps) as u8;
                self.scratch[o + 2] = (acc[2] / taps) as u8;
                self.scratch[o + 3] = (acc[3] / taps) as u8;
            }
        }
        std::mem::swap(&mut self.pixels, &mut self.scratch);
    }
}

/// The deliberate counter-example: `&[f32]` in, `Vec<f32>` out means wasm-bindgen
/// copies the whole array into linear memory on every call and copies the result
/// back out. For one multiply per element the copies dwarf the compute and plain
/// JS wins — which is the lesson, so do not "fix" this function.
#[wasm_bindgen]
pub fn scale_copied(data: &[f32], factor: f32) -> Vec<f32> {
    data.iter().map(|v| v * factor).collect()
}

/// The residency fix for `scale_copied`: data lives in wasm memory, JS writes it
/// once through a view, and each call crosses the boundary with two scalars.
#[wasm_bindgen]
pub struct FloatKernel {
    data: Vec<f32>,
}

#[wasm_bindgen]
impl FloatKernel {
    #[wasm_bindgen(constructor)]
    pub fn new(len: usize) -> FloatKernel {
        FloatKernel {
            data: vec![0.0; len],
        }
    }

    /// Same re-view rule as `PixelKernel::pixels_ptr`.
    pub fn ptr(&mut self) -> *mut f32 {
        self.data.as_mut_ptr()
    }

    pub fn len(&self) -> usize {
        self.data.len()
    }

    pub fn scale(&mut self, factor: f32) {
        for v in self.data.iter_mut() {
            *v *= factor;
        }
    }
}
