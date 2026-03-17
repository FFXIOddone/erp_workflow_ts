import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  Package,
  ClipboardList,
  Clock,
  AlertTriangle,
  Calendar,
  FileText,
  MessageSquare,
  Settings,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import type { Notification, NotificationType } from '@erp/shared';
import { api } from '../lib/api';

const notificationIcons: Record<NotificationType, React.ElementType> = {
  ORDER_CREATED: Package,
  ORDER_STATUS_CHANGED: ClipboardList,
  ORDER_ASSIGNED: ClipboardList,
  ORDER_DUE_SOON: Clock,
  ORDER_OVERDUE: AlertTriangle,
  STATION_COMPLETED: Check,
  REPRINT_REQUESTED: AlertTriangle,
  REPRINT_RESOLVED: Check,
  TIME_OFF_APPROVED: Calendar,
  TIME_OFF_DENIED: Calendar,
  QUOTE_APPROVED: FileText,
  QUOTE_REJECTED: FileText,
  MENTION: MessageSquare,
  SYSTEM: Settings,
};

const notificationColors: Record<NotificationType, string> = {
  ORDER_CREATED: 'bg-green-100 text-green-600',
  ORDER_STATUS_CHANGED: 'bg-blue-100 text-blue-600',
  ORDER_ASSIGNED: 'bg-purple-100 text-purple-600',
  ORDER_DUE_SOON: 'bg-yellow-100 text-yellow-600',
  ORDER_OVERDUE: 'bg-red-100 text-red-600',
  STATION_COMPLETED: 'bg-green-100 text-green-600',
  REPRINT_REQUESTED: 'bg-orange-100 text-orange-600',
  REPRINT_RESOLVED: 'bg-green-100 text-green-600',
  TIME_OFF_APPROVED: 'bg-green-100 text-green-600',
  TIME_OFF_DENIED: 'bg-red-100 text-red-600',
  QUOTE_APPROVED: 'bg-green-100 text-green-600',
  QUOTE_REJECTED: 'bg-red-100 text-red-600',
  MENTION: 'bg-blue-100 text-blue-600',
  SYSTEM: 'bg-gray-100 text-gray-600',
};

export function NotificationsPage() {
  const queryClient = useQueryClient();

  const { data: notifications, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: Notification[] }>('/notifications');
      return res.data.data;
    },
  });

  const { data: countData } = useQuery({
    queryKey: ['notifications', 'count'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: { count: number } }>('/notifications/count');
      return res.data.data;
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/notifications/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const deleteReadMutation = useMutation({
    mutationFn: () => api.delete('/notifications'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const unreadCount = countData?.count ?? 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Bell className="h-8 w-8 text-gray-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
            <p className="text-sm text-gray-500">
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {unreadCount > 0 && (
            <button
              onClick={() => markAllAsReadMutation.mutate()}
              disabled={markAllAsReadMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <CheckCheck className="h-4 w-4" />
              Mark All Read
            </button>
          )}
          <button
            onClick={() => deleteReadMutation.mutate()}
            disabled={deleteReadMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-300 rounded-lg hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
            Clear Read
          </button>
        </div>
      </div>

      {/* Notifications List */}
      {notifications && notifications.length > 0 ? (
        <div className="space-y-3">
          {notifications.map((notification) => {
            const IconComponent = notificationIcons[notification.type as NotificationType] || Bell;
            const colorClass = notificationColors[notification.type as NotificationType] || 'bg-gray-100 text-gray-600';

            return (
              <div
                key={notification.id}
                className={`bg-white rounded-lg border p-4 transition-all ${
                  notification.isRead
                    ? 'border-gray-200 opacity-75'
                    : 'border-blue-200 shadow-sm'
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={`flex-shrink-0 p-2 rounded-full ${colorClass}`}>
                    <IconComponent className="h-5 w-5" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className={`font-medium ${notification.isRead ? 'text-gray-600' : 'text-gray-900'}`}>
                          {notification.title}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">{notification.message}</p>
                      </div>
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 mt-3">
                      {notification.link && (
                        <Link
                          to={notification.link}
                          onClick={() => {
                            if (!notification.isRead) {
                              markAsReadMutation.mutate(notification.id);
                            }
                          }}
                          className="text-sm font-medium text-blue-600 hover:text-blue-800"
                        >
                          View Details
                        </Link>
                      )}
                      {!notification.isRead && (
                        <button
                          onClick={() => markAsReadMutation.mutate(notification.id)}
                          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                        >
                          <Check className="h-3 w-3" />
                          Mark as read
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotificationMutation.mutate(notification.id)}
                        className="text-sm text-red-500 hover:text-red-700 flex items-center gap-1"
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Unread indicator */}
                  {!notification.isRead && (
                    <div className="flex-shrink-0">
                      <div className="h-3 w-3 rounded-full bg-blue-500"></div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Bell className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No notifications</h3>
          <p className="text-gray-500">You're all caught up! Check back later.</p>
        </div>
      )}
    </div>
  );
}
