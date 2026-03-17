import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import {
  User,
  Building,
  Mail,
  Phone,
  Lock,
  Loader2,
  CheckCircle2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { profileApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { NotificationPreferences } from '@/components/NotificationPreferences';

interface ProfileFormData {
  firstName: string;
  lastName: string;
  phone: string;
}

interface PasswordFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export function ProfilePage() {
  const queryClient = useQueryClient();
  const { user, updateUser } = useAuthStore();
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['portal-profile'],
    queryFn: () => profileApi.get().then((r) => r.data.data),
  });

  const {
    register: registerProfile,
    handleSubmit: handleProfileSubmit,
    formState: { errors: profileErrors },
  } = useForm<ProfileFormData>({
    values: profile
      ? {
          firstName: profile.firstName,
          lastName: profile.lastName,
          phone: profile.phone || '',
        }
      : undefined,
  });

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    reset: resetPassword,
    watch,
    formState: { errors: passwordErrors },
  } = useForm<PasswordFormData>();

  const newPassword = watch('newPassword');

  const profileMutation = useMutation({
    mutationFn: profileApi.update,
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['portal-profile'] });
      updateUser(response.data.data);
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    },
  });

  const passwordMutation = useMutation({
    mutationFn: profileApi.changePassword,
    onSuccess: () => {
      resetPassword();
      setShowPasswordForm(false);
      setPasswordSuccess(true);
      setTimeout(() => setPasswordSuccess(false), 3000);
    },
  });

  const onProfileSubmit = (data: ProfileFormData) => {
    profileMutation.mutate(data);
  };

  const onPasswordSubmit = (data: PasswordFormData) => {
    passwordMutation.mutate({
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profile Settings</h1>
        <p className="mt-1 text-gray-500">
          Manage your account information and password
        </p>
      </div>

      {/* Profile Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
      >
        <div className="card-header flex items-center gap-4">
          <div className="w-16 h-16 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-2xl font-bold">
            {user?.firstName?.charAt(0)}
            {user?.lastName?.charAt(0)}
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {user?.firstName} {user?.lastName}
            </h2>
            <p className="text-gray-500">{user?.email}</p>
          </div>
        </div>
        <form onSubmit={handleProfileSubmit(onProfileSubmit)}>
          <div className="card-body space-y-4">
            {profileSuccess && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Profile updated successfully
              </div>
            )}

            {profileMutation.isError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                Failed to update profile. Please try again.
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">First Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    className="input pl-9"
                    {...registerProfile('firstName', {
                      required: 'First name is required',
                    })}
                  />
                </div>
                {profileErrors.firstName && (
                  <p className="mt-1 text-sm text-red-600">
                    {profileErrors.firstName.message}
                  </p>
                )}
              </div>
              <div>
                <label className="label">Last Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    className="input pl-9"
                    {...registerProfile('lastName', {
                      required: 'Last name is required',
                    })}
                  />
                </div>
                {profileErrors.lastName && (
                  <p className="mt-1 text-sm text-red-600">
                    {profileErrors.lastName.message}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="label">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="tel"
                  className="input pl-9"
                  placeholder="(555) 123-4567"
                  {...registerProfile('phone')}
                />
              </div>
            </div>

            <div>
              <label className="label">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={profile?.email || ''}
                  disabled
                  className="input pl-9 bg-gray-50"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Contact us to change your email address
              </p>
            </div>
          </div>
          <div className="p-6 border-t border-gray-200 flex justify-end">
            <button
              type="submit"
              disabled={profileMutation.isPending}
              className="btn btn-primary"
            >
              {profileMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 spinner" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </motion.div>

      {/* Company Info */}
      {profile?.customer && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card"
        >
          <div className="card-header">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Building className="w-5 h-5 text-gray-400" />
              Company Information
            </h2>
          </div>
          <div className="card-body space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Company Name</p>
                <p className="font-medium text-gray-900">
                  {profile.customer.companyName || profile.customer.name}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Phone</p>
                <p className="font-medium text-gray-900">
                  {profile.customer.phone || '-'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Email</p>
                <p className="font-medium text-gray-900">
                  {profile.customer.email || '-'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Address</p>
                <p className="font-medium text-gray-900">
                  {profile.customer.address
                    ? `${profile.customer.address}, ${profile.customer.city}, ${profile.customer.state} ${profile.customer.zipCode}`
                    : '-'}
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Contact us to update company information
            </p>
          </div>
        </motion.div>
      )}

      {/* Notification Preferences */}
      <NotificationPreferences />

      {/* Password Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="card"
      >
        <div className="card-header flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Lock className="w-5 h-5 text-gray-400" />
            Password
          </h2>
          {!showPasswordForm && (
            <button
              onClick={() => setShowPasswordForm(true)}
              className="btn btn-secondary"
            >
              Change Password
            </button>
          )}
        </div>

        {passwordSuccess && (
          <div className="mx-6 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Password changed successfully
          </div>
        )}

        {showPasswordForm ? (
          <form onSubmit={handlePasswordSubmit(onPasswordSubmit)}>
            <div className="card-body space-y-4">
              {passwordMutation.isError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {(passwordMutation.error as any)?.response?.data?.error ||
                    'Failed to change password'}
                </div>
              )}

              <div>
                <label className="label">Current Password</label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    className="input pr-10"
                    {...registerPassword('currentPassword', {
                      required: 'Current password is required',
                    })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {passwordErrors.currentPassword && (
                  <p className="mt-1 text-sm text-red-600">
                    {passwordErrors.currentPassword.message}
                  </p>
                )}
              </div>

              <div>
                <label className="label">New Password</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    className="input pr-10"
                    {...registerPassword('newPassword', {
                      required: 'New password is required',
                      minLength: {
                        value: 8,
                        message: 'Password must be at least 8 characters',
                      },
                    })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNewPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {passwordErrors.newPassword && (
                  <p className="mt-1 text-sm text-red-600">
                    {passwordErrors.newPassword.message}
                  </p>
                )}
              </div>

              <div>
                <label className="label">Confirm New Password</label>
                <input
                  type="password"
                  className="input"
                  {...registerPassword('confirmPassword', {
                    required: 'Please confirm your password',
                    validate: (value: string) =>
                      value === newPassword || 'Passwords do not match',
                  })}
                />
                {passwordErrors.confirmPassword && (
                  <p className="mt-1 text-sm text-red-600">
                    {passwordErrors.confirmPassword.message}
                  </p>
                )}
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowPasswordForm(false);
                  resetPassword();
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={passwordMutation.isPending}
                className="btn btn-primary"
              >
                {passwordMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 spinner" />
                    Changing...
                  </>
                ) : (
                  'Change Password'
                )}
              </button>
            </div>
          </form>
        ) : (
          <div className="card-body">
            <p className="text-sm text-gray-500">
              Last changed: Never
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
