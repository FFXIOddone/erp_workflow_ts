import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface CollapsibleSectionProps {
  title: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  subtitle?: string;
  defaultOpen?: boolean;
  /** If true, always visible even when collapsed */
  warningContent?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function CollapsibleSection({
  title,
  icon,
  badge,
  subtitle,
  defaultOpen = false,
  warningContent,
  children,
  className = '',
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
      {/* Header — always clickable */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors rounded-lg text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          {icon}
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              {title}
              {badge}
            </h2>
            {subtitle && (
              <p className="text-xs text-gray-400 mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
          {!isOpen && warningContent && (
            <span className="text-xs text-amber-600 font-medium">warnings below</span>
          )}
          {isOpen
            ? <ChevronUp className="h-5 w-5 text-gray-400" />
            : <ChevronDown className="h-5 w-5 text-gray-400" />}
        </div>
      </button>

      {/* Warning content — always visible when collapsed and has warnings */}
      {!isOpen && warningContent && (
        <div className="px-5 pb-4 -mt-1">
          {warningContent}
        </div>
      )}

      {/* Full content — only when expanded */}
      {isOpen && (
        <div className="px-5 pb-5 -mt-1">
          {children}
        </div>
      )}
    </div>
  );
}
