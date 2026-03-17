import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  MessageSquare,
  Send,
  Loader2,
  Package,
  Plus,
  ArrowLeft,
} from 'lucide-react';
import { messagesApi, ordersApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { formatRelativeTime, cn, getInitials } from '@/lib/utils';

export function MessagesPage() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newContent, setNewContent] = useState('');
  const [replyContent, setReplyContent] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');

  // Pre-select order if coming from order page
  const preselectedOrderId = searchParams.get('orderId');

  const { data: threads, isLoading: threadsLoading } = useQuery({
    queryKey: ['message-threads'],
    queryFn: () => messagesApi.listThreads().then((r) => r.data.data),
  });

  const { data: threadMessages, isLoading: messagesLoading } = useQuery({
    queryKey: ['thread-messages', selectedThreadId],
    queryFn: () =>
      messagesApi.getThread(selectedThreadId!).then((r) => r.data.data),
    enabled: !!selectedThreadId,
  });

  const { data: ordersData } = useQuery({
    queryKey: ['orders-for-messages'],
    queryFn: () => ordersApi.list({ pageSize: 100 }).then((r) => r.data.data),
  });

  const sendMutation = useMutation({
    mutationFn: messagesApi.send,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-threads'] });
      if (selectedThreadId) {
        queryClient.invalidateQueries({
          queryKey: ['thread-messages', selectedThreadId],
        });
      }
      setNewSubject('');
      setNewContent('');
      setReplyContent('');
      setShowNewMessage(false);
      setSelectedOrderId('');
    },
  });

  const handleNewMessage = () => {
    if (!newContent.trim()) return;
    sendMutation.mutate({
      subject: newSubject || 'General Inquiry',
      content: newContent,
      orderId: selectedOrderId || preselectedOrderId || undefined,
    });
  };

  const handleReply = () => {
    if (!replyContent.trim() || !selectedThreadId) return;
    sendMutation.mutate({
      threadId: selectedThreadId,
      content: replyContent,
    });
  };

  // If preselected order, show new message form
  if (preselectedOrderId && !showNewMessage && !selectedThreadId) {
    setShowNewMessage(true);
    setSelectedOrderId(preselectedOrderId);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
          <p className="mt-1 text-gray-500">
            Communicate directly with our team
          </p>
        </div>
        <button
          onClick={() => {
            setShowNewMessage(true);
            setSelectedThreadId(null);
          }}
          className="btn btn-primary"
        >
          <Plus className="w-4 h-4" />
          New Message
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 min-h-[500px]">
        {/* Threads List - hidden on mobile when viewing a conversation */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className={cn(
            'card overflow-hidden',
            (selectedThreadId || showNewMessage) && 'hidden lg:block'
          )}
        >
          <div className="card-header">
            <h2 className="font-semibold text-gray-900">Conversations</h2>
          </div>
          <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
            {threadsLoading ? (
              <div className="p-6 text-center text-gray-500">Loading...</div>
            ) : !threads || threads.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p>No conversations yet</p>
              </div>
            ) : (
              threads.map((thread: any) => (
                <button
                  key={thread.threadId}
                  onClick={() => {
                    setSelectedThreadId(thread.threadId);
                    setShowNewMessage(false);
                  }}
                  className={cn(
                    'w-full p-4 text-left hover:bg-gray-50 transition-colors',
                    selectedThreadId === thread.threadId && 'bg-primary-50'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          'font-medium text-gray-900 truncate',
                          !thread.isRead &&
                            !thread.isFromCustomer &&
                            'font-semibold'
                        )}
                      >
                        {thread.subject || 'No Subject'}
                      </p>
                      <p className="text-sm text-gray-500 truncate mt-0.5">
                        {thread.content}
                      </p>
                      {thread.orderNumber && (
                        <p className="text-xs text-primary-600 mt-1 flex items-center gap-1">
                          <Package className="w-3 h-3" />
                          Order #{thread.orderNumber}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-gray-400">
                        {formatRelativeTime(thread.createdAt)}
                      </p>
                      {!thread.isRead && !thread.isFromCustomer && (
                        <span className="inline-block w-2 h-2 bg-primary-500 rounded-full mt-1" />
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </motion.div>

        {/* Message View - full width on mobile when active */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'lg:col-span-2 card flex flex-col',
            !selectedThreadId && !showNewMessage && 'hidden lg:flex'
          )}
        >
          {showNewMessage ? (
            <>
              <div className="card-header flex items-center gap-3">
                <button 
                  onClick={() => {
                    setShowNewMessage(false);
                    setNewSubject('');
                    setNewContent('');
                    setSelectedOrderId('');
                  }}
                  className="lg:hidden p-1 -ml-1 text-gray-500 hover:text-gray-700"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h2 className="font-semibold text-gray-900">New Message</h2>
              </div>
              <div className="card-body flex-1 space-y-4">
                <div>
                  <label className="label">Subject</label>
                  <input
                    type="text"
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    className="input"
                    placeholder="What's this about?"
                  />
                </div>
                <div>
                  <label className="label">Related Order (optional)</label>
                  <select
                    value={selectedOrderId || preselectedOrderId || ''}
                    onChange={(e) => setSelectedOrderId(e.target.value)}
                    className="input"
                  >
                    <option value="">No specific order</option>
                    {ordersData?.orders?.map((order: any) => (
                      <option key={order.id} value={order.id}>
                        #{order.orderNumber} - {order.description}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="label">Message</label>
                  <textarea
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    className="input min-h-[200px]"
                    placeholder="Type your message here..."
                  />
                </div>
              </div>
              <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowNewMessage(false);
                    setNewSubject('');
                    setNewContent('');
                    setSelectedOrderId('');
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleNewMessage}
                  disabled={!newContent.trim() || sendMutation.isPending}
                  className="btn btn-primary"
                >
                  {sendMutation.isPending ? (
                    <Loader2 className="w-4 h-4 spinner" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Send Message
                </button>
              </div>
            </>
          ) : selectedThreadId ? (
            <>
              <div className="card-header border-b flex items-center gap-3">
                <button 
                  onClick={() => setSelectedThreadId(null)}
                  className="lg:hidden p-1 -ml-1 text-gray-500 hover:text-gray-700"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h2 className="font-semibold text-gray-900">
                    {threadMessages?.[0]?.subject || 'Conversation'}
                  </h2>
                  {threadMessages?.[0]?.order && (
                    <p className="text-sm text-primary-600 flex items-center gap-1 mt-1">
                      <Package className="w-4 h-4" />
                      Order #{threadMessages[0].order.orderNumber}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[400px]">
                {messagesLoading ? (
                  <div className="text-center text-gray-500">Loading...</div>
                ) : (
                  threadMessages?.map((message: any) => {
                    const isFromCustomer = message.isFromCustomer;
                    const senderName = isFromCustomer
                      ? `${message.portalUser?.firstName || ''} ${message.portalUser?.lastName || ''}`
                      : message.user?.displayName || 'Wilde Signs Team';

                    return (
                      <div
                        key={message.id}
                        className={cn(
                          'flex gap-3',
                          isFromCustomer ? 'justify-end' : 'justify-start'
                        )}
                      >
                        {!isFromCustomer && (
                          <div className="w-8 h-8 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-xs font-medium shrink-0">
                            WS
                          </div>
                        )}
                        <div
                          className={cn(
                            'max-w-[70%] rounded-2xl p-4',
                            isFromCustomer
                              ? 'bg-primary-600 text-white rounded-tr-none'
                              : 'bg-gray-100 text-gray-900 rounded-tl-none'
                          )}
                        >
                          <p className="text-sm whitespace-pre-wrap">
                            {message.content}
                          </p>
                          <p
                            className={cn(
                              'text-xs mt-2',
                              isFromCustomer
                                ? 'text-primary-200'
                                : 'text-gray-500'
                            )}
                          >
                            {senderName} • {formatRelativeTime(message.createdAt)}
                          </p>
                        </div>
                        {isFromCustomer && (
                          <div className="w-8 h-8 bg-gray-200 text-gray-600 rounded-full flex items-center justify-center text-xs font-medium shrink-0">
                            {getInitials(user?.firstName, user?.lastName)}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
              <div className="p-4 border-t border-gray-200">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleReply();
                      }
                    }}
                    className="input flex-1"
                    placeholder="Type a reply..."
                  />
                  <button
                    onClick={handleReply}
                    disabled={!replyContent.trim() || sendMutation.isPending}
                    className="btn btn-primary"
                  >
                    {sendMutation.isPending ? (
                      <Loader2 className="w-4 h-4 spinner" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="font-medium">Select a conversation</p>
                <p className="text-sm mt-1">
                  Or start a new message to our team
                </p>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
