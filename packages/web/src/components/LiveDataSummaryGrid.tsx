import type { ReactNode } from 'react';

type Tone = 'blue' | 'amber' | 'green' | 'purple' | 'gray' | 'slate' | 'indigo' | 'red';

type SummaryItem = {
  key: string;
  label: string;
  value: ReactNode;
  tone: Tone;
  description?: string;
  onClick?: () => void;
  selected?: boolean;
  className?: string;
  valueClassName?: string;
  labelClassName?: string;
  descriptionClassName?: string;
};

type SummaryGridProps = {
  items: SummaryItem[];
  variant?: 'tiles' | 'pills';
  className?: string;
};

const TONE_CLASSES: Record<Tone, { bg: string; text: string; border: string; ring: string }> = {
  blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', ring: 'ring-blue-400' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', ring: 'ring-amber-400' },
  green: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', ring: 'ring-green-400' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', ring: 'ring-purple-400' },
  gray: { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200', ring: 'ring-gray-400' },
  slate: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', ring: 'ring-slate-400' },
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', ring: 'ring-indigo-400' },
  red: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', ring: 'ring-red-400' },
};

export function LiveDataSummaryGrid({ items, variant = 'tiles', className }: SummaryGridProps) {
  if (variant === 'pills') {
    return (
      <div className={className ?? 'flex flex-wrap items-center gap-2 text-xs'}>
        {items.map((item) => {
          const tone = TONE_CLASSES[item.tone];
          const sharedClass = [
            'inline-flex items-center gap-1.5 px-2 py-1 rounded-full font-medium transition-all',
            tone.bg,
            tone.text,
            item.selected ? `ring-2 ${tone.ring}` : '',
            item.onClick ? 'cursor-pointer hover:brightness-95' : '',
            item.className ?? '',
          ]
            .filter(Boolean)
            .join(' ');
          const content = (
            <>
              <span className={item.valueClassName}>{item.value}</span>
              <span className={item.labelClassName}>{item.label}</span>
            </>
          );

          if (item.onClick) {
            return (
              <button key={item.key} type="button" onClick={item.onClick} className={sharedClass}>
                {content}
              </button>
            );
          }

          return (
            <span key={item.key} className={sharedClass}>
              {content}
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <div className={className ?? 'grid grid-cols-2 md:grid-cols-4 gap-3'}>
      {items.map((item) => {
        const tone = TONE_CLASSES[item.tone];
        const sharedClass = [
          'text-center p-3 rounded-lg transition-all',
          tone.bg,
          tone.border,
          tone.text,
          item.onClick ? 'cursor-pointer' : '',
          item.selected ? `ring-2 ${tone.ring}` : '',
          item.className ?? '',
        ]
          .filter(Boolean)
          .join(' ');
        const body = (
          <>
            <div className={item.valueClassName ?? `text-lg font-bold ${tone.text}`}>{item.value}</div>
            <div className={item.labelClassName ?? `text-xs ${tone.text.replace('-700', '-600')}`}>{item.label}</div>
            {item.description && (
              <div className={item.descriptionClassName ?? 'text-[11px] text-gray-500 mt-1'}>
                {item.description}
              </div>
            )}
          </>
        );

        if (item.onClick) {
          return (
            <button key={item.key} type="button" onClick={item.onClick} className={sharedClass}>
              {body}
            </button>
          );
        }

        return (
          <div key={item.key} className={sharedClass}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

export type { SummaryItem as LiveDataSummaryItem };
