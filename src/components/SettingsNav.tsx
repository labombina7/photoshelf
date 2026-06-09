'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const SECTIONS = [
  { href: '/settings/general',  label: 'General' },
  { href: '/settings/catalogs', label: 'Catálogos' },
  { href: '/settings/ai',       label: 'IA' },
];

export default function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav style={{
      display: 'flex',
      gap: 2,
      borderBottom: '1px solid var(--border)',
      marginBottom: 28,
    }}>
      {SECTIONS.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(href + '/');
        return (
          <Link
            key={href}
            href={href}
            style={{
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: active ? 600 : 400,
              color: active ? 'var(--accent)' : 'var(--text-secondary)',
              borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -1,
              textDecoration: 'none',
              transition: 'color 0.1s',
            }}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
