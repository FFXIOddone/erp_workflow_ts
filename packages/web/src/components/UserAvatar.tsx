import React, { useState } from 'react';
import clsx from 'clsx';
import { User } from 'lucide-react';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface UserAvatarProps {
  /** User's name (used for initials fallback) */
  name?: string;
  /** User's email (used for initials if no name) */
  email?: string;
  /** Image URL */
  src?: string;
  /** Alt text for image */
  alt?: string;
  /** Size variant */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  /** Shape of the avatar */
  shape?: 'circle' | 'rounded' | 'square';
  /** Whether to show online status indicator */
  showStatus?: boolean;
  /** Online status */
  status?: 'online' | 'offline' | 'away' | 'busy' | 'dnd';
  /** Border color (for selected state) */
  borderColor?: string;
  /** Whether the avatar is selected */
  selected?: boolean;
  /** Custom className */
  className?: string;
  /** Click handler */
  onClick?: () => void;
  /** Fallback background color */
  fallbackColor?: string;
}

export interface UserAvatarGroupProps {
  /** Array of avatar props */
  users: UserAvatarProps[];
  /** Maximum number of visible avatars */
  max?: number;
  /** Size for all avatars */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Custom className */
  className?: string;
  /** Click handler for "+N" overflow */
  onOverflowClick?: () => void;
}

export interface UserInfoProps {
  name: string;
  email?: string;
  src?: string;
  subtitle?: string;
  size?: 'sm' | 'md' | 'lg';
  status?: 'online' | 'offline' | 'away' | 'busy';
  className?: string;
  onClick?: () => void;
}

// ============================================================================
// Size Configuration
// ============================================================================

const sizeClasses = {
  xs: { container: 'h-6 w-6', text: 'text-xs', status: 'h-2 w-2', icon: 'h-3 w-3' },
  sm: { container: 'h-8 w-8', text: 'text-sm', status: 'h-2.5 w-2.5', icon: 'h-4 w-4' },
  md: { container: 'h-10 w-10', text: 'text-base', status: 'h-3 w-3', icon: 'h-5 w-5' },
  lg: { container: 'h-12 w-12', text: 'text-lg', status: 'h-3.5 w-3.5', icon: 'h-6 w-6' },
  xl: { container: 'h-16 w-16', text: 'text-xl', status: 'h-4 w-4', icon: 'h-8 w-8' },
  '2xl': { container: 'h-20 w-20', text: 'text-2xl', status: 'h-5 w-5', icon: 'h-10 w-10' },
};

const statusColors = {
  online: 'bg-green-500',
  offline: 'bg-gray-400',
  away: 'bg-amber-500',
  busy: 'bg-red-500',
  dnd: 'bg-red-500',
};

// ============================================================================
// Color Generation
// ============================================================================

const avatarColors = [
  'bg-blue-500',
  'bg-green-500',
  'bg-amber-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-cyan-500',
  'bg-indigo-500',
  'bg-rose-500',
  'bg-emerald-500',
  'bg-violet-500',
];

function getColorFromString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

function getInitials(name?: string, email?: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  if (email) {
    const localPart = email.split('@')[0];
    return localPart.slice(0, 2).toUpperCase();
  }
  return 'U';
}

// ============================================================================
// UserAvatar Component
// ============================================================================

export function UserAvatar({
  name,
  email,
  src,
  alt,
  size = 'md',
  shape = 'circle',
  showStatus = false,
  status = 'offline',
  borderColor,
  selected = false,
  className,
  onClick,
  fallbackColor,
}: UserAvatarProps) {
  const [imageError, setImageError] = useState(false);
  
  const styles = sizeClasses[size];
  const initials = getInitials(name, email);
  const bgColor = fallbackColor || getColorFromString(name || email || 'user');
  
  const shapeClasses = {
    circle: 'rounded-full',
    rounded: 'rounded-lg',
    square: 'rounded-none',
  };

  const hasImage = src && !imageError;
  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      onClick={onClick}
      className={clsx(
        'relative inline-flex items-center justify-center flex-shrink-0',
        styles.container,
        shapeClasses[shape],
        selected && 'ring-2 ring-offset-2',
        selected && (borderColor || 'ring-blue-500'),
        onClick && 'cursor-pointer hover:opacity-90 transition-opacity',
        className,
      )}
      aria-label={alt || name || email || 'User avatar'}
    >
      {hasImage ? (
        <img
          src={src}
          alt={alt || name || 'Avatar'}
          onError={() => setImageError(true)}
          className={clsx(
            'h-full w-full object-cover',
            shapeClasses[shape],
          )}
        />
      ) : (
        <div
          className={clsx(
            'h-full w-full flex items-center justify-center text-white font-medium',
            shapeClasses[shape],
            bgColor,
            styles.text,
          )}
        >
          {initials || <User className={styles.icon} />}
        </div>
      )}

      {/* Status indicator */}
      {showStatus && (
        <span
          className={clsx(
            'absolute bottom-0 right-0 block rounded-full ring-2 ring-white',
            styles.status,
            statusColors[status],
          )}
        />
      )}
    </Wrapper>
  );
}

// ============================================================================
// UserAvatarGroup Component
// ============================================================================

