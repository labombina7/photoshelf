import { redirect } from 'next/navigation';

// Redirige a la nueva ubicación en /settings/tools
export default function IntegrityPage() {
  redirect('/settings/tools');
}
