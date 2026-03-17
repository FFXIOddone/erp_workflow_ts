import { ReactNode, HTMLAttributes } from 'react';
import clsx from 'clsx';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
  className?: string;
}

const paddingClasses = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export function Card({ 
  children, 
  padding = 'md', 
  hover = false,
  className = '',
  ...props 
}: CardProps) {
  return (
    <div 
      className={clsx(
        'bg-white rounded-xl shadow-soft border border-gray-100',
        paddingClasses[padding],
        hover && 'transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-gray-200',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function CardHeader({ title, description, icon, actions, className = '' }: CardHeaderProps) {
  return (
    <div className={clsx('flex items-start justify-between mb-4', className)}>
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <h3 className="font-semibold text-gray-900">{title}</h3>
          {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

interface CardFooterProps {
  children: ReactNode;
  className?: string;
}

export function CardFooter({ children, className = '' }: CardFooterProps) {
  return (
    <div className={clsx('flex items-center justify-between pt-4 mt-4 border-t border-gray-100', className)}>
      {children}
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: {
    value: number;
    label: string;
    positive?: boolean;
  };
  color?: 'primary' | 'blue' | 'green' | 'amber' | 'red' | 'purple';
  onClick?: () => void;
}

const colorClasses = {
  primary: 'bg-primary-50 border-primary-100',
  blue: 'bg-blue-50 border-blue-100',
  green: 'bg-green-50 border-green-100',
  amber: 'bg-amber-50 border-amber-100',
  red: 'bg-red-50 border-red-100',
  purple: 'bg-purple-50 border-purple-100',
};

const iconColorClasses = {
  primary: 'from-primary-500 to-primary-600',
  blue: 'from-blue-500 to-blue-600',
  green: 'from-emerald-500 to-green-600',
  amber: 'from-amber-500 to-orange-500',
  red: 'from-red-500 to-red-600',
  purple: 'from-violet-500 to-purple-600',
};

export function StatCard({ title, value, icon, trend, color = 'primary', onClick }: StatCardProps) {
  const isClickable = Boolean(onClick);
  
  return (
    <div 
      className={clsx(
        'relative rounded-xl p-5 border transition-all duration-200',
        colorClasses[color],
        isClickable && 'cursor-pointer hover:shadow-md hover:-translate-y-0.5'
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              <span className={clsx(
                'text-xs font-medium',
                trend.positive ? 'text-green-600' : 'text-red-600'
              )}>
                {trend.positive ? '+' : ''}{trend.value}%
              </span>
              <span className="text-xs text-gray-400">{trend.label}</span>
            </div>
          )}
        </div>
        <div className={clsx(
          'p-2.5 rounded-xl bg-gradient-to-br text-white shadow-lg',
          iconColorClasses[color]
        )}>
          {icon}
        </div>
      </div>
    </div>
  );
}
