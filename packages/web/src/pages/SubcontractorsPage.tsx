import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, Search, AlertCircle } from 'lucide-react';
import { api } from '../lib/api';

type SubcontractorRow = {
  id: string;
  name: string;
  company?: string | null;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  isActive?: boolean;
};

function toSubcontractorRows(payload: unknown): SubcontractorRow[] {
  const data = (payload as { data?: unknown })?.data;
  const items = (data as { items?: unknown })?.items;
  if (!Array.isArray(items)) return [];

  return items
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => ({
      id: String(item.id ?? ''),
      name: String(item.name ?? 'Unnamed subcontractor'),
      company: typeof item.company === 'string' ? item.company : null,
      contactName: typeof item.contactName === 'string' ? item.contactName : null,
      email: typeof item.email === 'string' ? item.email : null,
      phone: typeof item.phone === 'string' ? item.phone : null,
      isActive: typeof item.isActive === 'boolean' ? item.isActive : false,
    }))
    .filter((item) => item.id.length > 0);
}

export function SubcontractorsPage() {
  const [search, setSearch] = useState('');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['subcontractors', search],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', '1');
      params.set('pageSize', '200');
      if (search.trim()) params.set('search', search.trim());
      const response = await api.get(`/subcontractors?${params.toString()}`);
      return response.data;
    },
  });

  const rows = useMemo(() => toSubcontractorRows(data), [data]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-sky-100 p-3 text-sky-700">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Subcontractors</h1>
            <p className="text-sm text-gray-500">External partners used for outsourced work.</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <label htmlFor="subcontractor-search" className="sr-only">
          Search subcontractors
        </label>
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            id="subcontractor-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, company, contact, email, or phone"
            className="input pl-9"
          />
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white">
        {isLoading ? (
          <div className="p-6 text-sm text-gray-500">Loading subcontractors...</div>
        ) : null}

        {!isLoading && isError ? (
          <div className="p-6">
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
              <AlertCircle className="mt-0.5 h-5 w-5" />
              <div>
                <p className="font-medium">Could not load subcontractors</p>
                <p className="text-sm opacity-90">
                  {error instanceof Error ? error.message : 'The server returned an unexpected response.'}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {!isLoading && !isError && rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            No subcontractors found. Try adjusting your search or add records in the back office.
          </div>
        ) : null}

        {!isLoading && !isError && rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Company</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Contact</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{row.company ?? '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{row.contactName ?? '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{row.email ?? '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{row.phone ?? '-'}</td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                          row.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {row.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}

