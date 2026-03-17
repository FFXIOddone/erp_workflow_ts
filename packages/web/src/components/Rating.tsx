/**
 * Rating.tsx
 * CRITICAL-46: Rating and review components
 *
 * Comprehensive rating system with star ratings, thumbs up/down,
 * emoji ratings, and review aggregation displays.
 *
 * @module Rating
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  forwardRef,
  type ReactNode,
  type HTMLAttributes,
} from 'react';
import clsx from 'clsx';
import {
  Star,
  ThumbsUp,
  ThumbsDown,
  Heart,
  Smile,
  Meh,
  Frown,
  X,
  Check,
  HelpCircle,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export type RatingSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type RatingColor = 'yellow' | 'red' | 'blue' | 'green' | 'purple' | 'orange';

export interface RatingValue {
  value: number;
  max: number;
}

export interface Review {
  id: string;
  rating: number;
  title?: string;
  content?: string;
  author: {
    id: string;
    name: string;
    avatar?: string;
  };
  date: Date;
  helpful?: number;
  verified?: boolean;
  images?: string[];
}

export interface RatingDistribution {
  rating: number;
  count: number;
  percentage: number;
}

export interface RatingStats {
  average: number;
  total: number;
  distribution: RatingDistribution[];
  recommended?: number;
}

// ============================================================================
// Context
// ============================================================================

interface RatingContextValue {
  value: number;
  max: number;
  readonly: boolean;
  size: RatingSize;
  color: RatingColor;
  precision: number;
  onChange?: (value: number) => void;
  hoveredValue: number | null;
  setHoveredValue: (value: number | null) => void;
}

const RatingContext = createContext<RatingContextValue | null>(null);

function useRatingContext(): RatingContextValue {
  const context = useContext(RatingContext);
  if (!context) {
    throw new Error('Rating components must be used within a RatingProvider');
  }
  return context;
}

// ============================================================================
// Utilities
// ============================================================================

export function calculateAverage(ratings: number[]): number {
  if (ratings.length === 0) return 0;
  const sum = ratings.reduce((a, b) => a + b, 0);
  return Math.round((sum / ratings.length) * 10) / 10;
}

export function calculateDistribution(ratings: number[], max: number = 5): RatingDistribution[] {
  const counts: Record<number, number> = {};
  for (let i = 1; i <= max; i++) {
    counts[i] = 0;
  }
  
  ratings.forEach(rating => {
    const rounded = Math.round(rating);
    if (rounded >= 1 && rounded <= max) {
      counts[rounded]++;
    }
  });
  
  const total = ratings.length || 1;
  
  return Array.from({ length: max }, (_, i) => ({
    rating: max - i,
    count: counts[max - i],
    percentage: Math.round((counts[max - i] / total) * 100),
  }));
}

export function getRatingLabel(rating: number, max: number = 5): string {
  const percentage = rating / max;
  if (percentage >= 0.9) return 'Excellent';
  if (percentage >= 0.7) return 'Very Good';
  if (percentage >= 0.5) return 'Good';
  if (percentage >= 0.3) return 'Fair';
  return 'Poor';
}

export function formatRating(rating: number, precision: number = 1): string {
  return rating.toFixed(precision);
}

// ============================================================================
// Size and Color Maps
// ============================================================================

const SIZE_MAP: Record<RatingSize, { icon: string; gap: string; text: string }> = {
  xs: { icon: 'w-3 h-3', gap: 'gap-0.5', text: 'text-xs' },
  sm: { icon: 'w-4 h-4', gap: 'gap-1', text: 'text-sm' },
  md: { icon: 'w-5 h-5', gap: 'gap-1', text: 'text-base' },
  lg: { icon: 'w-6 h-6', gap: 'gap-1.5', text: 'text-lg' },
  xl: { icon: 'w-8 h-8', gap: 'gap-2', text: 'text-xl' },
};

const COLOR_MAP: Record<RatingColor, { filled: string; empty: string; text: string }> = {
  yellow: { filled: 'text-yellow-400', empty: 'text-gray-300', text: 'text-yellow-600' },
  red: { filled: 'text-red-500', empty: 'text-gray-300', text: 'text-red-600' },
  blue: { filled: 'text-blue-500', empty: 'text-gray-300', text: 'text-blue-600' },
  green: { filled: 'text-green-500', empty: 'text-gray-300', text: 'text-green-600' },
  purple: { filled: 'text-purple-500', empty: 'text-gray-300', text: 'text-purple-600' },
  orange: { filled: 'text-orange-500', empty: 'text-gray-300', text: 'text-orange-600' },
};

// ============================================================================
// StarRating Component
// ============================================================================

export interface StarRatingProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  value?: number;
  max?: number;
  readonly?: boolean;
  size?: RatingSize;
  color?: RatingColor;
  precision?: 0.5 | 1;
  showValue?: boolean;
  showLabel?: boolean;
  emptyIcon?: ReactNode;
  filledIcon?: ReactNode;
  halfIcon?: ReactNode;
  onChange?: (value: number) => void;
  name?: string;
}

export const StarRating = forwardRef<HTMLDivElement, StarRatingProps>(
  (
    {
      value = 0,
      max = 5,
      readonly = false,
      size = 'md',
      color = 'yellow',
      precision = 1,
      showValue = false,
      showLabel = false,
      emptyIcon,
      filledIcon,
      halfIcon,
      onChange,
      name,
      className,
      ...props
    },
    ref
  ) => {
    const [hoveredValue, setHoveredValue] = useState<number | null>(null);

    const displayValue = hoveredValue ?? value;
    const sizeStyles = SIZE_MAP[size];
    const colorStyles = COLOR_MAP[color];

    const handleClick = useCallback(
      (index: number, isHalf: boolean) => {
        if (readonly || !onChange) return;
        const newValue = isHalf && precision === 0.5 ? index + 0.5 : index + 1;
        onChange(newValue);
      },
      [readonly, onChange, precision]
    );

    const handleMouseMove = useCallback(
      (index: number, event: React.MouseEvent<HTMLButtonElement>) => {
        if (readonly) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const isHalf = precision === 0.5 && event.clientX < rect.left + rect.width / 2;
        setHoveredValue(isHalf ? index + 0.5 : index + 1);
      },
      [readonly, precision]
    );

    const handleMouseLeave = useCallback(() => {
      setHoveredValue(null);
    }, []);

    const renderStar = (index: number) => {
      const isFilled = displayValue >= index + 1;
      const isHalf = !isFilled && displayValue >= index + 0.5;

      const iconClass = clsx(
        sizeStyles.icon,
        'transition-colors duration-150',
        isFilled || isHalf ? colorStyles.filled : colorStyles.empty
      );

      const StarIcon = () => {
        if (isFilled) {
          return filledIcon ? <>{filledIcon}</> : <Star className={iconClass} fill="currentColor" />;
        }
        if (isHalf) {
          return halfIcon ? (
            <>{halfIcon}</>
          ) : (
            <div className="relative">
              <Star className={clsx(sizeStyles.icon, colorStyles.empty)} />
              <div className="absolute inset-0 overflow-hidden w-1/2">
                <Star className={clsx(sizeStyles.icon, colorStyles.filled)} fill="currentColor" />
              </div>
            </div>
          );
        }
        return emptyIcon ? <>{emptyIcon}</> : <Star className={iconClass} />;
      };

      if (readonly) {
        return (
          <span key={index} className="inline-flex">
            <StarIcon />
          </span>
        );
      }

      return (
        <button
          key={index}
          type="button"
          className="inline-flex focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const isHalf = precision === 0.5 && e.clientX < rect.left + rect.width / 2;
            handleClick(index, isHalf);
          }}
          onMouseMove={(e) => handleMouseMove(index, e)}
          onMouseLeave={handleMouseLeave}
          aria-label={`Rate ${index + 1} out of ${max}`}
        >
          <StarIcon />
        </button>
      );
    };

    return (
      <div
        ref={ref}
        className={clsx('inline-flex items-center', sizeStyles.gap, className)}
        role="group"
        aria-label={name || 'Rating'}
        {...props}
      >
        <div className={clsx('inline-flex', sizeStyles.gap)}>
          {Array.from({ length: max }, (_, i) => renderStar(i))}
        </div>
        {showValue && (
          <span className={clsx(sizeStyles.text, 'font-medium text-gray-700 ml-1')}>
            {formatRating(value)}
          </span>
        )}
        {showLabel && (
          <span className={clsx(sizeStyles.text, 'text-gray-500 ml-1')}>
            ({getRatingLabel(value, max)})
          </span>
        )}
      </div>
    );
  }
);

StarRating.displayName = 'StarRating';

// ============================================================================
// HeartRating Component
// ============================================================================

export interface HeartRatingProps extends Omit<StarRatingProps, 'emptyIcon' | 'filledIcon' | 'halfIcon'> {}

export const HeartRating = forwardRef<HTMLDivElement, HeartRatingProps>(
  ({ color = 'red', ...props }, ref) => {
    const sizeStyles = SIZE_MAP[props.size || 'md'];
    const colorStyles = COLOR_MAP[color];

    return (
      <StarRating
        ref={ref}
        color={color}
        emptyIcon={<Heart className={clsx(sizeStyles.icon, colorStyles.empty)} />}
        filledIcon={<Heart className={clsx(sizeStyles.icon, colorStyles.filled)} fill="currentColor" />}
        {...props}
      />
    );
  }
);

HeartRating.displayName = 'HeartRating';

// ============================================================================
// ThumbsRating Component
// ============================================================================

export type ThumbsValue = 'up' | 'down' | null;

export interface ThumbsRatingProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  value?: ThumbsValue;
  readonly?: boolean;
  size?: RatingSize;
  showCounts?: boolean;
  upCount?: number;
  downCount?: number;
  onChange?: (value: ThumbsValue) => void;
}

export const ThumbsRating = forwardRef<HTMLDivElement, ThumbsRatingProps>(
  (
    {
      value = null,
      readonly = false,
      size = 'md',
      showCounts = false,
      upCount = 0,
      downCount = 0,
      onChange,
      className,
      ...props
    },
    ref
  ) => {
    const sizeStyles = SIZE_MAP[size];

    const handleClick = useCallback(
      (thumb: 'up' | 'down') => {
        if (readonly || !onChange) return;
        onChange(value === thumb ? null : thumb);
      },
      [readonly, onChange, value]
    );

    const buttonClass = (active: boolean, isUp: boolean) =>
      clsx(
        'inline-flex items-center gap-1 px-2 py-1 rounded-md transition-colors',
        readonly ? 'cursor-default' : 'cursor-pointer hover:bg-gray-100',
        active
          ? isUp
            ? 'text-green-600 bg-green-50'
            : 'text-red-600 bg-red-50'
          : 'text-gray-500'
      );

    return (
      <div
        ref={ref}
        className={clsx('inline-flex items-center gap-2', className)}
        {...props}
      >
        <button
          type="button"
          className={buttonClass(value === 'up', true)}
          onClick={() => handleClick('up')}
          disabled={readonly}
          aria-label="Thumbs up"
          aria-pressed={value === 'up'}
        >
          <ThumbsUp className={sizeStyles.icon} fill={value === 'up' ? 'currentColor' : 'none'} />
          {showCounts && <span className={sizeStyles.text}>{upCount}</span>}
        </button>
        <button
          type="button"
          className={buttonClass(value === 'down', false)}
          onClick={() => handleClick('down')}
          disabled={readonly}
          aria-label="Thumbs down"
          aria-pressed={value === 'down'}
        >
          <ThumbsDown className={sizeStyles.icon} fill={value === 'down' ? 'currentColor' : 'none'} />
          {showCounts && <span className={sizeStyles.text}>{downCount}</span>}
        </button>
      </div>
    );
  }
);

ThumbsRating.displayName = 'ThumbsRating';

// ============================================================================
// EmojiRating Component
// ============================================================================

export type EmojiValue = 1 | 2 | 3 | 4 | 5 | null;

export interface EmojiRatingProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  value?: EmojiValue;
  readonly?: boolean;
  size?: RatingSize;
  showLabels?: boolean;
  onChange?: (value: EmojiValue) => void;
}

const EMOJI_OPTIONS: { value: EmojiValue; icon: typeof Smile; label: string; color: string }[] = [
  { value: 1, icon: Frown, label: 'Terrible', color: 'text-red-500' },
  { value: 2, icon: Frown, label: 'Bad', color: 'text-orange-500' },
  { value: 3, icon: Meh, label: 'Okay', color: 'text-yellow-500' },
  { value: 4, icon: Smile, label: 'Good', color: 'text-lime-500' },
  { value: 5, icon: Smile, label: 'Excellent', color: 'text-green-500' },
];

export const EmojiRating = forwardRef<HTMLDivElement, EmojiRatingProps>(
  (
    {
      value = null,
      readonly = false,
      size = 'md',
      showLabels = false,
      onChange,
      className,
      ...props
    },
    ref
  ) => {
    const sizeStyles = SIZE_MAP[size];

    return (
      <div
        ref={ref}
        className={clsx('inline-flex items-center', sizeStyles.gap, className)}
        role="radiogroup"
        aria-label="Rating"
        {...props}
      >
        {EMOJI_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isSelected = value === option.value;

          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              className={clsx(
                'flex flex-col items-center gap-1 p-2 rounded-lg transition-all',
                readonly ? 'cursor-default' : 'cursor-pointer hover:bg-gray-100',
                isSelected ? 'bg-gray-100 scale-110' : 'opacity-60 hover:opacity-100'
              )}
              onClick={() => !readonly && onChange?.(option.value)}
              disabled={readonly}
            >
              <Icon
                className={clsx(
                  sizeStyles.icon,
                  isSelected ? option.color : 'text-gray-400',
                  'transition-colors'
                )}
                fill={isSelected ? 'currentColor' : 'none'}
              />
              {showLabels && (
                <span className={clsx('text-xs', isSelected ? 'text-gray-700' : 'text-gray-400')}>
                  {option.label}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }
);

EmojiRating.displayName = 'EmojiRating';

// ============================================================================
// YesNoRating Component
// ============================================================================

export type YesNoValue = 'yes' | 'no' | 'maybe' | null;

export interface YesNoRatingProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  value?: YesNoValue;
  readonly?: boolean;
  size?: RatingSize;
  showMaybe?: boolean;
  labels?: { yes?: string; no?: string; maybe?: string };
  onChange?: (value: YesNoValue) => void;
}

export const YesNoRating = forwardRef<HTMLDivElement, YesNoRatingProps>(
  (
    {
      value = null,
      readonly = false,
      size = 'md',
      showMaybe = false,
      labels = { yes: 'Yes', no: 'No', maybe: 'Maybe' },
      onChange,
      className,
      ...props
    },
    ref
  ) => {
    const sizeStyles = SIZE_MAP[size];

    const options: { value: YesNoValue; icon: typeof Check; label: string; activeClass: string }[] = [
      { value: 'yes', icon: Check, label: labels.yes || 'Yes', activeClass: 'bg-green-100 text-green-700 border-green-300' },
      ...(showMaybe
        ? [{ value: 'maybe' as const, icon: HelpCircle, label: labels.maybe || 'Maybe', activeClass: 'bg-yellow-100 text-yellow-700 border-yellow-300' }]
        : []),
      { value: 'no', icon: X, label: labels.no || 'No', activeClass: 'bg-red-100 text-red-700 border-red-300' },
    ];

    return (
      <div
        ref={ref}
        className={clsx('inline-flex items-center gap-2', className)}
        role="radiogroup"
        aria-label="Rating"
        {...props}
      >
        {options.map((option) => {
          const Icon = option.icon;
          const isSelected = value === option.value;

          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              className={clsx(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all',
                readonly ? 'cursor-default' : 'cursor-pointer',
                isSelected ? option.activeClass : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
              )}
              onClick={() => !readonly && onChange?.(option.value)}
              disabled={readonly}
            >
              <Icon className={sizeStyles.icon} />
              <span className={sizeStyles.text}>{option.label}</span>
            </button>
          );
        })}
      </div>
    );
  }
);

YesNoRating.displayName = 'YesNoRating';

// ============================================================================
// NPS Rating Component (Net Promoter Score)
// ============================================================================

export interface NPSRatingProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  value?: number | null;
  readonly?: boolean;
  showLabels?: boolean;
  onChange?: (value: number) => void;
}

export const NPSRating = forwardRef<HTMLDivElement, NPSRatingProps>(
  (
    {
      value = null,
      readonly = false,
      showLabels = true,
      onChange,
      className,
      ...props
    },
    ref
  ) => {
    const getScoreColor = (score: number) => {
      if (score <= 6) return { bg: 'bg-red-500', hover: 'hover:bg-red-400', text: 'Detractor' };
      if (score <= 8) return { bg: 'bg-yellow-500', hover: 'hover:bg-yellow-400', text: 'Passive' };
      return { bg: 'bg-green-500', hover: 'hover:bg-green-400', text: 'Promoter' };
    };

    return (
      <div ref={ref} className={clsx('flex flex-col gap-2', className)} {...props}>
        <div className="flex items-center gap-1">
          {Array.from({ length: 11 }, (_, i) => {
            const colors = getScoreColor(i);
            const isSelected = value === i;

            return (
              <button
                key={i}
                type="button"
                className={clsx(
                  'w-8 h-8 rounded-md text-sm font-medium transition-all',
                  readonly ? 'cursor-default' : 'cursor-pointer',
                  isSelected
                    ? `${colors.bg} text-white ring-2 ring-offset-1 ring-blue-500`
                    : `bg-gray-100 text-gray-700 ${!readonly ? colors.hover : ''}`
                )}
                onClick={() => !readonly && onChange?.(i)}
                disabled={readonly}
                aria-label={`Score ${i}`}
              >
                {i}
              </button>
            );
          })}
        </div>
        {showLabels && (
          <div className="flex justify-between text-xs text-gray-500">
            <span>Not at all likely</span>
            <span>Extremely likely</span>
          </div>
        )}
      </div>
    );
  }
);

NPSRating.displayName = 'NPSRating';

// ============================================================================
// RatingDistributionBar Component
// ============================================================================

export interface RatingDistributionBarProps extends HTMLAttributes<HTMLDivElement> {
  distribution: RatingDistribution[];
  max?: number;
  size?: RatingSize;
  color?: RatingColor;
  interactive?: boolean;
  onRatingClick?: (rating: number) => void;
}

export const RatingDistributionBar = forwardRef<HTMLDivElement, RatingDistributionBarProps>(
  (
    {
      distribution,
      max = 5,
      size = 'md',
      color = 'yellow',
      interactive = false,
      onRatingClick,
      className,
      ...props
    },
    ref
  ) => {
    const sizeStyles = SIZE_MAP[size];
    const colorStyles = COLOR_MAP[color];

    return (
      <div ref={ref} className={clsx('flex flex-col gap-2', className)} {...props}>
        {distribution.map((item) => (
          <div
            key={item.rating}
            className={clsx(
              'flex items-center gap-2',
              interactive && 'cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5'
            )}
            onClick={() => interactive && onRatingClick?.(item.rating)}
            role={interactive ? 'button' : undefined}
            tabIndex={interactive ? 0 : undefined}
          >
            <span className={clsx('w-8 text-sm text-gray-600 flex items-center gap-1', sizeStyles.text)}>
              {item.rating}
              <Star className="w-3 h-3 text-gray-400" />
            </span>
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={clsx('h-full rounded-full transition-all', colorStyles.filled.replace('text-', 'bg-'))}
                style={{ width: `${item.percentage}%` }}
              />
            </div>
            <span className="w-12 text-sm text-gray-500 text-right">
              {item.count} ({item.percentage}%)
            </span>
          </div>
        ))}
      </div>
    );
  }
);

RatingDistributionBar.displayName = 'RatingDistributionBar';

// ============================================================================
// RatingSummary Component
// ============================================================================

export interface RatingSummaryProps extends HTMLAttributes<HTMLDivElement> {
  stats: RatingStats;
  max?: number;
  size?: RatingSize;
  color?: RatingColor;
  showDistribution?: boolean;
  showRecommended?: boolean;
}

export const RatingSummary = forwardRef<HTMLDivElement, RatingSummaryProps>(
  (
    {
      stats,
      max = 5,
      size = 'md',
      color = 'yellow',
      showDistribution = true,
      showRecommended = true,
      className,
      ...props
    },
    ref
  ) => {
    const colorStyles = COLOR_MAP[color];

    return (
      <div ref={ref} className={clsx('flex gap-6', className)} {...props}>
        {/* Average Score */}
        <div className="flex flex-col items-center justify-center">
          <span className={clsx('text-4xl font-bold', colorStyles.text)}>
            {formatRating(stats.average)}
          </span>
          <StarRating value={stats.average} max={max} readonly size={size} color={color} />
          <span className="text-sm text-gray-500 mt-1">
            {stats.total.toLocaleString()} {stats.total === 1 ? 'review' : 'reviews'}
          </span>
          {showRecommended && stats.recommended !== undefined && (
            <span className="text-sm text-green-600 mt-1">
              {stats.recommended}% recommended
            </span>
          )}
        </div>

        {/* Distribution */}
        {showDistribution && (
          <div className="flex-1">
            <RatingDistributionBar
              distribution={stats.distribution}
              max={max}
              size={size}
              color={color}
            />
          </div>
        )}
      </div>
    );
  }
);

