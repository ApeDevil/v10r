/**
 * Server-side QR code generation. Returns SVG markup as a string — no DOM
 * dependency, safe to inline into responses.
 */
import QRCode from 'qrcode';

export async function qrSvg(text: string): Promise<string> {
	return QRCode.toString(text, {
		type: 'svg',
		errorCorrectionLevel: 'M',
		margin: 1,
		width: 240,
	});
}
