import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Shield, ShieldCheck, User, Eye, X, Users, Mail, Settings } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/auth';
import { STATION_DISPLAY_NAMES } from '@erp/shared';

const ROLES = ['ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER'] as const;
const STATIONS = ['ROLL_TO_ROLL', 'SCREEN_PRINT', 'PRODUCTION', 'FLATBED', 'DESIGN', 'SALES', 'INSTALLATION', 'ORDER_ENTRY', 'SHIPPING_RECEIVING'] as const;

const roleIcons: Record<string, typeof Shield> = {
  ADMIN: ShieldCheck,
  MANAGER: Shield,
  OPERATOR: User,
  VIEWER: Eye,
};

const roleColors: Record<string, string> = {
  ADMIN: 'text-purple-700 bg-purple-100 border border-purple-200',
  MANAGER: 'text-blue-700 bg-blue-100 border border-blue-200',
  OPERATOR: 'text-green-700 bg-green-100 border border-green-200',
  VIEWER: 'text-gray-700 bg-gray-100 border border-gray-200',
};

interface UserForm {
  id?: string;
  username: string;
  password: string;
  displayName: string;
  email: string | null;
  role: string;
  allowedStations: string[];
  isActive: boolean;
}

const emptyForm: UserForm = {
  username: '',
  password: '',
  displayName: '',
  email: '',
  role: 'OPERATOR',
  allowedStations: [],
  isActive: true,
};

/** Auto-generate username (LastNameFirstInitial) and password (FirstNameYY) from display name */
function generateCredentials(displayName: string): { username: string; password: string } {
  const parts = displayName.trim().split(/\s+/);
  if (parts.length < 2) return { username: '', password: '' };
  const firstName = parts[0];
  const lastName = parts[parts.length - 1];
  const year = new Date().getFullYear().toString();
  return {
    username: lastName + firstName.charAt(0),
    password: firstName + year,
  };
}

