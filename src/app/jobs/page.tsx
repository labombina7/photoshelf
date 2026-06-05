import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import JobsClient from './JobsClient';

export default async function JobsPage() {
  const session = await getSession();
  if (!session.isLoggedIn) redirect('/login');
  return <JobsClient />;
}
