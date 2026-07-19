import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getUserForToken, listUsers, SESSION_COOKIE } from '../auth';

export const dynamic = 'force-dynamic';

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value ?? null;
  const currentUser = await getUserForToken(token);
  if (!currentUser) redirect('/login');
  if (currentUser.role !== 'admin') redirect('/');

  const users = await listUsers();
  const { error, saved } = await searchParams;

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="auth-eyebrow">CoffeeCalc administration</p>
          <h1>Staff access</h1>
        </div>
        <a className="button button-secondary" href="/">
          Back to calculator
        </a>
      </header>

      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="auth-success" role="status">
          Staff access updated.
        </p>
      ) : null}

      <section className="admin-panel" aria-labelledby="add-staff-title">
        <h2 id="add-staff-title">Add staff member</h2>
        <form
          className="admin-add-form"
          action="/api/admin/users"
          method="post"
        >
          <input type="hidden" name="action" value="create" />
          <div>
            <label htmlFor="username">Username</label>
            <input
              id="username"
              name="username"
              required
              minLength={3}
              maxLength={40}
              pattern="[A-Za-z0-9._-]+"
            />
          </div>
          <div>
            <label htmlFor="email">
              Email <span>optional</span>
            </label>
            <input id="email" name="email" type="email" />
          </div>
          <div>
            <label htmlFor="password">Temporary password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={10}
              maxLength={128}
              autoComplete="new-password"
            />
          </div>
          <button className="button button-primary" type="submit">
            Add staff member
          </button>
        </form>
      </section>

      <section className="admin-panel" aria-labelledby="current-staff-title">
        <h2 id="current-staff-title">Current accounts</h2>
        <div className="staff-list">
          {users.map((user) => (
            <article className="staff-row" key={user.id}>
              <div className="staff-details">
                <strong>{user.username}</strong>
                <span>{user.email || 'No email address'}</span>
                <small>
                  {user.role === 'admin'
                    ? 'Owner'
                    : user.active
                      ? 'Active'
                      : 'Disabled'}
                </small>
              </div>
              {user.role === 'staff' ? (
                <div className="staff-actions">
                  <form action="/api/admin/users" method="post">
                    <input
                      type="hidden"
                      name="action"
                      value={user.active ? 'deactivate' : 'activate'}
                    />
                    <input type="hidden" name="userId" value={user.id} />
                    <button className="button button-secondary" type="submit">
                      {user.active ? 'Disable' : 'Enable'}
                    </button>
                  </form>
                  <form
                    className="password-reset"
                    action="/api/admin/users"
                    method="post"
                  >
                    <input type="hidden" name="action" value="reset-password" />
                    <input type="hidden" name="userId" value={user.id} />
                    <label className="sr-only" htmlFor={`password-${user.id}`}>
                      New password for {user.username}
                    </label>
                    <input
                      id={`password-${user.id}`}
                      name="password"
                      type="password"
                      placeholder="New password"
                      minLength={10}
                      maxLength={128}
                      required
                      autoComplete="new-password"
                    />
                    <button className="button button-secondary" type="submit">
                      Reset
                    </button>
                  </form>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