RatingSummary.displayName = 'RatingSummary';

// ============================================================================
// ReviewCard Component
// ============================================================================

export interface ReviewCardProps extends HTMLAttributes<HTMLDivElement> {
  review: Review;
  max?: number;
  size?: RatingSize;
  color?: RatingColor;
  onHelpful?: (reviewId: string) => void;
  onReport?: (reviewId: string) => void;
}

export const ReviewCard = forwardRef<HTMLDivElement, ReviewCardProps>(
  (
    {
      review,
      max = 5,
      size = 'sm',
      color = 'yellow',
      onHelpful,
      onReport,
      className,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={clsx('p-4 border border-gray-200 rounded-lg', className)}
        {...props}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-3">
            {review.author.avatar ? (
              <img
                src={review.author.avatar}
                alt={review.author.name}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-medium">
                {review.author.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">{review.author.name}</span>
                {review.verified && (
                  <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                    <Check className="w-3 h-3" />
                    Verified
                  </span>
                )}
              </div>
              <span className="text-sm text-gray-500">
                {new Date(review.date).toLocaleDateString()}
              </span>
            </div>
          </div>
          <StarRating value={review.rating} max={max} readonly size={size} color={color} />
        </div>

        {/* Title */}
        {review.title && (
          <h4 className="font-medium text-gray-900 mb-1">{review.title}</h4>
        )}

        {/* Content */}
        {review.content && (
          <p className="text-gray-700 text-sm mb-3">{review.content}</p>
        )}

        {/* Images */}
        {review.images && review.images.length > 0 && (
          <div className="flex gap-2 mb-3 flex-wrap">
            {review.images.map((img, i) => (
              <img
                key={i}
                src={img}
                alt={`Review image ${i + 1}`}
                className="w-16 h-16 rounded object-cover border border-gray-200"
              />
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-4 text-sm">
          {onHelpful && (
            <button
              type="button"
              className="text-gray-500 hover:text-gray-700 flex items-center gap-1"
              onClick={() => onHelpful(review.id)}
            >
              <ThumbsUp className="w-4 h-4" />
              Helpful ({review.helpful || 0})
            </button>
          )}
          {onReport && (
            <button
              type="button"
              className="text-gray-500 hover:text-red-600"
              onClick={() => onReport(review.id)}
            >
              Report
            </button>
          )}
        </div>
      </div>
    );
  }
);

ReviewCard.displayName = 'ReviewCard';

// ============================================================================
// TrendIndicator Component
// ============================================================================

export interface TrendIndicatorProps extends HTMLAttributes<HTMLSpanElement> {
  value: number;
  previousValue: number;
  format?: 'percent' | 'absolute' | 'points';
  size?: RatingSize;
  invertColors?: boolean;
}

export const TrendIndicator = forwardRef<HTMLSpanElement, TrendIndicatorProps>(
  (
    {
      value,
      previousValue,
      format = 'percent',
      size = 'sm',
      invertColors = false,
      className,
      ...props
    },
    ref
  ) => {
    const diff = value - previousValue;
    const isPositive = diff > 0;
    const isNeutral = diff === 0;

    const sizeStyles = SIZE_MAP[size];

    const formatDiff = () => {
      switch (format) {
        case 'percent':
          if (previousValue === 0) return isPositive ? '+∞%' : '0%';
          const pct = Math.round((diff / previousValue) * 100);
          return `${pct > 0 ? '+' : ''}${pct}%`;
        case 'absolute':
          return `${diff > 0 ? '+' : ''}${diff.toLocaleString()}`;
        case 'points':
          return `${diff > 0 ? '+' : ''}${diff.toFixed(1)} pts`;
        default:
          return String(diff);
      }
    };

    const Icon = isNeutral ? Minus : isPositive ? TrendingUp : TrendingDown;

    let colorClass: string;
    if (isNeutral) {
      colorClass = 'text-gray-500';
    } else if (invertColors) {
      colorClass = isPositive ? 'text-red-600' : 'text-green-600';
    } else {
      colorClass = isPositive ? 'text-green-600' : 'text-red-600';
    }

    return (
      <span
        ref={ref}
        className={clsx('inline-flex items-center gap-0.5', colorClass, sizeStyles.text, className)}
        {...props}
      >
        <Icon className={sizeStyles.icon} />
        {formatDiff()}
      </span>
    );
  }
);

TrendIndicator.displayName = 'TrendIndicator';

// ============================================================================
// useRating Hook
// ============================================================================

export interface UseRatingOptions {
  initialValue?: number;
  max?: number;
  onChange?: (value: number) => void;
}

export interface UseRatingReturn {
  value: number;
  setValue: (value: number) => void;
  reset: () => void;
  increment: () => void;
  decrement: () => void;
  isMax: boolean;
  isMin: boolean;
  percentage: number;
}

export function useRating(options: UseRatingOptions = {}): UseRatingReturn {
  const { initialValue = 0, max = 5, onChange } = options;
  const [value, setValueState] = useState(initialValue);

  const setValue = useCallback(
    (newValue: number) => {
      const clamped = Math.max(0, Math.min(max, newValue));
      setValueState(clamped);
      onChange?.(clamped);
    },
    [max, onChange]
  );

  const reset = useCallback(() => {
    setValue(initialValue);
  }, [initialValue, setValue]);

  const increment = useCallback(() => {
    setValue(value + 1);
  }, [value, setValue]);

  const decrement = useCallback(() => {
    setValue(value - 1);
  }, [value, setValue]);

  return useMemo(
    () => ({
      value,
      setValue,
      reset,
      increment,
      decrement,
      isMax: value >= max,
      isMin: value <= 0,
      percentage: max > 0 ? (value / max) * 100 : 0,
    }),
    [value, setValue, reset, increment, decrement, max]
  );
}

// ============================================================================
// Exports
// ============================================================================

export default StarRating;
