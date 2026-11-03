export type PortalRoute = 'student' | 'faculty' | 'coe' | 'superadmin';

export interface RouteState {
  portal: PortalRoute;
  subPath?: string;
  query?: Record<string, string>;
}

export function parseHash(hashString?: string): RouteState {
  const rawHash = hashString ?? window.location.hash;
  // Strip leading '#' and split query if any
  const clean = rawHash.replace(/^#\/?/, '');
  const [pathPart, queryPart] = clean.split('?');

  const segments = pathPart.toLowerCase().split('/').filter(Boolean);
  const mainSegment = segments[0] || '';
  const subPath = segments[1] || '';

  const query: Record<string, string> = {};
  if (queryPart) {
    const searchParams = new URLSearchParams(queryPart);
    searchParams.forEach((val, key) => {
      query[key] = val;
    });
  }

  let portal: PortalRoute = 'student';
  if (mainSegment === 'superadmin') {
    portal = 'superadmin';
  } else if (mainSegment === 'faculty') {
    portal = 'faculty';
  } else if (mainSegment === 'coe') {
    portal = 'coe';
  } else {
    portal = 'student';
  }

  return { portal, subPath, query };
}


export function navigateTo(portal: PortalRoute, subPath?: string) {
  if (subPath) {
    window.location.hash = `#/${portal}/${subPath}`;
  } else {
    window.location.hash = `#/${portal}`;
  }
}
