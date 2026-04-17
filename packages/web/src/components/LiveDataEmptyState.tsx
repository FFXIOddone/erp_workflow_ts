import React, { type ReactNode } from 'react';
import { type LucideIcon } from 'lucide-react';

export interface LiveDataEmptyCopy {
  title: string;
  description: string;
}

export function buildLiveDataEmptyCopy(itemLabel: string, filtered = false): LiveDataEmptyCopy {
  const label = itemLabel.trim();
  if (filtered) {
    return {
      title: `No ${label} match your filters`,
      description: 'Try clearing search or filters to see more results.',
    };
  }

  return {
    title: `No ${label} available yet`,
    description: 'Equipment data will appear here once the machine starts reporting.',
  };
}

interface LiveDataEmptyStateProps extends LiveDataEmptyCopy {
  icon: LucideIcon;
  action?: ReactNode;
  className?: string;
}

export function LiveDataEmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = '',
}: LiveDataEmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-6 text-center text-gray-400 ${className}`}>
      <Icon className="h-8 w-8 mx-auto mb-2 opacity-50" />
      <p className="text-sm font-medium text-gray-600">{title}</p>
      <p className="text-xs text-gray-400 mt-1 max-w-md">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
