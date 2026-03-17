import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  User,
  Camera,
  Lock,
  Calendar,
  Clock,
  Plus,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Save,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/auth';

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TIME_OFF_TYPES = ['VACATION', 'SICK', 'PERSONAL', 'UNPAID', 'HOLIDAY', 'OTHER'];

interface WorkSchedule {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

interface TimeOffRequest {
  id: string;
  startDate: string;
  endDate: string;
  type: string;
  status: string;
  reason: string | null;
}

interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  role: string;
  profilePhoto: string | null;
  workSchedules: WorkSchedule[];
  timeOffRequests: TimeOffRequest[];
}

export function ProfilePage() {
  const queryClient = useQueryClient();
  const { user: authUser, setUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'profile' | 'schedule' | 'timeoff'>('profile');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile form state
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');

  // Password form state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Schedule form state
  const [schedules, setSchedules] = useState<Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isActive: boolean;
  }>>([]);

  // Time off form state
  const [showTimeOffForm, setShowTimeOffForm] = useState(false);
  const [timeOffStart, setTimeOffStart] = useState('');
  const [timeOffEnd, setTimeOffEnd] = useState('');
  const [timeOffType, setTimeOffType] = useState('VACATION');
  const [timeOffReason, setTimeOffReason] = useState('');

  const { data: profile, isLoading } = useQuery<UserProfile>({
    queryKey: ['profile'],
    queryFn: async () => {
      const response = await api.get('/users/me/profile');
      return response.data.data;
    },
  });

  // Initialize form state when profile data loads
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName);
      setEmail(profile.email || '');
      if (profile.workSchedules.length > 0) {
        setSchedules(profile.workSchedules.map(s => ({
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
          isActive: s.isActive,
        })));
      } else {
        // Initialize with default schedule (Mon-Fri 9-5)
        setSchedules([
          { dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isActive: true },
          { dayOfWeek: 2, startTime: '09:00', endTime: '17:00', isActive: true },
          { dayOfWeek: 3, startTime: '09:00', endTime: '17:00', isActive: true },
          { dayOfWeek: 4, startTime: '09:00', endTime: '17:00', isActive: true },
          { dayOfWeek: 5, startTime: '09:00', endTime: '17:00', isActive: true },
        ]);
      }
    }
  }, [profile]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { displayName?: string; email?: string; profilePhoto?: string }) => {
      const response = await api.patch('/users/me/profile', data);
      return response.data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setUser({ ...authUser!, displayName: data.displayName, email: data.email });
      toast.success('Profile updated');
    },
    onError: () => {
      toast.error('Failed to update profile');
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      await api.post(`/users/${authUser?.id}/password`, data);
    },
    onSuccess: () => {
      toast.success('Password changed successfully');
      setShowPasswordForm(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: () => {
      toast.error('Failed to change password. Check your current password.');
    },
  });

  const updateScheduleMutation = useMutation({
    mutationFn: async (scheduleData: typeof schedules) => {
      const response = await api.put('/users/me/schedule', { schedules: scheduleData });
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Work schedule updated');
    },
    onError: () => {
      toast.error('Failed to update schedule');
    },
  });

  const createTimeOffMutation = useMutation({
    mutationFn: async (data: { startDate: string; endDate: string; type: string; reason?: string }) => {
      const response = await api.post('/users/me/time-off', data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Time off request submitted');
      setShowTimeOffForm(false);
      setTimeOffStart('');
      setTimeOffEnd('');
      setTimeOffType('VACATION');
      setTimeOffReason('');
    },
    onError: () => {
      toast.error('Failed to submit time off request');
    },
  });

  const cancelTimeOffMutation = useMutation({
    mutationFn: async (requestId: string) => {
      await api.delete(`/users/me/time-off/${requestId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Time off request cancelled');
    },
    onError: () => {
      toast.error('Failed to cancel request');
    },
  });

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: { displayName?: string; email?: string } = { displayName };
    if (email) data.email = email;
    updateProfileMutation.mutate(data);
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Convert to base64 for simple storage (in production, use proper file upload)
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      updateProfileMutation.mutate({ profilePhoto: base64 });
    };
    reader.readAsDataURL(file);
  };

  const handleScheduleSave = () => {
    updateScheduleMutation.mutate(schedules);
  };

  const toggleDayActive = (dayOfWeek: number) => {
    const existing = schedules.find(s => s.dayOfWeek === dayOfWeek);
    if (existing) {
      setSchedules(schedules.map(s => 
        s.dayOfWeek === dayOfWeek ? { ...s, isActive: !s.isActive } : s
      ));
    } else {
      setSchedules([...schedules, { dayOfWeek, startTime: '09:00', endTime: '17:00', isActive: true }]);
    }
  };

  const updateScheduleTime = (dayOfWeek: number, field: 'startTime' | 'endTime', value: string) => {
    setSchedules(schedules.map(s => 
      s.dayOfWeek === dayOfWeek ? { ...s, [field]: value } : s
    ));
  };

  const handleTimeOffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: { startDate: string; endDate: string; type: string; reason?: string } = {
      startDate: timeOffStart,
      endDate: timeOffEnd,
      type: timeOffType,
    };
    if (timeOffReason) data.reason = timeOffReason;
    createTimeOffMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center overflow-hidden">
            {profile?.profilePhoto ? (
              <img src={profile.profilePhoto} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              <span className="text-3xl font-bold text-white">
                {profile?.displayName?.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="absolute -bottom-1 -right-1 p-2 bg-white rounded-full shadow-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <Camera className="h-4 w-4 text-gray-600" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoUpload}
            className="hidden"
          />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{profile?.displayName}</h1>
          <p className="text-gray-500">@{profile?.username} • {profile?.role}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="border-b border-gray-100 flex">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'profile'
                ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <User className="h-4 w-4" />
            Profile
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'schedule'
                ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Clock className="h-4 w-4" />
            Work Schedule
          </button>
          <button
            onClick={() => setActiveTab('timeoff')}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'timeoff'
                ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Calendar className="h-4 w-4" />
            Time Off
          </button>
        </div>

        <div className="p-6">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <form onSubmit={handleProfileSubmit} className="space-y-4">
                <div>
                  <label className="label-text">Display Name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="label-text">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-field"
                    placeholder="optional"
                  />
                </div>
                <button
                  type="submit"
                  disabled={updateProfileMutation.isPending}
                  className="btn-primary"
                >
                  {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </form>

              <hr className="border-gray-200" />

              {/* Password Change */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Change Password
                </h3>
                {!showPasswordForm ? (
                  <button
                    onClick={() => setShowPasswordForm(true)}
                    className="btn-secondary"
                  >
                    Change Password
                  </button>
                ) : (
                  <form onSubmit={handlePasswordSubmit} className="space-y-4">
                    <div>
                      <label className="label-text">Current Password</label>
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="input-field"
                        required
                      />
                    </div>
                    <div>
                      <label className="label-text">New Password</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="input-field"
                        required
                        minLength={6}
                      />
                    </div>
                    <div>
                      <label className="label-text">Confirm New Password</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="input-field"
                        required
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="submit"
                        disabled={changePasswordMutation.isPending}
                        className="btn-primary"
                      >
                        {changePasswordMutation.isPending ? 'Changing...' : 'Change Password'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowPasswordForm(false)}
                        className="btn-secondary"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* Schedule Tab */}
          {activeTab === 'schedule' && (
            <div className="space-y-6">
              <p className="text-gray-600">Set your regular work hours for each day of the week.</p>
              
              <div className="space-y-3">
                {DAYS_OF_WEEK.map((day, index) => {
                  const schedule = schedules.find(s => s.dayOfWeek === index);
                  const isActive = schedule?.isActive ?? false;
                  
                  return (
                    <div
                      key={day}
                      className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${
                        isActive ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleDayActive(index)}
                        className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                          isActive ? 'bg-green-500 text-white' : 'bg-gray-300 text-white'
                        }`}
                      >
                        {isActive && <Check className="h-4 w-4" />}
                      </button>
                      <span className="w-28 font-medium text-gray-900">{day}</span>
                      {isActive ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="time"
                            value={schedule?.startTime ?? '09:00'}
                            onChange={(e) => updateScheduleTime(index, 'startTime', e.target.value)}
                            className="input-field w-32"
                          />
                          <span className="text-gray-500">to</span>
                          <input
                            type="time"
                            value={schedule?.endTime ?? '17:00'}
                            onChange={(e) => updateScheduleTime(index, 'endTime', e.target.value)}
                            className="input-field w-32"
                          />
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">Day off</span>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                onClick={handleScheduleSave}
                disabled={updateScheduleMutation.isPending}
                className="btn-primary flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                {updateScheduleMutation.isPending ? 'Saving...' : 'Save Schedule'}
              </button>
            </div>
          )}

          {/* Time Off Tab */}
          {activeTab === 'timeoff' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <p className="text-gray-600">Request time off or view your requests.</p>
                <button
                  onClick={() => setShowTimeOffForm(true)}
                  className="btn-primary flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Request Time Off
                </button>
              </div>

              {showTimeOffForm && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-4">New Time Off Request</h4>
                  <form onSubmit={handleTimeOffSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="label-text">Start Date</label>
                        <input
                          type="date"
                          value={timeOffStart}
                          onChange={(e) => setTimeOffStart(e.target.value)}
                          className="input-field"
                          required
                        />
                      </div>
                      <div>
                        <label className="label-text">End Date</label>
                        <input
                          type="date"
                          value={timeOffEnd}
                          onChange={(e) => setTimeOffEnd(e.target.value)}
                          className="input-field"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="label-text">Type</label>
                      <select
                        value={timeOffType}
                        onChange={(e) => setTimeOffType(e.target.value)}
                        className="select-field"
                      >
                        {TIME_OFF_TYPES.map(type => (
                          <option key={type} value={type}>
                            {type.charAt(0) + type.slice(1).toLowerCase()}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label-text">Reason (optional)</label>
                      <textarea
                        value={timeOffReason}
                        onChange={(e) => setTimeOffReason(e.target.value)}
                        className="input-field"
                        rows={2}
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="submit"
                        disabled={createTimeOffMutation.isPending}
                        className="btn-primary"
                      >
                        {createTimeOffMutation.isPending ? 'Submitting...' : 'Submit Request'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowTimeOffForm(false)}
                        className="btn-secondary"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Time Off Requests List */}
              <div className="space-y-3">
                {profile?.timeOffRequests?.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Calendar className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                    <p>No time off requests</p>
                  </div>
                ) : (
                  profile?.timeOffRequests?.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${
                          request.status === 'APPROVED' ? 'bg-green-100' :
                          request.status === 'DENIED' ? 'bg-red-100' :
                          request.status === 'CANCELLED' ? 'bg-gray-100' :
                          'bg-amber-100'
                        }`}>
                          <Calendar className={`h-5 w-5 ${
                            request.status === 'APPROVED' ? 'text-green-600' :
                            request.status === 'DENIED' ? 'text-red-600' :
                            request.status === 'CANCELLED' ? 'text-gray-600' :
                            'text-amber-600'
                          }`} />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {new Date(request.startDate).toLocaleDateString()} - {new Date(request.endDate).toLocaleDateString()}
                          </p>
                          <p className="text-sm text-gray-500">
                            {request.type.charAt(0) + request.type.slice(1).toLowerCase()}
                            {request.reason && ` - ${request.reason}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                          request.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                          request.status === 'DENIED' ? 'bg-red-100 text-red-700' :
                          request.status === 'CANCELLED' ? 'bg-gray-100 text-gray-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {request.status}
                        </span>
                        {request.status === 'PENDING' && (
                          <button
                            onClick={() => cancelTimeOffMutation.mutate(request.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Cancel request"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
