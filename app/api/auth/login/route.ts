import {
  authenticate,
  createSession,
  isSameOrigin,
  sessionCookie,
} from '../../../auth';

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return new Response('Forbidden', { status: 403 });
  const form = await request.formData();
  const identifier = String(form.get('identifier') ?? '').slice(0, 254);
  const password = String(form.get('password') ?? '').slice(0, 128);
  const user = await authenticate(request, identifier, password);
  if (!user) {
    return Response.redirect(new URL('/login?error=invalid', request.url), 303);
  }
  const token = await createSession(user.id);
  return new Response(null, {
    status: 303,
    headers: {
      location: new URL('/', request.url).toString(),
      'set-cookie': sessionCookie(token, request.url),
      'cache-control': 'no-store',
    },
  });
}
