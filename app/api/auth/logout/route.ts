import {
  clearSessionCookie,
  deleteSession,
  isSameOrigin,
  readSessionToken,
} from '../../../auth';

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return new Response('Forbidden', { status: 403 });
  await deleteSession(readSessionToken(request));
  return new Response(null, {
    status: 303,
    headers: {
      location: new URL('/login', request.url).toString(),
      'set-cookie': clearSessionCookie(request.url),
      'cache-control': 'no-store',
    },
  });
}