export function UserAvatarGroup({
  users,
  max = 4,
  size = 'md',
  className,
  onOverflowClick,
}: UserAvatarGroupProps) {
  const visibleUsers = users.slice(0, max);
  const overflowCount = users.length - max;

  const overlapClasses = {
    xs: '-ml-2',
    sm: '-ml-2',
    md: '-ml-3',
    lg: '-ml-4',
    xl: '-ml-5',
  };

  return (
    <div className={clsx('flex items-center', className)}>
      {visibleUsers.map((user, index) => (
        <div
          key={index}
          className={clsx(
            'relative',
            index > 0 && overlapClasses[size],
          )}
          style={{ zIndex: visibleUsers.length - index }}
        >
          <UserAvatar
            {...user}
            size={size}
            className="ring-2 ring-white"
          />
        </div>
      ))}

      {overflowCount > 0 && (
        <button
          onClick={onOverflowClick}
          className={clsx(
            'relative flex items-center justify-center rounded-full bg-gray-200 text-gray-600 font-medium ring-2 ring-white',
            overlapClasses[size],
            sizeClasses[size].container,
            sizeClasses[size].text,
            onOverflowClick && 'hover:bg-gray-300 transition-colors cursor-pointer',
          )}
          style={{ zIndex: 0 }}
        >
          +{overflowCount}
        </button>
      )}
    </div>
  );
}

// ============================================================================
// UserInfo Component - Avatar with name/email
// ============================================================================

export function UserInfo({
  name,
  email,
  src,
  subtitle,
  size = 'md',
  status,
  className,
  onClick,
}: UserInfoProps) {
  const sizeConfig = {
    sm: { avatar: 'sm' as const, name: 'text-sm', subtitle: 'text-xs' },
    md: { avatar: 'md' as const, name: 'text-sm', subtitle: 'text-xs' },
    lg: { avatar: 'lg' as const, name: 'text-base', subtitle: 'text-sm' },
  };

  const styles = sizeConfig[size];
  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      onClick={onClick}
      className={clsx(
        'flex items-center gap-3 text-left',
        onClick && 'cursor-pointer hover:opacity-90 transition-opacity',
        className,
      )}
    >
      <UserAvatar
        name={name}
        email={email}
        src={src}
        size={styles.avatar}
        showStatus={!!status}
        status={status}
      />
      <div className="flex-1 min-w-0">
        <p className={clsx('font-medium text-gray-900 truncate', styles.name)}>
          {name}
        </p>
        {(email || subtitle) && (
          <p className={clsx('text-gray-500 truncate', styles.subtitle)}>
            {subtitle || email}
          </p>
        )}
      </div>
    </Wrapper>
  );
}

// ============================================================================
// AvatarPlaceholder - Skeleton loading state
// ============================================================================

export interface AvatarPlaceholderProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function AvatarPlaceholder({ size = 'md', className }: AvatarPlaceholderProps) {
  return (
    <div
      className={clsx(
        'rounded-full bg-gray-200 animate-pulse',
        sizeClasses[size].container,
        className,
      )}
    />
  );
}

// ============================================================================
// UserBadge - Compact user display with role badge
// ============================================================================

export interface UserBadgeProps {
  name: string;
  src?: string;
  role?: string;
  roleColor?: 'blue' | 'green' | 'amber' | 'purple' | 'pink' | 'gray';
  className?: string;
  onClick?: () => void;
}

export function UserBadge({
  name,
  src,
  role,
  roleColor = 'gray',
  className,
  onClick,
}: UserBadgeProps) {
  const roleColorClasses = {
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700',
    purple: 'bg-purple-100 text-purple-700',
    pink: 'bg-pink-100 text-pink-700',
    gray: 'bg-gray-100 text-gray-700',
  };

  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      onClick={onClick}
      className={clsx(
        'inline-flex items-center gap-2 px-2 py-1 bg-gray-50 rounded-full border border-gray-200',
        onClick && 'hover:bg-gray-100 cursor-pointer transition-colors',
        className,
      )}
    >
      <UserAvatar name={name} src={src} size="xs" />
      <span className="text-sm font-medium text-gray-700">{name}</span>
      {role && (
        <span className={clsx(
          'text-xs px-1.5 py-0.5 rounded-full font-medium',
          roleColorClasses[roleColor],
        )}>
          {role}
        </span>
      )}
    </Wrapper>
  );
}

// ============================================================================
// UserSelect - Avatar as a selectable option
// ============================================================================

export interface UserSelectProps {
  users: {
    id: string;
    name: string;
    email?: string;
    src?: string;
  }[];
  selected?: string[];
  onChange: (selected: string[]) => void;
  multiple?: boolean;
  className?: string;
}

export function UserSelect({
  users,
  selected = [],
  onChange,
  multiple = false,
  className,
}: UserSelectProps) {
  const handleSelect = (userId: string) => {
    if (multiple) {
      if (selected.includes(userId)) {
        onChange(selected.filter((id) => id !== userId));
      } else {
        onChange([...selected, userId]);
      }
    } else {
      onChange([userId]);
    }
  };

  return (
    <div className={clsx('flex flex-wrap gap-2', className)}>
      {users.map((user) => (
        <button
          key={user.id}
          onClick={() => handleSelect(user.id)}
          className={clsx(
            'flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors',
            selected.includes(user.id)
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300',
          )}
        >
          <UserAvatar
            name={user.name}
            email={user.email}
            src={user.src}
            size="sm"
            selected={selected.includes(user.id)}
          />
          <span className="text-sm font-medium text-gray-700">{user.name}</span>
        </button>
      ))}
    </div>
  );
}
