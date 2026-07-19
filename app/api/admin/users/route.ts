import {
  createUser,
  getUserForRequest,
  isSameOrigin,
  resetPassword,
  setUserActive,
} from '../../../auth';

function redirectToAdmin(
  request: Request,
  key: 'error' | 'saved',
  value: string,
) {
  return Response.redirect(
    new URL(`/admin?${key}=${encodeURIComponent(value)}`, request.url),
    303,
  );
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return new Response('Forbidden', { status: 403 });
  const currentUser = await getUserForRequest(request);
  if (!currentUser) return new Response('Unauthorised', { status: 401 });
  if (currentUser.role !== 'admin')
    return new Response('Forbidden', { status: 403 });

  const form = await request.formData();
  const action = String(form.get('action') ?? '');
  const userId = String(form.get('userId') ?? '');
  try {
    if (action === 'create') {
      await createUser({
        username: String(form.get('username') ?? ''),
        email: String(form.get('email') ?? ''),
        password: String(form.get('password') ?? ''),
        role: 'staff',
      });
    } else if (action === 'activate' || action === 'deactivate') {
      await setUserActive(userId, action === 'activate');
    } else if (action === 'reset-password') {
      await resetPassword(userId, String(form.get('password') ?? ''));
    } else {
      throw new Error('Unknown account action.');
    }
    return redirectToAdmin(request, 'saved', '1');
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Account update failed.';
    return redirectToAdmin(request, 'error', message);
  }
}
