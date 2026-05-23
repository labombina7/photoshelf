import Link from 'next/link';

interface EmptyStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: EmptyStateAction;
}

export default function EmptyState({ icon, title, subtitle, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-state-icon" aria-hidden="true">{icon}</div>}
      <p className="empty-state-title">{title}</p>
      {subtitle && <p className="empty-state-subtitle">{subtitle}</p>}
      {action && (
        action.href ? (
          <Link href={action.href} className="empty-state-action">
            {action.label}
          </Link>
        ) : (
          <button className="empty-state-action" onClick={action.onClick}>
            {action.label}
          </button>
        )
      )}
    </div>
  );
}
