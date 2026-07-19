import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getUserForToken, hasUsers, SESSION_COOKIE } from '../auth';

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!(await hasUsers())) redirect('/setup');
  const token = (await cookies()).get(SESSION_COOKIE)?.value ?? null;
  if (await getUserForToken(token)) redirect('/');
  const { error } = await searchParams;

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="login-title">
        <p className="auth-eyebrow">Josie Coffee · Staff</p>
        <h1 id="login-title">Sign in to CoffeeCalc</h1>
        <p className="auth-intro">Use your staff username or email address.</p>
        {error ? (
          <p className="auth-error" role="alert">
            {error === 'locked'
              ? 'Too many attempts. Wait 15 minutes and try again.'
              : 'Username/email or password is incorrect.'}
          </p>
        ) : null}
        <form className="auth-form" action="/api/auth/login" method="post">
          <label htmlFor="identifier">Username or email</label>
          <input
            id="identifier"
            name="identifier"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            required
          />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
          <button className="button button-primary button-large" type="submit">
            Sign in
          </button>
        </form>
      </section>
    </main>
  );
}
