import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getUserForToken, hasUsers, SESSION_COOKIE } from './auth';
import CalculatorClient from './calculator-client';

export const dynamic = 'force-dynamic';

export default async function Home() {
  if (!(await hasUsers())) redirect('/setup');

  const token = (await cookies()).get(SESSION_COOKIE)?.value ?? null;
  const user = await getUserForToken(token);
  if (!user) redirect('/login');

  return <CalculatorClient username={user.username} role={user.role} />;
}
