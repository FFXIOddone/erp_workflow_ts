import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface FullscreenPanelProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  maxWidthClassName?: string;
}

export function FullscreenPanel({
  open,
  title,
  subtitle,
  onClose,
  children,
  maxWidthClassName = 'max-w-[1600px]',
}: FullscreenPanelProps) {
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm p-3 sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`mx-auto flex h-full w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white shadow-2xl ${maxWidthClassName}`}
        onClick={(event) => event.stopPropagation()}
        role="presentation"
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
            aria-label={`Close ${title}`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-auto bg-gray-50/60">{children}</div>
      </div>
    </div>
  );
}
