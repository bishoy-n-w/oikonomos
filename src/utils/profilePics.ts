/**
 * Profile picture compression and processing utilities.
 * Compresses images client-side into lightweight WebP/JPEG base64 data URLs (~3KB - 6KB).
 */

export interface CompressionOptions {
  size?: number; // Target square dimension (default 128px)
  quality?: number; // 0.1 to 1.0 (default 0.7)
}

/**
 * Compresses an image File or Blob into a square cropped, compressed base64 data URL.
 */
export async function compressProfileImage(
  source: Blob | File | string,
  options: CompressionOptions = {}
): Promise<string> {
  const targetSize = options.size || 128;
  const quality = options.quality ?? 0.7;

  return new Promise((resolve, reject) => {
    // If running in an environment without DOM (like Node without canvas), handle gracefully
    if (typeof document === 'undefined' || typeof Image === 'undefined') {
      if (typeof source === 'string') return resolve(source);
      return resolve('');
    }

    let isSettled = false;
    const timeout = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        if (typeof source === 'string') resolve(source);
        else resolve('');
      }
    }, 500);

    const img = new Image();

    img.onload = () => {
      if (isSettled) return;
      isSettled = true;
      clearTimeout(timeout);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = targetSize;
        canvas.height = targetSize;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Could not get 2D canvas context'));
          return;
        }

        // Calculate center square crop
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        const minDim = Math.min(width, height);
        const sx = (width - minDim) / 2;
        const sy = (height - minDim) / 2;

        ctx.drawImage(
          img,
          sx,
          sy,
          minDim,
          minDim,
          0,
          0,
          targetSize,
          targetSize
        );

        // Try WebP first (modern, highest compression)
        let dataUrl = canvas.toDataURL('image/webp', quality);
        if (!dataUrl.startsWith('data:image/webp')) {
          // Fallback to JPEG
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        resolve(dataUrl);
      } catch (err) {
        reject(err);
      } finally {
        if (typeof source !== 'string') {
          URL.revokeObjectURL(img.src);
        }
      }
    };

    img.onerror = () => {
      if (isSettled) return;
      isSettled = true;
      clearTimeout(timeout);
      reject(new Error('Failed to load image for processing'));
    };

    if (typeof source === 'string') {
      img.src = source;
    } else {
      img.src = URL.createObjectURL(source);
    }
  });
}

/**
 * Extracts raw base64 string from a Data URL for APIs like Google People API.
 */
export function extractBase64Payload(dataUrl?: string): string {
  if (!dataUrl || !dataUrl.includes(',')) return '';
  return dataUrl.split(',')[1] || '';
}

/**
 * Generates an accessible fallback avatar with the person's initials.
 */
export function getInitials(name?: string): string {
  if (!name || !name.trim()) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
