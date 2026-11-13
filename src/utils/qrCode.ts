import QRCode from 'qrcode';

/**
 * Generates a high-contrast Base64 PNG Data URL for a given text payload.
 * Optimized with Medium (M) error correction level for fast scanning.
 */
export async function generateQrDataUrl(text: string): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      width: 256,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#18181b',
        light: '#ffffff',
      },
    });
  } catch (err) {
    console.error('Failed to generate QR code:', err);
    return '';
  }
}

/**
 * Builds the compact, privacy-first URI scheme for student attendance.
 * Payload: oik://k/{churchId}/{kidId}
 */
export function buildKidQrPayload(churchId: string, kidId: string): string {
  const cleanChurch = encodeURIComponent(churchId.trim());
  const cleanKid = encodeURIComponent(kidId.trim());
  return `oik://k/${cleanChurch}/${cleanKid}`;
}

/**
 * Parses a scanned QR code text into churchId and kidId.
 * Supports standard oik://k/{churchId}/{kidId} and fallback raw kid IDs.
 */
export function parseKidQrPayload(payload: string): { churchId?: string; kidId: string } | null {
  if (!payload) return null;
  const trimmed = payload.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('oik://k/')) {
    const raw = trimmed.replace('oik://k/', '');
    const parts = raw.split('/');
    if (parts.length >= 2) {
      return {
        churchId: decodeURIComponent(parts[0]),
        kidId: decodeURIComponent(parts[1]),
      };
    } else if (parts.length === 1) {
      return {
        kidId: decodeURIComponent(parts[0]),
      };
    }
  }
  // Fallback for direct kid document ID
  return { kidId: trimmed };
}
