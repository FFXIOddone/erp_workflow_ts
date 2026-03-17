import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ChevronsUpDown, Filter, X, Paperclip, User, CheckSquare, Square, MinusSquare, Clock, Link as LinkIcon, Bookmark, BookmarkPlus, Star, Trash2, Printer } from 'lucide-react';
import { api } from '../lib/api';
import { STATUS_DISPLAY_NAMES, STATUS_COLORS, PRIORITY_LABELS, PRIORITY_COLORS, STATION_DISPLAY_NAMES, COMPANY_BRAND_DISPLAY_NAMES, COMPANY_BRAND_COLORS, OrderStatus, PrintingMethod, UserRole, CompanyBrand } from '@erp/shared';
import { useAuthStore } from '../stores/auth';
import { BulkActionsToolbar } from '../components/BulkActionsToolbar';
import { SmartLabelPrint } from '../components/SmartLabelPrint';
import { isOverdue, isToday } from '../lib/date';
import { NoOrdersFound } from '../components';
import { useSavedFilters, type OrderFilterState } from '../hooks/useSavedFilters';

type SortField = 'orderNumber' | 'customerName' | 'status' | 'priority' | 'dueDate' | 'createdAt';
type SortOrder = 'asc' | 'desc';

export function OrdersPage() {
  const user = useAuthStore((state) => state.user);
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') || '';
  const initialStatus = searchParams.get('status') || '';
  const initialFilter = searchParams.get('filter') || '';
  
  const [search, setSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [dateFilter, setDateFilter] = useState<string>(initialFilter);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<number[]>([]);
  const [stationFilter, setStationFilter] = useState<string>('');
  const [assignedToFilter, setAssignedToFilter] = useState<string>('');
  const [hasAttachments, setHasAttachments] = useState<boolean | undefined>(undefined);
  const [dueDateFrom, setDueDateFrom] = useState<string>('');
  const [dueDateTo, setDueDateTo] = useState<string>('');
  const [companyBrandFilter, setCompanyBrandFilter] = useState<string>('');
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [newFilterName, setNewFilterName] = useState('');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showLabelPrint, setShowLabelPrint] = useState(false);
  const { 
    savedFilters, 
    saveFilter, 
    deleteFilter, 
    setDefaultFilter,
    getDefaultFilter,
    findMatchingFilter 
  } = useSavedFilters();
  
  const getCurrentFilterState = useCallback((): OrderFilterState => ({
    search,
    statusFilter,
    dateFilter,
    priorityFilter,
    stationFilter,
    assignedToFilter,
    hasAttachments,
    dueDateFrom,
    dueDateTo,
  }), [search, statusFilter, dateFilter, priorityFilter, stationFilter, assignedToFilter, hasAttachments, dueDateFrom, dueDateTo]);
  
  const applySavedFilter = useCallback((filters: OrderFilterState) => {
    setSearch(filters.search);
    setStatusFilter(filters.statusFilter);
    setDateFilter(filters.dateFilter);
    setPriorityFilter(filters.priorityFilter);
    setStationFilter(filters.stationFilter);
    setAssignedToFilter(filters.assignedToFilter);
    setHasAttachments(filters.hasAttachments);
    setDueDateFrom(filters.dueDateFrom);
    setDueDateTo(filters.dueDateTo);
    setPage(1);
    setShowFilterDropdown(false);
  }, []);
  
  useEffect(() => {
    const defaultFilter = getDefaultFilter();
    if (defaultFilter && !initialSearch && !initialStatus && !initialFilter) {
      applySavedFilter(defaultFilter.filters);
    }
  }, []); // Only run once on mount
  
  const activeFilterPreset = useMemo(() => {
    return findMatchingFilter(getCurrentFilterState());
  }, [findMatchingFilter, getCurrentFilterState]);
  
  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.get('/users');
      const data = response.data.data;
      return Array.isArray(data) ? data : (data?.items || []);
    },
    staleTime: 10 * 60 * 1000, // Users rarely change
  });
  
  const activeFilterCount = [
    statusFilter,
    priorityFilter.length > 0,
    stationFilter,
    assignedToFilter,
    hasAttachments !== undefined,
    dueDateFrom,
    dueDateTo,
    companyBrandFilter,
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setStatusFilter('');
    setPriorityFilter([]);
    setStationFilter('');
    setAssignedToFilter('');
    setHasAttachments(undefined);
    setDueDateFrom('');
    setDueDateTo('');
    setSearch('');
    setDateFilter('');
    setCompanyBrandFilter('');
  };
  
  useEffect(() => {
    const urlSearch = searchParams.get('search') || '';
    const urlStatus = searchParams.get('status') || '';
    const urlFilter = searchParams.get('filter') || '';
    if (urlSearch !== search) setSearch(urlSearch);
    if (urlStatus !== statusFilter) setStatusFilter(urlStatus);
    if (urlFilter !== dateFilter) setDateFilter(urlFilter);
  }, [searchParams]);
  
  const canCreateOrder = user?.role === UserRole.ADMIN || 
                         user?.role === UserRole.MANAGER || 
                         user?.allowedStations?.includes(PrintingMethod.ORDER_ENTRY);

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortBy !== field) {
      return <ChevronsUpDown className="h-3 w-3 text-gray-400" />;
    }
    return sortOrder === 'asc' 
      ? <ChevronUp className="h-3 w-3 text-primary-600" />
      : <ChevronDown className="h-3 w-3 text-primary-600" />;
  };

  const { data, isLoading } = useQuery({
    queryKey: ['orders', { 
      search, status: statusFilter, dateFilter, page, sortBy, sortOrder,
      priority: priorityFilter, station: stationFilter, assignedToId: assignedToFilter,
      hasAttachments, dueDateFrom, dueDateTo, companyBrand: companyBrandFilter
    }],
    queryFn: async () => {
      const params: Record<string, string | number | boolean> = { page, pageSize: 50, sortBy, sortOrder, lightweight: true };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (dateFilter) params.dateFilter = dateFilter;
      if (priorityFilter.length > 0) params.priority = priorityFilter.join(',');
      if (stationFilter) params.station = stationFilter;
      if (assignedToFilter) params.assignedToId = assignedToFilter;
      if (hasAttachments !== undefined) params.hasAttachments = hasAttachments;
      if (dueDateFrom) params.dueDateFrom = dueDateFrom;
      if (dueDateTo) params.dueDateTo = dueDateTo;
      if (companyBrandFilter) params.companyBrand = companyBrandFilter;
      const response = await api.get('/orders', { params });
      return response.data.data;
    },
  });

  const orders = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

  const orderIds = useMemo(() => orders.map((o: { id: string }) => o.id), [orders]);
  const allSelected = orderIds.length > 0 && orderIds.every((id: string) => selectedIds.has(id));
  const someSelected = orderIds.some((id: string) => selectedIds.has(id)) && !allSelected;
  
  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        orderIds.forEach((id: string) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        orderIds.forEach((id: string) => next.add(id));
        return next;
      });
    }
  };
  
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };
  
  const clearSelection = () => setSelectedIds(new Set());

  // ═══════════════════════════════════════════════════════════════════
  // RENDER — Dense, viewport‑filling layout. No page scroll.
  // ═══════════════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] animate-fade-in">

      {/* ─── Header Row ─── compact single line ─── */}
      <div className="flex items-center gap-3 mb-1.5 flex-shrink-0">
        <h1 className="text-lg font-bold text-gray-900 whitespace-nowrap">Work Orders</h1>
        <span className="text-[11px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full font-semibold tabular-nums">
          {data?.total ?? '—'}
        </span>

        {/* Search */}
        <div className="relative flex-1 max-w-sm group">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 group-focus-within:text-primary-500 transition-colors" />
          <input
            type="text"
            placeholder="Search order #, customer, description, PO#…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-7 py-1.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors text-base leading-none">×</button>
          )}
        </div>

        {/* Saved Views dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowFilterDropdown(!showFilterDropdown)}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
              activeFilterPreset
                ? 'bg-purple-100 text-purple-700 border border-purple-200'
                : savedFilters.length > 0
                  ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
            }`}
          >
            <Bookmark className="h-3.5 w-3.5" />
            {activeFilterPreset ? activeFilterPreset.name : 'Views'}
            {activeFilterPreset?.isDefault && <Star className="h-2.5 w-2.5 fill-current text-amber-500" />}
          </button>
          
          {showFilterDropdown && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowFilterDropdown(false)} />
              <div className="absolute right-0 top-full mt-1 w-72 bg-white rounded-lg shadow-lg border border-gray-200 z-20 animate-fade-in">
                <div className="p-2 border-b border-gray-100">
                  <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide px-2">Saved Filter Views</p>
                </div>
                
                {savedFilters.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    <Bookmark className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    <p>No saved filters yet</p>
                    <p className="text-xs mt-1">Configure filters and click "Save View"</p>
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto p-1">
                    {savedFilters.map((filter) => (
                      <div
                        key={filter.id}
                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer group ${
                          activeFilterPreset?.id === filter.id ? 'bg-purple-50' : 'hover:bg-gray-50'
                        }`}
                        onClick={() => applySavedFilter(filter.filters)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-gray-900 truncate">{filter.name}</span>
                            {filter.isDefault && <Star className="h-3 w-3 fill-current text-amber-500 flex-shrink-0" />}
                          </div>
                          <p className="text-xs text-gray-500 truncate">
                            {[
                              filter.filters.statusFilter && STATUS_DISPLAY_NAMES[filter.filters.statusFilter as OrderStatus],
                              filter.filters.search && `"${filter.filters.search}"`,
                              filter.filters.stationFilter && STATION_DISPLAY_NAMES[filter.filters.stationFilter as keyof typeof STATION_DISPLAY_NAMES],
                            ].filter(Boolean).join(', ') || 'All orders'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation(); setDefaultFilter(filter.isDefault ? null : filter.id); }}
                            className={`p-1 rounded ${filter.isDefault ? 'text-amber-500' : 'text-gray-400 hover:text-amber-500'}`}
                            title={filter.isDefault ? 'Remove as default' : 'Set as default'}
                          >
                            <Star className={`h-4 w-4 ${filter.isDefault ? 'fill-current' : ''}`} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); if (confirm(`Delete "${filter.name}"?`)) { deleteFilter(filter.id); } }}
                            className="p-1 text-gray-400 hover:text-red-500 rounded"
                            title="Delete filter"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {activeFilterCount > 0 && !activeFilterPreset && (
                  <div className="border-t border-gray-100 p-2">
                    <button
                      onClick={() => { setShowFilterDropdown(false); setShowSaveModal(true); }}
                      className="w-full px-3 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <BookmarkPlus className="h-4 w-4" />
                      Save Current Filters
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        
        {activeFilterCount > 0 && !activeFilterPreset && (
          <button onClick={() => setShowSaveModal(true)} className="px-2.5 py-1.5 text-xs font-medium text-purple-600 hover:bg-purple-50 rounded-lg transition-colors flex items-center gap-1">
            <BookmarkPlus className="h-3.5 w-3.5" /> Save
          </button>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
          <button
            onClick={() => setShowLabelPrint(true)}
            className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors border border-green-200"
          >
            <Printer className="h-3.5 w-3.5 mr-1" />Labels
          </button>
          <Link
            to="/orders/temp"
            className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors border border-amber-200"
          >
            <Clock className="h-3.5 w-3.5 mr-1" />Temp
          </Link>
          {canCreateOrder && (
            <Link
              to="/orders/new"
              className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />New
            </Link>
          )}
        </div>
      </div>

      {/* ─── Filter Bar ─── company + status + advanced in one row ─── */}
      <div className="flex items-center gap-1 mb-1.5 flex-shrink-0 text-[11px] flex-wrap">
        {/* Company Brand pills */}
        <button
          onClick={() => setCompanyBrandFilter('')}
          className={`px-2 py-0.5 rounded font-semibold transition-colors ${
            companyBrandFilter === '' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:bg-gray-100'
          }`}
        >All</button>
        {Object.values(CompanyBrand).map((brand) => (
          <button
            key={brand}
            onClick={() => setCompanyBrandFilter(brand === companyBrandFilter ? '' : brand)}
            className={`px-2 py-0.5 rounded font-semibold transition-colors flex items-center gap-1 ${
              companyBrandFilter === brand ? 'text-white' : 'text-gray-500 hover:bg-gray-100'
            }`}
            style={companyBrandFilter === brand ? { backgroundColor: COMPANY_BRAND_COLORS[brand] } : {}}
          >
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: COMPANY_BRAND_COLORS[brand] }} />
            {COMPANY_BRAND_DISPLAY_NAMES[brand]}
          </button>
        ))}

        <div className="w-px h-4 bg-gray-200 mx-1" />

        {/* Status pills */}
        <button
          onClick={() => setStatusFilter('')}
          className={`px-2 py-0.5 rounded font-semibold transition-colors ${
            statusFilter === '' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:bg-gray-100'
          }`}
        >All</button>
        {(['PENDING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED'] as OrderStatus[]).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status === statusFilter ? '' : status)}
            className={`px-2 py-0.5 rounded font-semibold transition-colors flex items-center gap-1 ${
              statusFilter === status ? 'text-white' : 'text-gray-500 hover:bg-gray-100'
            }`}
            style={statusFilter === status ? { backgroundColor: STATUS_COLORS[status] } : {}}
          >
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_COLORS[status] }} />
            {STATUS_DISPLAY_NAMES[status]}
          </button>
        ))}

        <div className="flex-1" />

        {/* Quick date buttons */}
        {['dueToday', 'dueThisWeek', 'overdue'].map((df) => {
          const label = df === 'dueToday' ? 'Today' : df === 'dueThisWeek' ? 'This Week' : 'Overdue';
          const activeColor = df === 'overdue' ? 'bg-red-100 text-red-700' : df === 'dueToday' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700';
          return (
            <button
              key={df}
              onClick={() => setDateFilter(dateFilter === df ? '' : df)}
              className={`px-2 py-0.5 rounded font-semibold transition-colors ${
                dateFilter === df ? activeColor : 'text-gray-500 hover:bg-gray-100'
              }`}
            >{label}</button>
          );
        })}

        {activeFilterCount > 0 && (
          <button onClick={clearAllFilters} className="px-2 py-0.5 text-red-500 hover:bg-red-50 rounded font-semibold flex items-center gap-0.5">
            <X className="h-3 w-3" /> Clear
          </button>
        )}
        
        {/* Advanced filters dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`px-2 py-0.5 rounded font-semibold transition-colors flex items-center gap-1 ${
              showAdvanced || activeFilterCount > 0
                ? 'bg-primary-100 text-primary-700'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <Filter className="h-3 w-3" />
            Filters
            {activeFilterCount > 0 && (
              <span className="bg-primary-600 text-white text-[9px] px-1 rounded-full min-w-[14px] text-center leading-tight">{activeFilterCount}</span>
            )}
          </button>

          {showAdvanced && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowAdvanced(false)} />
              <div className="absolute right-0 top-full mt-1 w-[520px] bg-white rounded-lg shadow-xl border border-gray-200 z-20 p-4 animate-fade-in">
                <div className="grid grid-cols-2 gap-3">
                  {/* Priority */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Priority</label>
                    <div className="flex flex-wrap gap-1">
                      {[1, 2, 3, 4, 5].map((p) => (
                        <button
                          key={p}
                          onClick={() => setPriorityFilter(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}
                          className={`px-2 py-0.5 text-xs font-medium rounded transition-colors ${
                            priorityFilter.includes(p) ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                          style={priorityFilter.includes(p) ? { backgroundColor: PRIORITY_COLORS[p] } : {}}
                        >
                          {PRIORITY_LABELS[p]}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Station */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Station</label>
                    <select
                      value={stationFilter}
                      onChange={(e) => setStationFilter(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                    >
                      <option value="">All Stations</option>
                      {Object.entries(STATION_DISPLAY_NAMES)
                        .filter(([key]) => key !== 'ORDER_ENTRY')
                        .map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))
                      }
                    </select>
                  </div>
                  
                  {/* Assigned To */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      <User className="h-3 w-3 inline mr-1" />Assigned To
                    </label>
                    <select
                      value={assignedToFilter}
                      onChange={(e) => setAssignedToFilter(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                    >
                      <option value="">Anyone</option>
                      {usersData?.map((u: { id: string; displayName: string }) => (
                        <option key={u.id} value={u.id}>{u.displayName}</option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Attachments */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      <Paperclip className="h-3 w-3 inline mr-1" />Attachments
                    </label>
                    <select
                      value={hasAttachments === undefined ? '' : hasAttachments.toString()}
                      onChange={(e) => {
                        const val = e.target.value;
                        setHasAttachments(val === '' ? undefined : val === 'true');
                      }}
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                    >
                      <option value="">Any</option>
                      <option value="true">Has Attachments</option>
                      <option value="false">No Attachments</option>
                    </select>
                  </div>
                  
                  {/* Due Date Range */}
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Due Date Range</label>
                    <div className="flex gap-2 items-center">
                      <input type="date" value={dueDateFrom} onChange={(e) => setDueDateFrom(e.target.value)}
                        className="flex-1 px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
                      <span className="text-gray-400 text-xs">to</span>
                      <input type="date" value={dueDateTo} onChange={(e) => setDueDateTo(e.target.value)}
                        className="flex-1 px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ─── Table ─── fills remaining viewport ─── */}
      <div className="flex-1 min-h-0 bg-white rounded-lg shadow-sm border border-gray-100 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto min-h-0">
          <table className="min-w-full">
            <thead className="bg-gray-50/90 backdrop-blur-sm sticky top-0 z-10">
              <tr className="border-b border-gray-200">
                {/* Checkbox */}
                <th className="px-2 py-2 w-8">
                  <button
                    onClick={toggleSelectAll}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                    title={allSelected ? 'Deselect all' : 'Select all'}
                  >
                    {allSelected ? (
                      <CheckSquare className="h-4 w-4 text-primary-600" />
                    ) : someSelected ? (
                      <MinusSquare className="h-4 w-4 text-primary-600" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>
                </th>
                <th onClick={() => handleSort('orderNumber')} className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none">
                  <div className="flex items-center gap-1">Order # <SortIcon field="orderNumber" /></div>
                </th>
                <th onClick={() => handleSort('customerName')} className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none">
                  <div className="flex items-center gap-1">Customer <SortIcon field="customerName" /></div>
                </th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th onClick={() => handleSort('status')} className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none">
                  <div className="flex items-center gap-1">Status <SortIcon field="status" /></div>
                </th>
                <th onClick={() => handleSort('priority')} className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none">
                  <div className="flex items-center gap-1">Priority <SortIcon field="priority" /></div>
                </th>
                <th onClick={() => handleSort('dueDate')} className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none">
                  <div className="flex items-center gap-1">Due <SortIcon field="dueDate" /></div>
                </th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  Stations
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                Array.from({ length: 20 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-2 py-1.5"><div className="h-4 w-4 bg-gray-100 rounded" /></td>
                    <td className="px-3 py-1.5"><div className="h-3.5 bg-gray-100 rounded w-16" /></td>
                    <td className="px-3 py-1.5"><div className="h-3.5 bg-gray-100 rounded w-28" /></td>
                    <td className="px-3 py-1.5"><div className="h-3.5 bg-gray-100 rounded w-40" /></td>
                    <td className="px-3 py-1.5"><div className="h-4 bg-gray-100 rounded-full w-16" /></td>
                    <td className="px-3 py-1.5"><div className="h-3.5 bg-gray-100 rounded w-12" /></td>
                    <td className="px-3 py-1.5"><div className="h-3.5 bg-gray-100 rounded w-16" /></td>
                    <td className="px-3 py-1.5"><div className="h-3.5 bg-gray-100 rounded w-20" /></td>
                  </tr>
                ))
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8">
                    <NoOrdersFound canCreate={canCreateOrder} />
                  </td>
                </tr>
              ) : (
                orders.map((order: {
                  id: string;
                  orderNumber: string;
                  customerName: string;
                  description?: string | null;
                  companyId?: string | null;
                  customerId?: string | null;
                  status: string;
                  priority: number;
                  dueDate: string | null;
                  stationProgress: Array<{ station: string; status: string }>;
                  isTempOrder?: boolean;
                  quickbooksOrderNum?: string | null;
                }) => (
                  <tr
                    key={order.id}
                    className={`border-b border-gray-50 transition-colors duration-100 hover:bg-gray-50/60 ${selectedIds.has(order.id) ? 'bg-primary-50/60' : ''}`}
                    style={{ borderLeft: order.priority >= 4 ? `3px solid ${PRIORITY_COLORS[order.priority]}` : undefined }}
                  >
                    {/* Checkbox */}
                    <td className="px-2 py-1.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleSelect(order.id); }}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {selectedIds.has(order.id) ? (
                          <CheckSquare className="h-4 w-4 text-primary-600" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                    </td>

                    {/* Order # */}
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Link
                          to={`/orders/${order.id}`}
                          className="text-primary-600 hover:text-primary-700 font-semibold text-sm hover:underline transition-colors"
                        >
                          #{order.orderNumber}
                        </Link>
                        {order.isTempOrder && (
                          <Link
                            to="/orders/temp"
                            className="inline-flex items-center gap-0.5 px-1 py-px text-[9px] font-bold bg-amber-100 text-amber-700 rounded hover:bg-amber-200 transition-colors leading-tight"
                            title="Temporary order"
                          >
                            <LinkIcon className="w-2.5 h-2.5" />TEMP
                          </Link>
                        )}
                      </div>
                    </td>

                    {/* Customer */}
                    <td className="px-3 py-1.5 max-w-[180px]">
                      <div className="truncate text-sm font-medium text-gray-900">
                        {order.companyId ? (
                          <Link to={`/companies/${order.companyId}`} className="hover:text-primary-600 hover:underline transition-colors">
                            {order.customerName}
                          </Link>
                        ) : order.customerId ? (
                          <Link to={`/sales/customers/${order.customerId}`} className="hover:text-primary-600 hover:underline transition-colors">
                            {order.customerName}
                          </Link>
                        ) : (
                          order.customerName
                        )}
                      </div>
                    </td>

                    {/* Description */}
                    <td className="px-3 py-1.5 max-w-[280px]">
                      <span className="text-xs text-gray-500 truncate block">
                        {order.description || <span className="text-gray-300">—</span>}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      <span
                        className="px-2 py-0.5 text-[11px] font-semibold rounded-full inline-flex items-center gap-1"
                        style={{
                          backgroundColor: `${STATUS_COLORS[order.status]}15`,
                          color: STATUS_COLORS[order.status],
                        }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[order.status] }} />
                        {STATUS_DISPLAY_NAMES[order.status]}
                      </span>
                    </td>

                    {/* Priority */}
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      <span
                        className="px-2 py-0.5 text-[11px] font-semibold rounded-full"
                        style={{
                          backgroundColor: `${PRIORITY_COLORS[order.priority]}15`,
                          color: PRIORITY_COLORS[order.priority],
                        }}
                      >
                        {PRIORITY_LABELS[order.priority]}
                      </span>
                    </td>

                    {/* Due Date */}
                    <td className="px-3 py-1.5 whitespace-nowrap text-xs">
                      {order.dueDate ? (
                        <span className={`inline-flex items-center gap-1 ${
                          ['COMPLETED', 'SHIPPED', 'CANCELLED'].includes(order.status)
                            ? 'text-gray-400'
                            : isOverdue(order.dueDate)
                            ? 'text-red-600 font-semibold'
                            : isToday(order.dueDate)
                            ? 'text-amber-600 font-semibold'
                            : 'text-gray-500'
                        }`}>
                          {isOverdue(order.dueDate) && !['COMPLETED', 'SHIPPED', 'CANCELLED'].includes(order.status) && (
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                          )}
                          {isToday(order.dueDate) && !['COMPLETED', 'SHIPPED', 'CANCELLED'].includes(order.status) && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                          )}
                          {new Date(order.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>

                    {/* Stations */}
                    <td className="px-3 py-1.5">
                      <div className="flex flex-wrap gap-0.5">
                        {order.stationProgress.map((sp) => (
                          <span
                            key={sp.station}
                            title={STATION_DISPLAY_NAMES[sp.station] || sp.station}
                            className={`px-1 py-px text-[9px] font-bold rounded leading-tight ${
                              sp.status === 'COMPLETED'
                                ? 'bg-green-100 text-green-700'
                                : sp.status === 'IN_PROGRESS'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-100 text-gray-400'
                            }`}
                          >
                            {(STATION_DISPLAY_NAMES[sp.station] || sp.station).slice(0, 3).toUpperCase()}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination — pinned bottom of table container */}
        {totalPages > 1 && (
          <div className="px-3 py-1.5 border-t border-gray-100 flex items-center justify-between bg-gray-50/80 flex-shrink-0">
            <p className="text-xs text-gray-500">
              Page <span className="font-semibold text-gray-800">{page}</span> of <span className="font-semibold text-gray-800">{totalPages}</span>
              {data?.total && <span className="text-gray-400"> · {data.total.toLocaleString()} orders</span>}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="px-1.5 py-1 text-xs border border-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white hover:border-gray-300 transition-colors font-medium text-gray-600"
                title="First page"
              >««</button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="inline-flex items-center gap-0.5 px-2 py-1 text-xs border border-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white hover:border-gray-300 transition-colors font-medium text-gray-600"
              >
                <ChevronLeft className="h-3 w-3" />Prev
              </button>
              
              <div className="hidden sm:flex items-center gap-0.5">
                {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 7) {
                    pageNum = i + 1;
                  } else if (page <= 4) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 3) {
                    pageNum = totalPages - 6 + i;
                  } else {
                    pageNum = page - 3 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`w-7 h-7 rounded text-xs font-medium transition-colors ${
                        page === pageNum
                          ? 'bg-primary-600 text-white shadow-sm'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="inline-flex items-center gap-0.5 px-2 py-1 text-xs border border-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white hover:border-gray-300 transition-colors font-medium text-gray-600"
              >
                Next<ChevronRight className="h-3 w-3" />
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                className="px-1.5 py-1 text-xs border border-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white hover:border-gray-300 transition-colors font-medium text-gray-600"
                title="Last page"
              >»»</button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Floating Overlays ─── */}
      <BulkActionsToolbar
        selectedIds={Array.from(selectedIds)}
        onClear={clearSelection}
        users={usersData ?? []}
      />

      {showLabelPrint && (
        <SmartLabelPrint onClose={() => setShowLabelPrint(false)} />
      )}

      {/* Save Filter Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Save Filter View</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">View Name</label>
              <input
                type="text"
                value={newFilterName}
                onChange={(e) => setNewFilterName(e.target.value)}
                placeholder="e.g., My In Progress Orders, Rush Jobs..."
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newFilterName.trim()) {
                    saveFilter(newFilterName.trim(), getCurrentFilterState());
                    setNewFilterName('');
                    setShowSaveModal(false);
                  }
                }}
              />
            </div>
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Filters to save:</p>
              <div className="flex flex-wrap gap-1">
                {statusFilter && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-white border text-gray-700">
                    Status: {STATUS_DISPLAY_NAMES[statusFilter as OrderStatus]}
                  </span>
                )}
                {search && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-white border text-gray-700">
                    Search: "{search}"
                  </span>
                )}
                {priorityFilter.length > 0 && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-white border text-gray-700">
                    Priority: {priorityFilter.map(p => PRIORITY_LABELS[p]).join(', ')}
                  </span>
                )}
                {stationFilter && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-white border text-gray-700">
                    Station: {STATION_DISPLAY_NAMES[stationFilter as keyof typeof STATION_DISPLAY_NAMES]}
                  </span>
                )}
                {dateFilter && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-white border text-gray-700">
                    {dateFilter === 'dueToday' ? 'Due Today' : dateFilter === 'dueThisWeek' ? 'Due This Week' : 'Overdue'}
                  </span>
                )}
                {hasAttachments !== undefined && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-white border text-gray-700">
                    {hasAttachments ? 'Has Attachments' : 'No Attachments'}
                  </span>
                )}
                {(dueDateFrom || dueDateTo) && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-white border text-gray-700">
                    Due: {dueDateFrom || '...'} - {dueDateTo || '...'}
                  </span>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setNewFilterName(''); setShowSaveModal(false); }}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >Cancel</button>
              <button
                onClick={() => {
                  if (newFilterName.trim()) {
                    saveFilter(newFilterName.trim(), getCurrentFilterState());
                    setNewFilterName('');
                    setShowSaveModal(false);
                  }
                }}
                disabled={!newFilterName.trim()}
                className="px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >Save View</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
