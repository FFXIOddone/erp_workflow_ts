import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  iconColor?: 'primary' | 'blue' | 'green' | 'purple' | 'amber' | 'red';
  badge?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}

const iconColors = {
  primary: 'from-primary-500 to-primary-600',
  blue: 'from-blue-500 to-blue-600',
  green: 'from-emerald-500 to-green-600',
  purple: 'from-violet-500 to-purple-600',
  amber: 'from-amber-500 to-orange-500',
  red: 'from-red-500 to-red-600',
};

export function PageHeader({ 
  title, 
  description, 
  icon: Icon, 
  iconColor = 'primary',
  badge,
  actions,
  children 
}: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div className="flex items-center gap-4">
        {Icon && (
          <div className={`p-3 rounded-xl bg-gradient-to-br ${iconColors[iconColor]} text-white shadow-lg`}>
            <Icon className="h-6 w-6" />
          </div>
        )}
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            {badge}
          </div>
          {description && (
            <p className="text-sm text-gray-500 mt-0.5">{description}</p>
          )}
        </div>
      </div>
      {(actions || children) && (
        <div className="flex items-center gap-3">
          {actions}
          {children}
        </div>
      )}
    </div>
  );
}

interface PageSectionProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function PageSection({ title, description, actions, children, className = '' }: PageSectionProps) {
  return (
    <section className={`bg-white rounded-xl shadow-soft border border-gray-100 ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            {title && <h2 className="text-lg font-semibold text-gray-900">{title}</h2>}
            {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
