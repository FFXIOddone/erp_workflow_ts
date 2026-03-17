import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Bell,
  Mail,
  MessageSquare,
  Package,
  FileCheck,
  Truck,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { notificationApi } from '@/lib/api';

interface NotificationPreference {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  emailEnabled: boolean;
  portalEnabled: boolean;
}

const defaultPreferences: NotificationPreference[] = [
  {
    id: 'order_status',
    label: 'Order Status Updates',
    description: 'Get notified when your order status changes',
    icon: Package,
    emailEnabled: true,
    portalEnabled: true,
  },
  {
    id: 'proof_ready',
    label: 'Proof Ready for Review',
    description: 'Get notified when a new proof is available',
    icon: FileCheck,
    emailEnabled: true,
    portalEnabled: true,
  },
  {
    id: 'shipment_updates',
    label: 'Shipment Updates',
    description: 'Get notified about shipping and delivery status',
    icon: Truck,
    emailEnabled: true,
    portalEnabled: true,
  },
  {
    id: 'new_messages',
    label: 'New Messages',
    description: 'Get notified when you receive a new message',
    icon: MessageSquare,
    emailEnabled: true,
    portalEnabled: true,
  },
];

export function NotificationPreferences() {
  const queryClient = useQueryClient();
  const [preferences, setPreferences] = useState<NotificationPreference[]>(defaultPreferences);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Fetch notification preferences
  const { data: savedPrefs, isLoading } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: () => notificationApi.getPreferences().then((r) => r.data.data),
  });

  // Update local state when data is fetched
  useEffect(() => {
    if (savedPrefs?.preferences) {
      setPreferences((prev) =>
        prev.map((pref) => {
          const saved = savedPrefs.preferences[pref.id];
          if (saved) {
            return {
              ...pref,
              emailEnabled: saved.emailEnabled ?? pref.emailEnabled,
              portalEnabled: saved.portalEnabled ?? pref.portalEnabled,
            };
          }
          return pref;
        })
      );
    }
  }, [savedPrefs]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: notificationApi.updatePreferences,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
  });

  const togglePreference = (id: string, type: 'emailEnabled' | 'portalEnabled') => {
    setPreferences((prev) =>
      prev.map((pref) =>
        pref.id === id ? { ...pref, [type]: !pref[type] } : pref
      )
    );
  };

  const handleSave = () => {
    const prefsToSave = preferences.reduce(
      (acc, pref) => ({
        ...acc,
        [pref.id]: {
          emailEnabled: pref.emailEnabled,
          portalEnabled: pref.portalEnabled,
        },
      }),
      {} as Record<string, { emailEnabled: boolean; portalEnabled: boolean }>
    );
    saveMutation.mutate({ preferences: prefsToSave });
  };

  if (isLoading) {
    return (
      <div className="card">
        <div className="card-body flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="card"
    >
      <div className="card-header">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Bell className="w-5 h-5 text-gray-400" />
          Notification Preferences
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Choose how you want to be notified about updates
        </p>
      </div>

      <div className="card-body space-y-1">
        {saveSuccess && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Notification preferences saved successfully
          </div>
        )}

        {saveMutation.isError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            Failed to save preferences. Please try again.
          </div>
        )}

        {/* Header row */}
        <div className="flex items-center justify-end gap-4 px-4 pb-2 border-b border-gray-100">
          <div className="w-16 text-center">
            <Mail className="w-4 h-4 mx-auto text-gray-400" />
            <span className="text-xs text-gray-500">Email</span>
          </div>
          <div className="w-16 text-center">
            <Bell className="w-4 h-4 mx-auto text-gray-400" />
            <span className="text-xs text-gray-500">Portal</span>
          </div>
        </div>

        {/* Preference items */}
        {preferences.map((pref) => {
          const Icon = pref.icon;
          return (
            <div
              key={pref.id}
              className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{pref.label}</p>
                  <p className="text-sm text-gray-500">{pref.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-16 flex justify-center">
                  <button
                    type="button"
                    onClick={() => togglePreference(pref.id, 'emailEnabled')}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                      pref.emailEnabled ? 'bg-primary-600' : 'bg-gray-200'
                    }`}
                    role="switch"
                    aria-checked={pref.emailEnabled}
                    aria-label={`Email notifications for ${pref.label}`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        pref.emailEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
                <div className="w-16 flex justify-center">
                  <button
                    type="button"
                    onClick={() => togglePreference(pref.id, 'portalEnabled')}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                      pref.portalEnabled ? 'bg-primary-600' : 'bg-gray-200'
                    }`}
                    role="switch"
                    aria-checked={pref.portalEnabled}
                    aria-label={`Portal notifications for ${pref.label}`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        pref.portalEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-6 border-t border-gray-200 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="btn btn-primary"
        >
          {saveMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 spinner" />
              Saving...
            </>
          ) : (
            'Save Preferences'
          )}
        </button>
      </div>
    </motion.div>
  );
}
