import {
  createInitialAdmin,
  createSession,
  isSameOrigin,
  sessionCookie,
} from '../../../auth';

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return new Response('Forbidden', { status: 403 });
  const form = await request.formData();
  const username = String(form.get('username') ?? '');
  const email = String(form.get('email') ?? '');
  const password = String(form.get('password') ?? '');
  const confirmPassword = String(form.get('confirmPassword') ?? '');
  if (password !== confirmPassword) {
    return Response.redirect(
      new URL('/setup?error=Passwords%20do%20not%20match.', request.url),
      303,
    );
  }
  try {
    const userId = await createInitialAdmin({ username, email, password });
    const token = await createSession(userId);
    return new Response(null, {
      status: 303,
      headers: {
        location: new URL('/', request.url).toString(),
        'set-cookie': sessionCookie(token, request.url),
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Setup failed.';
    return Response.redirect(
      new URL(`/setup?error=${encodeURIComponent(message)}`, request.url),
      303,
    );
  }
}
