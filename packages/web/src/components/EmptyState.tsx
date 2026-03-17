import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { 
  FileText, 
  Package, 
  Users, 
  ClipboardList, 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  Bell, 
  MessageSquare, 
  FolderOpen,
  Upload,
  Image,
  Settings
} from 'lucide-react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}

const defaultIcons = {
  orders: <ClipboardList className="h-12 w-12" />,
  inventory: <Package className="h-12 w-12" />,
  users: <Users className="h-12 w-12" />,
  templates: <FileText className="h-12 w-12" />,
};

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mb-4">
        {icon || <FileText className="h-10 w-10" />}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-gray-500 text-center max-w-sm mb-4">{description}</p>
      )}
      {action && (
        action.href ? (
          <Link
            to={action.href}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium text-sm"
          >
            <Plus className="h-4 w-4" />
            {action.label}
          </Link>
        ) : (
          <button
            onClick={action.onClick}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium text-sm"
          >
            <Plus className="h-4 w-4" />
            {action.label}
          </button>
        )
      )}
    </div>
  );
}

// Preset empty states for common scenarios
export function NoOrdersFound({ canCreate = false }: { canCreate?: boolean | undefined }) {
  if (canCreate) {
    return (
      <EmptyState
        icon={defaultIcons.orders}
        title="No orders found"
        description="No orders match your current filters. Try adjusting your search or create a new order."
        action={{ label: 'Create Order', href: '/orders/new' }}
      />
    );
  }
  
  return (
    <EmptyState
      icon={defaultIcons.orders}
      title="No orders found"
      description="No orders match your current filters. Try adjusting your search criteria."
    />
  );
}

export function NoInventoryFound() {
  return (
    <EmptyState
      icon={defaultIcons.inventory}
      title="No inventory items"
      description="Your inventory is empty. Add items to start tracking stock levels."
    />
  );
}

export function NoResultsFound({ query }: { query: string }) {
  return (
    <EmptyState
      icon={<span className="text-4xl">🔍</span>}
      title="No results found"
      description={`We couldn't find anything matching "${query}". Try a different search term.`}
    />
  );
}

// ============================================================================
// Additional Preset Empty States
// ============================================================================

/**
 * Empty state when filters return no results
 */
export function NoFilterResults({ 
  onReset, 
  activeFilters 
}: { 
  onReset?: () => void; 
  activeFilters?: number;
}) {
  return (
    <EmptyState
      icon={<Filter className="h-12 w-12" />}
      title="No matching items"
      description={
        activeFilters
          ? `${activeFilters} filter${activeFilters !== 1 ? 's' : ''} applied. Try adjusting your filters.`
          : "No items match your current filters."
      }
      action={onReset ? { label: 'Reset filters', onClick: onReset } : undefined}
    />
  );
}

/**
 * Empty state for documents/attachments
 */
export function NoDocuments({ 
  onUpload,
  acceptedFormats 
}: { 
  onUpload?: () => void;
  acceptedFormats?: string[];
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mb-4">
        <FileText className="h-10 w-10" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-1">No documents</h3>
      <p className="text-sm text-gray-500 text-center max-w-sm mb-4">
        Upload documents to attach them to this order.
      </p>
      {acceptedFormats && acceptedFormats.length > 0 && (
        <p className="text-xs text-gray-400 mb-4">
          Accepted formats: {acceptedFormats.join(', ')}
        </p>
      )}
      {onUpload && (
        <button
          onClick={onUpload}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium text-sm"
        >
          <Upload className="h-4 w-4" />
          Upload document
        </button>
      )}
    </div>
  );
}

/**
 * Empty state for images/gallery
 */
export function NoImages({ onUpload }: { onUpload?: () => void }) {
  return (
    <EmptyState
      icon={<Image className="h-12 w-12" />}
      title="No images"
      description="Upload images to display in the gallery."
      action={onUpload ? { label: 'Upload images', onClick: onUpload } : undefined}
    />
  );
}

