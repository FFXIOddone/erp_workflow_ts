import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HelpCircle,
  Plus,
  MessageCircle,
  Clock,
  ChevronRight,
  X,
  Send,
  Tag,
  FileText,
  Package,
  CreditCard,
  Truck,
  Palette,
  Settings,
  Search,
} from 'lucide-react';
import { messagesApi } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';

interface Thread {
  threadId: string;
  subject: string | null;
  content: string;
  createdAt: string;
  isFromCustomer: boolean;
  isRead: boolean;
  orderId: string | null;
  orderNumber?: string;
}

const CATEGORIES = [
  { id: 'order', label: 'Order Issue', icon: Package, color: 'blue' },
  { id: 'billing', label: 'Billing/Payment', icon: CreditCard, color: 'green' },
  { id: 'shipping', label: 'Shipping/Delivery', icon: Truck, color: 'purple' },
  { id: 'proof', label: 'Proof/Design', icon: Palette, color: 'orange' },
  { id: 'technical', label: 'Technical Issue', icon: Settings, color: 'red' },
  { id: 'general', label: 'General Question', icon: HelpCircle, color: 'gray' },
];

const PRIORITIES = [
  { id: 'low', label: 'Low', color: 'text-gray-600 bg-gray-100' },
  { id: 'medium', label: 'Medium', color: 'text-yellow-700 bg-yellow-100' },
  { id: 'high', label: 'High', color: 'text-red-700 bg-red-100' },
];

