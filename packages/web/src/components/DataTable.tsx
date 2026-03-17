import { ReactNode } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { Spinner } from './Spinner';

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render: (item: T, index: number) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  isLoading?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  emptyState?: ReactNode;
  rowClassName?: (item: T) => string;
  onRowClick?: (item: T) => void;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  isLoading = false,
  sortBy,
  sortOrder = 'asc',
  onSort,
  emptyState,
  rowClassName,
  onRowClick,
}: DataTableProps<T>) {
  const alignmentClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  const renderSortIcon = (column: Column<T>) => {
    if (!column.sortable) return null;
    
    if (sortBy !== column.key) {
      return <ChevronsUpDown className="h-3.5 w-3.5 text-gray-400" />;
    }
    
    return sortOrder === 'asc' 
      ? <ChevronUp className="h-3.5 w-3.5 text-primary-600" />
      : <ChevronDown className="h-3.5 w-3.5 text-primary-600" />;
  };

  return (
    <div className="table-container relative">
      {isLoading && data.length > 0 && (
        <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center z-10">
          <Spinner size="lg" />
        </div>
      )}
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="table-header">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-6 py-4 text-xs font-semibold text-gray-600 uppercase tracking-wider ${
                    alignmentClasses[column.align ?? 'left']
                  } ${column.sortable ? 'cursor-pointer hover:bg-gray-100/50 select-none' : ''}`}
                  style={{ width: column.width }}
                  onClick={() => column.sortable && onSort?.(column.key)}
                >
                  <div className={`flex items-center gap-1.5 ${column.align === 'right' ? 'justify-end' : column.align === 'center' ? 'justify-center' : ''}`}>
                    {column.header}
                    {renderSortIcon(column)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 bg-white">
            {isLoading && data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <Spinner size="lg" />
                    <span className="text-gray-500">Loading...</span>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-8">
                  {emptyState || (
                    <div className="text-center text-gray-500">No data available</div>
                  )}
                </td>
              </tr>
            ) : (
              data.map((item, index) => (
                <tr 
                  key={keyExtractor(item)} 
                  className={`table-row ${onRowClick ? 'cursor-pointer' : ''} ${rowClassName?.(item) ?? ''}`}
                  onClick={() => onRowClick?.(item)}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-6 py-4 ${alignmentClasses[column.align ?? 'left']}`}
                    >
                      {column.render(item, index)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
