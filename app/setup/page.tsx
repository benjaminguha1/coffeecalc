import { redirect } from 'next/navigation';
import { hasUsers } from '../auth';

export const dynamic = 'force-dynamic';

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await hasUsers()) redirect('/login');
  const { error } = await searchParams;

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="setup-title">
        <p className="auth-eyebrow">CoffeeCalc · First-time setup</p>
        <h1 id="setup-title">Create the owner account</h1>
        <p className="auth-intro">
          This first account can add and manage other staff members.
        </p>
        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : null}
        <form className="auth-form" action="/api/auth/setup" method="post">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            name="username"
            type="text"
            minLength={3}
            maxLength={40}
            pattern="[A-Za-z0-9._-]+"
            autoComplete="username"
            autoCapitalize="none"
            required
          />
          <label htmlFor="email">
            Email address <span>optional</span>
          </label>
          <input id="email" name="email" type="email" autoComplete="email" />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            minLength={10}
            maxLength={128}
            autoComplete="new-password"
            required
          />
          <small>Use at least 10 characters.</small>
          <label htmlFor="confirmPassword">Confirm password</label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            minLength={10}
            maxLength={128}
            autoComplete="new-password"
            required
          />
          <button className="button button-primary button-large" type="submit">
            Create owner account
          </button>
        </form>
      </section>
    </main>
  );
}