export function SupportTicketsPage() {
  const [isCreating, setIsCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'resolved'>('all');
  
  // New ticket form state
  const [category, setCategory] = useState('general');
  const [priority, setPriority] = useState('medium');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['support-threads'],
    queryFn: () => messagesApi.listThreads().then((r) => r.data.data as Thread[]),
  });

  const createTicketMutation = useMutation({
    mutationFn: async () => {
      // Create ticket with category and priority encoded in subject
      const ticketSubject = `[${category.toUpperCase()}] [${priority.toUpperCase()}] ${subject}`;
      return messagesApi.send({
        subject: ticketSubject,
        content: message,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-threads'] });
      setIsCreating(false);
      setCategory('general');
      setPriority('medium');
      setSubject('');
      setMessage('');
    },
  });

  const threads: Thread[] = data || [];
  
  // Parse ticket info from subject
  const parseTicketInfo = (subject: string | null) => {
    if (!subject) return { category: 'general', priority: 'medium', title: 'Support Ticket' };
    
    const categoryMatch = subject.match(/\[([A-Z]+)\]/);
    const priorityMatch = subject.match(/\[([A-Z]+)\]\s*\[([A-Z]+)\]/);
    
    let title = subject.replace(/\[[A-Z]+\]\s*/g, '').trim();
    if (!title) title = 'Support Ticket';
    
    return {
      category: categoryMatch?.[1]?.toLowerCase() || 'general',
      priority: priorityMatch?.[2]?.toLowerCase() || 'medium',
      title,
    };
  };

  // Filter threads that look like tickets (have category tags)
  const ticketThreads = threads.filter(t => {
    if (!t.subject) return false;
    const hasCategory = t.subject.includes('[') && t.subject.includes(']');
    if (statusFilter === 'all') return hasCategory;
    // For now, treat all as "open" unless last message is from staff saying "resolved"
    return hasCategory;
  });

  const filteredThreads = ticketThreads.filter(t => {
    if (!search) return true;
    const info = parseTicketInfo(t.subject);
    return info.title.toLowerCase().includes(search.toLowerCase()) ||
           (t.content || '').toLowerCase().includes(search.toLowerCase());
  });

  const getCategoryInfo = (categoryId: string) => {
    return CATEGORIES.find(c => c.id === categoryId) || CATEGORIES[5];
  };

  const getPriorityInfo = (priorityId: string) => {
    return PRIORITIES.find(p => p.id === priorityId) || PRIORITIES[1];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Support Tickets</h1>
          <p className="mt-1 text-gray-500">Get help with orders, billing, or technical issues</p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="btn-primary"
        >
          <Plus className="w-4 h-4 mr-1" />
          New Ticket
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search tickets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10 w-full"
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'open', 'resolved'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize',
                  statusFilter === status
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Ticket List */}
      {isLoading ? (
        <div className="card divide-y divide-gray-100">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="p-4 animate-pulse">
              <div className="flex gap-4">
                <div className="w-10 h-10 bg-gray-200 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                  <div className="h-3 bg-gray-200 rounded w-3/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredThreads.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-8 text-center"
        >
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <HelpCircle className="w-8 h-8 text-primary-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Support Tickets</h3>
          <p className="text-gray-500 mb-4">
            Need help? Create a new support ticket and our team will assist you.
          </p>
          <button
            onClick={() => setIsCreating(true)}
            className="btn-primary"
          >
            <Plus className="w-4 h-4 mr-1" />
            Create Your First Ticket
          </button>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="card divide-y divide-gray-100"
        >
          {filteredThreads.map((thread, index) => {
            const info = parseTicketInfo(thread.subject);
            const categoryInfo = getCategoryInfo(info.category);
            const priorityInfo = getPriorityInfo(info.priority);
            const Icon = categoryInfo.icon;

            return (
              <motion.a
                key={thread.threadId}
                href={`/messages?thread=${thread.threadId}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors group cursor-pointer"
              >
                <div className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center',
                  `bg-${categoryInfo.color}-100`
                )}>
                  <Icon className={cn('w-5 h-5', `text-${categoryInfo.color}-600`)} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-900 truncate">{info.title}</h3>
                    <span className={cn('px-2 py-0.5 text-xs rounded-full', priorityInfo.color)}>
                      {priorityInfo.label}
                    </span>
                    {!thread.isRead && !thread.isFromCustomer && (
                      <span className="px-1.5 py-0.5 bg-primary-600 text-white text-xs rounded-full">
                        New
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 truncate mt-1">
                    {thread.content || 'No message content'}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Tag className="w-3 h-3" />
                      {categoryInfo.label}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(thread.createdAt)}
                    </span>
                  </div>
                </div>

                <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-gray-400" />
              </motion.a>
            );
          })}
        </motion.div>
      )}

      {/* Quick Help Links */}
      <div className="card p-4">
        <h3 className="font-medium text-gray-900 mb-3">Quick Help</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Track Order', href: '/orders', icon: Package },
            { label: 'View Invoices', href: '/invoices', icon: FileText },
            { label: 'Contact Us', href: '/messages', icon: MessageCircle },
            { label: 'FAQ', href: '#', icon: HelpCircle },
          ].map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="p-3 bg-gray-50 rounded-lg text-center hover:bg-gray-100 transition-colors"
            >
              <link.icon className="w-5 h-5 mx-auto mb-1 text-gray-600" />
              <span className="text-sm text-gray-700">{link.label}</span>
            </a>
          ))}
        </div>
      </div>

      {/* Create Ticket Modal */}
      <AnimatePresence>
        {isCreating && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setIsCreating(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-lg sm:max-h-[90vh] bg-white rounded-xl shadow-xl z-50 overflow-hidden flex flex-col"
            >
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Create Support Ticket</h2>
                <button
                  onClick={() => setIsCreating(false)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="p-4 space-y-4 flex-1 overflow-y-auto">
                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setCategory(cat.id)}
                        className={cn(
                          'p-2 rounded-lg border text-sm flex flex-col items-center gap-1 transition-colors',
                          category === cat.id
                            ? 'border-primary-500 bg-primary-50 text-primary-700'
                            : 'border-gray-200 hover:bg-gray-50'
                        )}
                      >
                        <cat.icon className="w-4 h-4" />
                        <span className="text-xs">{cat.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Priority
                  </label>
                  <div className="flex gap-2">
                    {PRIORITIES.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPriority(p.id)}
                        className={cn(
                          'flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors',
                          priority === p.id
                            ? 'border-primary-500 bg-primary-50 text-primary-700'
                            : 'border-gray-200 hover:bg-gray-50'
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Brief description of your issue"
                    className="input w-full"
                  />
                </div>

                {/* Message */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Message
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Describe your issue in detail..."
                    rows={4}
                    className="input w-full resize-none"
                  />
                </div>
              </div>

              <div className="p-4 border-t border-gray-200 flex justify-end gap-3 flex-shrink-0">
                <button
                  onClick={() => setIsCreating(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={() => createTicketMutation.mutate()}
                  disabled={!subject.trim() || !message.trim() || createTicketMutation.isPending}
                  className="btn-primary disabled:opacity-50"
                >
                  {createTicketMutation.isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-1" />
                      Submit Ticket
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
