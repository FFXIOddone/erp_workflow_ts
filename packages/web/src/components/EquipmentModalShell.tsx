import React, { type ReactNode } from 'react';
import { type LucideIcon, X } from 'lucide-react';

interface EquipmentModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  icon: LucideIcon;
  title: ReactNode;
  subtitle: ReactNode;
  headerActions?: ReactNode;
  footerLeft?: ReactNode;
  footerActions?: ReactNode;
  maxWidthClassName?: string;
  iconWrapperClassName?: string;
  iconClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
  children: ReactNode;
}

export function EquipmentModalShell({
  isOpen,
  onClose,
  icon: Icon,
  title,
  subtitle,
  headerActions,
  footerLeft,
  footerActions,
  maxWidthClassName = 'max-w-3xl',
  iconWrapperClassName = 'bg-sky-100',
  iconClassName = 'text-sky-600',
  bodyClassName = '',
  footerClassName = '',
  children,
}: EquipmentModalShellProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative bg-white rounded-xl shadow-2xl w-full ${maxWidthClassName} max-h-[85vh] flex flex-col animate-in fade-in zoom-in duration-200`}
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-2 rounded-lg ${iconWrapperClassName}`}>
              <Icon className={`h-5 w-5 ${iconClassName}`} />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-900 truncate">{title}</h2>
              <p className="text-sm text-gray-500 truncate">{subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {headerActions}
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className={`flex-1 overflow-y-auto p-5 ${bodyClassName}`}>{children}</div>

        <div className={`flex items-center justify-between px-5 py-3 border-t border-gray-200 bg-gray-50 rounded-b-xl ${footerClassName}`}>
          <div className="text-xs text-gray-400 flex items-center gap-1 min-w-0">
            {footerLeft}
          </div>
          <div className="flex items-center gap-2">
            {footerActions}
          </div>
        </div>
      </div>
    </div>
  );
}
