export const DEFAULT_AVATAR_SVG =
  'data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20150%20180%22%20width%3D%22150%22%20height%3D%22180%22%3E%3Crect%20width%3D%22150%22%20height%3D%22180%22%20rx%3D%2212%22%20fill%3D%22%23f1f5f9%22%2F%3E%3Ccircle%20cx%3D%2275%22%20cy%3D%2262%22%20r%3D%2228%22%20fill%3D%22%23cbd5e1%22%2F%3E%3Cpath%20d%3D%22M32%20148%20C32%20112%2050%20102%2075%20102%20C100%20102%20118%20112%20118%20148%20Z%22%20fill%3D%22%23cbd5e1%22%2F%3E%3Ctext%20x%3D%2275%22%20y%3D%22166%22%20text-anchor%3D%22middle%22%20font-family%3D%22system-ui%2C%20sans-serif%22%20font-size%3D%2210%22%20font-weight%3D%22600%22%20fill%3D%22%2394a3b8%22%3EStudent%20Photo%3C%2Ftext%3E%3C%2Fsvg%3E';

/**
 * Extracts Google Drive File ID from various URL patterns.
 */
export function extractDriveFileId(url: string | undefined | null): string {
  if (!url || typeof url !== 'string') return '';
  const clean = url.trim();
  if (!clean || clean.startsWith('data:image/')) return '';

  const matchFileD = clean.match(/\/(?:file\/)?d\/([a-zA-Z0-9_-]+)/);
  if (matchFileD && matchFileD[1]) return matchFileD[1];

  const matchId = clean.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (matchId && matchId[1]) return matchId[1];

  if (/^[a-zA-Z0-9_-]{25,45}$/.test(clean)) return clean;

  return '';
}

/**
 * Converts Google Drive view/share URLs into direct image URLs suitable for <img> tags.
 * Prefers the backend image proxy (/api/drive/photo/:fileId) on local/express server,
 * or direct Google Drive thumbnail CDN on external static deployments.
 */
export function formatDriveImageUrl(url: string | undefined | null): string {
  if (!url || typeof url !== 'string') return DEFAULT_AVATAR_SVG;
  const clean = url.trim();
  if (!clean) return DEFAULT_AVATAR_SVG;

  // If already base64 data URL, return directly
  if (clean.startsWith('data:image/')) return clean;

  const fileId = extractDriveFileId(clean);
  if (fileId) {
    if (typeof window !== 'undefined' && window.location.hostname.endsWith('github.io')) {
      // Direct thumbnail CDN avoids cold-start delays on external static hosts
      return `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
    }
    return `/api/drive/photo/${fileId}`;
  }

  return clean;
}

/**
 * Bulletproof cascading error handler for passport photos.
 * Ensures that an <img> tag will NEVER display a broken image icon.
 * Step 1: Try Google Drive Thumbnail CDN
 * Step 2: Try Google direct CDN lh3
 * Step 3: Permanently fall back to pristine SVG portrait placeholder
 */
export function handlePassportImageError(
  e: React.SyntheticEvent<HTMLImageElement>,
  originalUrl?: string | null
) {
  const img = e.currentTarget;
  const fid = extractDriveFileId(originalUrl || img.src);
  const step = Number(img.dataset.step || '0');

  if (fid && step === 0) {
    img.dataset.step = '1';
    img.src = `https://drive.google.com/thumbnail?id=${fid}&sz=w800`;
  } else if (fid && step === 1) {
    img.dataset.step = '2';
    img.src = `https://lh3.googleusercontent.com/d/${fid}=s800`;
  } else {
    img.onerror = null;
    img.src = DEFAULT_AVATAR_SVG;
  }
}


