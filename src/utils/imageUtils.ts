export const DEFAULT_AVATAR_SVG =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='150' height='180' viewBox='0 0 150 180' fill='%23f1f5f9'><rect width='150' height='180' rx='12' fill='%23f1f5f9'/><circle cx='75' cy='65' r='30' fill='%23cbd5e1'/><path d='M30 150 C30 115 50 105 75 105 C100 105 120 115 120 150 Z' fill='%23cbd5e1'/><text x='75' y='168' text-anchor='middle' font-family='sans-serif' font-size='10' font-weight='600' fill='%2394a3b8'>Student Photo</text></svg>";

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
 * Routes via the backend proxy (/api/drive/photo/:fileId) which downloads from Google Drive
 * without CORS, Referrer, or CSP issues.
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
      return `https://degreeframe-hits-portal.onrender.com/api/drive/photo/${fileId}`;
    }
    return `/api/drive/photo/${fileId}`;
  }

  return clean;
}

