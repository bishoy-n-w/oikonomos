/**
 * Cross-platform Geolocation Utilities:
 * Parsing, GPS capture, normalization, and universal navigation URLs across Android, iOS, and Desktop.
 */

export interface GeoCoordinates {
  lat: number;
  lng: number;
}

/**
 * Extracts latitude and longitude from any map input:
 * - geo:30.0444,31.2357
 * - Raw "30.0444, 31.2357"
 * - WhatsApp shared location pins (maps.google.com/maps?q=loc:30.0444,31.2357)
 * - Google Maps web URLs (?q=, /@lat,lng, !3dlat!4dlng)
 * - Apple Maps URLs (?ll=, ?q=)
 * - Waze URLs (?ll=)
 */
export function parseGeoCoordinates(input?: string): GeoCoordinates | null {
  if (!input || typeof input !== 'string') return null;
  const str = input.trim();
  if (!str) return null;

  // 1. Check for "!3d<lat>!4d<lng>" (Google Maps desktop share URLs)
  const gmapsDataMatch = str.match(/!3d([-+]?\d+\.\d+)!4d([-+]?\d+\.\d+)/);
  if (gmapsDataMatch) {
    const lat = parseFloat(gmapsDataMatch[1]);
    const lng = parseFloat(gmapsDataMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  // 2. Check for "@<lat>,<lng>" (Google Maps path URLs)
  const gmapsPathMatch = str.match(/@([-+]?\d+\.\d+),\s*([-+]?\d+\.\d+)/);
  if (gmapsPathMatch) {
    const lat = parseFloat(gmapsPathMatch[1]);
    const lng = parseFloat(gmapsPathMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  // 3. Check for "q=loc:<lat>,<lng>" or "ll=<lat>,<lng>" or "query=<lat>,<lng>" or "q=<lat>,<lng>"
  const queryParamMatch = str.match(/(?:[?&](?:q=loc:|ll=|query=|q=))([-+]?\d+\.\d+),\s*([-+]?\d+\.\d+)/);
  if (queryParamMatch) {
    const lat = parseFloat(queryParamMatch[1]);
    const lng = parseFloat(queryParamMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  // 4. Check for "geo:<lat>,<lng>"
  const geoUriMatch = str.match(/geo:([-+]?\d+\.\d+),\s*([-+]?\d+\.\d+)/i);
  if (geoUriMatch) {
    const lat = parseFloat(geoUriMatch[1]);
    const lng = parseFloat(geoUriMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  // 5. Generic lat, lng coordinate pair (e.g. "30.0444, 31.2357")
  const genericMatch = str.match(/(?:^|[^\d.-])([-+]?\d+(?:\.\d+)?),\s*([-+]?\d+(?:\.\d+)?)(?:$|[^\d.-])/);
  if (genericMatch) {
    const lat = parseFloat(genericMatch[1]);
    const lng = parseFloat(genericMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  return null;
}

/**
 * Validates latitude (-90 to 90) and longitude (-180 to 180).
 */
export function isValidLatLng(lat: number, lng: number): boolean {
  return !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/**
 * Formats coordinates into standard Geo URI scheme: "geo:latitude,longitude".
 */
export function formatGeoUri(lat: number, lng: number): string {
  return `geo:${lat.toFixed(6)},${lng.toFixed(6)}`;
}

/**
 * Normalizes user input (link, coordinates, or Geo URI) into canonical "geo:lat,lng" if coordinates can be extracted,
 * or preserves valid web URLs (e.g. short maps.app.goo.gl links).
 */
export function normalizeGeoInput(input?: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  const coords = parseGeoCoordinates(trimmed);
  if (coords) {
    return formatGeoUri(coords.lat, coords.lng);
  }
  return trimmed;
}

/**
 * Generates an optimal turn-by-turn navigation URL based on user platform:
 * - Apple Maps for iPhone / iPad / Mac Safari
 * - Google Maps for Android and Desktop browsers
 * - Address search fallback if no coordinates exist
 */
export function getUniversalNavigationUrl(geoInput?: string, addressFallback?: string): string {
  const coords = parseGeoCoordinates(geoInput);

  if (coords) {
    const isApple = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/i.test(navigator.userAgent);
    if (isApple) {
      return `https://maps.apple.com/?daddr=${coords.lat},${coords.lng}&dirflg=d`;
    }
    return `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`;
  }

  if (geoInput && (geoInput.startsWith('http://') || geoInput.startsWith('https://'))) {
    return geoInput;
  }

  if (addressFallback && addressFallback.trim()) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressFallback.trim())}`;
  }

  return '';
}

/**
 * Captures high-accuracy GPS coordinates from the device hardware.
 */
export function captureDeviceGpsLocation(): Promise<{ lat: number; lng: number; geoUri: string }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation is not supported on this device/browser.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        resolve({
          lat,
          lng,
          geoUri: formatGeoUri(lat, lng),
        });
      },
      (error) => {
        let msg = 'Could not retrieve GPS location.';
        if (error.code === error.PERMISSION_DENIED) {
          msg = 'Location permission was denied. Please allow location access in your browser settings.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          msg = 'GPS location is currently unavailable.';
        } else if (error.code === error.TIMEOUT) {
          msg = 'GPS location request timed out.';
        }
        reject(new Error(msg));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
}
