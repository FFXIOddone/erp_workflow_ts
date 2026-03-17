import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { ReactNode } from 'react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: ReactNode;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className = '' }: BreadcrumbsProps) {
  return (
    <nav className={`flex items-center gap-1 text-sm ${className}`} aria-label="Breadcrumb">
      <Link 
        to="/" 
        className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        aria-label="Home"
      >
        <Home className="h-4 w-4" />
      </Link>
      
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-1">
          <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
          {item.href && index < items.length - 1 ? (
            <Link
              to={item.href}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ) : (
            <span className="flex items-center gap-1.5 px-2 py-1 text-gray-900 font-medium">
              {item.icon}
              <span>{item.label}</span>
            </span>
          )}
        </div>
      ))}
    </nav>
  );
}

// Quick breadcrumb generator for common pages
export function OrderBreadcrumbs({ orderNumber }: { orderNumber?: string }) {
  const items: BreadcrumbItem[] = [
    { label: 'Work Orders', href: '/orders' },
  ];
  
  if (orderNumber) {
    items.push({ label: `#${orderNumber}` });
  }
  
  return <Breadcrumbs items={items} className="mb-4" />;
}

export function InventoryBreadcrumbs({ itemName }: { itemName?: string }) {
  const items: BreadcrumbItem[] = [
    { label: 'Inventory', href: '/inventory' },
  ];
  
  if (itemName) {
    items.push({ label: itemName });
  }
  
  return <Breadcrumbs items={items} className="mb-4" />;
}
