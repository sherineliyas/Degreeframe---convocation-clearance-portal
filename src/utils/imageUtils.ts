/**
 * Converts Google Drive view/share URLs into direct image URLs suitable for <img> tags.
 * Converts URLs like:
 * - https://drive.google.com/file/d/1-UrOfQfWmFWK9UP2ePxWATiGHtoEm8mw/view?usp=drivesdk
 * - https://drive.google.com/open?id=1-UrOfQfWmFWK9UP2ePxWATiGHtoEm8mw
 * into:
 * - https://lh3.googleusercontent.com/d/1-UrOfQfWmFWK9UP2ePxWATiGHtoEm8mw
 */
export function formatDriveImageUrl(url: string | undefined | null): string {
  if (!url || typeof url !== 'string') return '';
  const clean = url.trim();
  if (!clean) return '';

  // If it's already a base64 data URL, return as is
  if (clean.startsWith('data:image/')) return clean;

  // Extract Google Drive File ID
  let fileId = '';

  // Pattern 1: /file/d/FILE_ID/ or /file/d/FILE_ID
  const matchFileD = clean.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (matchFileD && matchFileD[1]) {
    fileId = matchFileD[1];
  } else {
    // Pattern 2: id=FILE_ID or ?id=FILE_ID
    const matchId = clean.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (matchId && matchId[1]) {
      fileId = matchId[1];
    }
  }

  if (fileId) {
    // googleusercontent direct link renders natively in <img> tags without CSP or viewer HTML blocks
    return `https://lh3.googleusercontent.com/d/${fileId}=s800`;
  }

  return clean;
}