/**
 * Empty state for calendar/schedule
 */
export function NoScheduledItems({ 
  onAdd, 
  dateRange 
}: { 
  onAdd?: () => void; 
  dateRange?: string;
}) {
  return (
    <EmptyState
      icon={<Calendar className="h-12 w-12" />}
      title="Nothing scheduled"
      description={
        dateRange
          ? `No events scheduled for ${dateRange}.`
          : "Your schedule is empty."
      }
      action={onAdd ? { label: 'Add event', onClick: onAdd } : undefined}
    />
  );
}

/**
 * Empty state for notifications
 */
export function NoNotifications() {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4">
      <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mb-3">
        <Bell className="h-7 w-7" />
      </div>
      <h3 className="text-base font-medium text-gray-900 mb-1">No notifications</h3>
      <p className="text-sm text-gray-500 text-center max-w-xs">
        You're all caught up! Check back later for updates.
      </p>
    </div>
  );
}

/**
 * Empty state for comments
 */
export function NoComments({ onAdd }: { onAdd?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4">
      <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mb-3">
        <MessageSquare className="h-7 w-7" />
      </div>
      <h3 className="text-base font-medium text-gray-900 mb-1">No comments yet</h3>
      <p className="text-sm text-gray-500 text-center max-w-xs mb-3">
        Be the first to add a comment.
      </p>
      {onAdd && (
        <button
          onClick={onAdd}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium text-sm"
        >
          <Plus className="h-4 w-4" />
          Add comment
        </button>
      )}
    </div>
  );
}

/**
 * Empty state for folders
 */
export function NoFolderContent({ 
  name, 
  onCreate 
}: { 
  name?: string; 
  onCreate?: () => void;
}) {
  return (
    <EmptyState
      icon={<FolderOpen className="h-12 w-12" />}
      title={name ? `${name} is empty` : "This folder is empty"}
      description="Add items to organize them here."
      action={onCreate ? { label: 'Add item', onClick: onCreate } : undefined}
    />
  );
}

/**
 * Empty state for customers
 */
export function NoCustomers({ onCreate }: { onCreate?: () => void }) {
  return (
    <EmptyState
      icon={<Users className="h-12 w-12" />}
      title="No customers"
      description="Add customers to manage their orders and information."
      action={onCreate ? { label: 'Add customer', onClick: onCreate } : undefined}
    />
  );
}

/**
 * Empty state for search with suggestions
 */
export function NoSearchResults({ 
  query, 
  onClear, 
  suggestions 
}: { 
  query?: string; 
  onClear?: () => void;
  suggestions?: string[];
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mb-4">
        <Search className="h-10 w-10" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-1">No results found</h3>
      <p className="text-sm text-gray-500 text-center max-w-sm mb-4">
        {query
          ? `We couldn't find anything matching "${query}".`
          : "Try adjusting your search or filters."}
      </p>
      {suggestions && suggestions.length > 0 && (
        <div className="mb-4 text-center">
          <p className="text-xs text-gray-400 mb-2">Try searching for:</p>
          <div className="flex flex-wrap justify-center gap-2">
            {suggestions.map((suggestion) => (
              <span
                key={suggestion}
                className="px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-600"
              >
                {suggestion}
              </span>
            ))}
          </div>
        </div>
      )}
      {onClear && (
        <button
          onClick={onClear}
          className="text-sm text-primary-600 hover:underline font-medium"
        >
          Clear search
        </button>
      )}
    </div>
  );
}

/**
 * Empty state card container (dashed border style)
 */
export function EmptyStateCard({ 
  children, 
  className = '' 
}: { 
  children: ReactNode; 
  className?: string;
}) {
  return (
    <div
      className={`
        bg-white
        border-2 border-dashed border-gray-200
        rounded-lg
        ${className}
      `}
    >
      {children}
    </div>
  );
}