export function UsersPage() {
  const currentUser = useAuthStore((state) => state.user);
  const isAdmin = currentUser?.role === 'ADMIN';
  const queryClient = useQueryClient();

  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserForm | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);

  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.get('/users', { params: { pageSize: 50 } });
      return response.data.data;
    },
    enabled: currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER',
  });

  const createMutation = useMutation({
    mutationFn: async (data: object) => api.post('/users', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User created successfully');
      resetForm();
    },
    onError: () => toast.error('Failed to create user'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: object }) => api.patch(`/users/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User updated successfully');
      resetForm();
    },
    onError: () => toast.error('Failed to update user'),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (userId: string) => {
      // Find the user to generate their default password
      const targetUser = users.find((u: { id: string }) => u.id === userId);
      if (!targetUser) throw new Error('User not found');
      const creds = generateCredentials(targetUser.displayName);
      const newPassword = creds.password || 'Password2026';
      await api.post(`/users/${userId}/password`, { currentPassword: '', newPassword });
      return newPassword;
    },
    onSuccess: (newPassword) => {
      toast.success(`Password reset to: ${newPassword}`);
    },
    onError: () => toast.error('Failed to reset password'),
  });

  const resetForm = () => {
    setShowModal(false);
    setEditingUser(null);
    setForm(emptyForm);
  };

  const openAddModal = () => {
    setEditingUser(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEditModal = (user: Omit<UserForm, 'password'> & { id: string }) => {
    setEditingUser({ ...user, password: '' });
    setForm({
      ...user,
      password: '', // Don't show password
    });
    setShowModal(true);
  };

  const toggleStation = (station: string) => {
    if (form.allowedStations.includes(station)) {
      setForm({ ...form, allowedStations: form.allowedStations.filter((s) => s !== station) });
    } else {
      setForm({ ...form, allowedStations: [...form.allowedStations, station] });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser?.id) {
      const { username, password, ...updateData } = form;
      updateMutation.mutate({ id: editingUser.id, data: updateData });
    } else {
      createMutation.mutate(form);
    }
  };

  const users = data?.items ?? [];

  if (currentUser?.role !== 'ADMIN' && currentUser?.role !== 'MANAGER') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <span className="text-4xl">🔒</span>
          <span className="text-gray-500 text-lg">You don't have permission to view this page.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-lg">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Team Members</h1>
              <p className="text-gray-500">{data?.total ?? 0} users in the system</p>
            </div>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={openAddModal}
            className="inline-flex items-center px-4 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl hover:from-primary-700 hover:to-primary-800 shadow-lg shadow-primary-200 transition-all font-medium"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Add User
          </button>
        )}
      </div>

      {/* User Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={resetForm}>
          <div className="modal-content max-w-md w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 text-white">
                    {editingUser ? <Settings className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {editingUser ? 'Edit User' : 'Add User'}
                  </h3>
                </div>
                <button onClick={resetForm} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                {!editingUser && (
                  <>
                    <div>
                      <label className="label-text">
                        Username * <span className="text-xs text-gray-400 font-normal">(auto: LastNameFirstInitial)</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={form.username}
                        onChange={(e) => setForm({ ...form, username: e.target.value })}
                        className="input-field font-mono"
                        placeholder="BundaJ"
                      />
                    </div>
                    <div>
                      <label className="label-text">
                        Password * <span className="text-xs text-gray-400 font-normal">(auto: FirstNameYYYY)</span>
                      </label>
                      <input
                        type="text"
                        required
                        autoComplete="new-password"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        className="input-field font-mono"
                        placeholder="Jacob2026"
                      />
                    </div>
                  </>
                )}
                <div>
                  <label className="label-text">
                    Display Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.displayName}
                    onChange={(e) => {
                      const displayName = e.target.value;
                      if (!editingUser) {
                        const creds = generateCredentials(displayName);
                        setForm({ ...form, displayName, username: creds.username, password: creds.password });
                      } else {
                        setForm({ ...form, displayName });
                      }
                    }}
                    className="input-field"
                    placeholder="First Last (e.g., Jacob Bunda)"
                  />
                  {!editingUser && form.displayName && form.username && (
                    <p className="text-xs text-gray-500 mt-1">
                      Login: <span className="font-mono font-medium">{form.username}</span> / <span className="font-mono font-medium">{form.password}</span>
                    </p>
                  )}
                </div>
                <div>
                  <label className="label-text">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="email"
                      value={form.email ?? ''}
                      onChange={(e) => setForm({ ...form, email: e.target.value || null })}
                      className="input-field pl-10"
                      placeholder="user@example.com"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label-text">Role</label>
                    <select
                      value={form.role}
                      onChange={(e) => setForm({ ...form, role: e.target.value })}
                      className="select-field"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                  {editingUser && (
                    <div>
                      <label className="label-text">Status</label>
                      <select
                        value={form.isActive ? 'active' : 'inactive'}
                        onChange={(e) => setForm({ ...form, isActive: e.target.value === 'active' })}
                        className="select-field"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                  )}
                </div>
                <div>
                  <label className="label-text mb-2">Allowed Stations</label>
                  <div className="flex flex-wrap gap-2">
                    {STATIONS.map((station) => (
                      <button
                        key={station}
                        type="button"
                        onClick={() => toggleStation(station)}
                        className={`px-3 py-2 text-sm rounded-xl transition-all font-medium ${
                          form.allowedStations.includes(station)
                            ? 'bg-primary-600 text-white shadow-md shadow-primary-200'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {STATION_DISPLAY_NAMES[station]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="btn-primary"
                  >
                    {createMutation.isPending || updateMutation.isPending
                      ? 'Saving...'
                      : editingUser
                      ? 'Update User'
                      : 'Create User'}
                  </button>
                </div>
              </form>
            </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-soft border border-gray-100 overflow-hidden animate-fade-in">
        <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gradient-to-r from-gray-50 to-white">
            <tr>
              <th className="table-header cursor-default">
                User
              </th>
              <th className="table-header cursor-default">
                Role
              </th>
              <th className="table-header cursor-default">
                Stations
              </th>
              <th className="table-header cursor-default">
                Status
              </th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              // Skeleton loading rows
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-200" />
                      <div>
                        <div className="h-4 bg-gray-200 rounded w-28 mb-2" />
                        <div className="h-3 bg-gray-100 rounded w-20" />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4"><div className="h-6 bg-gray-200 rounded-full w-20" /></td>
                  <td className="px-6 py-4"><div className="flex gap-1"><div className="h-5 w-14 bg-gray-200 rounded" /><div className="h-5 w-12 bg-gray-200 rounded" /></div></td>
                  <td className="px-6 py-4"><div className="h-6 bg-gray-200 rounded-full w-16" /></td>
                  <td className="px-6 py-4 text-right"><div className="h-6 bg-gray-200 rounded w-12 ml-auto" /></td>
                </tr>
              ))
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-3xl">👥</span>
                    <span className="text-gray-500">No users found</span>
                  </div>
                </td>
              </tr>
            ) : (
              users.map((user: {
                id: string;
                username: string;
                displayName: string;
                email: string | null;
                role: string;
                isActive: boolean;
                allowedStations: string[];
              }, index: number) => {
                const RoleIcon = roleIcons[user.role] ?? User;
                return (
                  <tr key={user.id} className="table-row" style={{ animationDelay: `${index * 20}ms` }}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-semibold text-sm">
                          {user.displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">
                            {user.displayName}
                          </p>
                          <p className="text-sm text-gray-500">@{user.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full ${roleColors[user.role]}`}
                      >
                        <RoleIcon className="h-3 w-3" />
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {user.allowedStations.length === 0 ? (
                          <span className="text-gray-400 text-sm italic">None assigned</span>
                        ) : (
                          user.allowedStations.map((station) => (
                            <span
                              key={station}
                              className="px-2 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-600 rounded border border-gray-200"
                            >
                              {STATION_DISPLAY_NAMES[station] || station.replace('_', ' ')}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full ${
                          user.isActive
                            ? 'bg-green-100 text-green-700 border border-green-200'
                            : 'bg-red-100 text-red-700 border border-red-200'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${user.isActive ? 'bg-green-500' : 'bg-red-500'}`}></span>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {isAdmin && (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(user)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
                          >
                            <Settings className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Reset password for ${user.displayName}?`)) {
                                resetPasswordMutation.mutate(user.id);
                              }
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                          >
                            Reset PW
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
