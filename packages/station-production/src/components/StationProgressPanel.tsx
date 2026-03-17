import { useState, useEffect } from 'react';
import { 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  PlayCircle, 
  PauseCircle,
  ChevronRight,
  Package
} from 'lucide-react';
import toast from 'react-hot-toast';

interface WorkOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  description: string;
  status: 'not_started' | 'in_progress' | 'completed';
  priority: 'urgent' | 'high' | 'normal' | 'low';
  dueDate: string;
  estimatedHours: number;
  actualHours: number;
}

// Mock data until API connected
const mockOrders: WorkOrder[] = [
  {
    id: '1',
    orderNumber: 'WO-2026-0156',
    customerName: 'Aldea Coffee',
    description: 'Screen print 100 T-shirts - Black on White',
    status: 'in_progress',
    priority: 'urgent',
    dueDate: '2026-02-07',
    estimatedHours: 4,
    actualHours: 1.5,
  },
  {
    id: '2', 
    orderNumber: 'WO-2026-0148',
    customerName: 'Downtown Diner',
    description: 'Vinyl lettering for storefront',
    status: 'not_started',
    priority: 'normal',
    dueDate: '2026-02-10',
    estimatedHours: 2,
    actualHours: 0,
  },
  {
    id: '3',
    orderNumber: 'WO-2026-0142',
    customerName: 'Real Estate Pro',
    description: 'Yard signs - 50 pcs double-sided',
    status: 'completed',
    priority: 'high',
    dueDate: '2026-02-06',
    estimatedHours: 3,
    actualHours: 2.75,
  },
];

const priorityColors = {
  urgent: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  normal: 'bg-blue-100 text-blue-700 border-blue-200',
  low: 'bg-gray-100 text-gray-700 border-gray-200',
};

const statusIcons = {
  not_started: Clock,
  in_progress: PlayCircle,
  completed: CheckCircle,
};

export function StationProgressPanel() {
  const [orders, setOrders] = useState<WorkOrder[]>(mockOrders);
  const [activeOrderId, setActiveOrderId] = useState<string | null>('1');
  const [isTracking, setIsTracking] = useState(true);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Timer for active work
  useEffect(() => {
    let interval: number | undefined;
    if (isTracking && activeOrderId) {
      interval = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000) as unknown as number;
    }
    return () => clearInterval(interval);
  }, [isTracking, activeOrderId]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartStop = () => {
    if (isTracking) {
      setIsTracking(false);
      toast.success('Time tracking paused');
    } else {
      setIsTracking(true);
      toast.success('Time tracking resumed');
    }
  };

  const handleCompleteOrder = (orderId: string) => {
    setOrders(orders.map(o => 
      o.id === orderId ? { ...o, status: 'completed' as const } : o
    ));
    if (activeOrderId === orderId) {
      setActiveOrderId(null);
      setIsTracking(false);
    }
    toast.success('Order marked as complete at this station');
  };

  const handleSelectOrder = (orderId: string) => {
    setActiveOrderId(orderId);
    setElapsedTime(0);
    setIsTracking(true);
    toast.success('Started working on order');
  };

  const activeOrder = orders.find(o => o.id === activeOrderId);
  const pendingOrders = orders.filter(o => o.status !== 'completed' && o.id !== activeOrderId);
  const completedOrders = orders.filter(o => o.status === 'completed');

  return (
    <div className="flex flex-col h-full">
      {/* Active Work Section */}
      {activeOrder && (
        <div className="bg-orange-50 border-b border-orange-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <PlayCircle className={`w-5 h-5 ${isTracking ? 'text-orange-600 animate-pulse' : 'text-gray-400'}`} />
              <span className="font-medium text-orange-800">Currently Working</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-mono font-bold text-orange-700">
                {formatTime(elapsedTime)}
              </span>
              <button
                onClick={handleStartStop}
                className={`p-2 rounded-lg ${
                  isTracking 
                    ? 'bg-orange-200 hover:bg-orange-300 text-orange-700' 
                    : 'bg-green-200 hover:bg-green-300 text-green-700'
                }`}
              >
                {isTracking ? <PauseCircle className="w-5 h-5" /> : <PlayCircle className="w-5 h-5" />}
              </button>
            </div>
          </div>
          
          <div className="bg-white rounded-lg border border-orange-200 p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-gray-900">{activeOrder.orderNumber}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${priorityColors[activeOrder.priority]}`}>
                    {activeOrder.priority}
                  </span>
                </div>
                <p className="text-gray-600 font-medium">{activeOrder.customerName}</p>
                <p className="text-sm text-gray-500 mt-1">{activeOrder.description}</p>
              </div>
              <button
                onClick={() => handleCompleteOrder(activeOrder.id)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                Complete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Job Queue */}
      <div className="flex-1 overflow-auto p-4">
        <h3 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
          <Package className="w-4 h-4" />
          Pending Jobs ({pendingOrders.length})
        </h3>
        
        <div className="space-y-2">
          {pendingOrders.map((order) => {
            const StatusIcon = statusIcons[order.status];
            return (
              <div
                key={order.id}
                className="bg-white rounded-lg border border-gray-200 p-4 hover:border-orange-300 hover:shadow-sm transition-all cursor-pointer"
                onClick={() => handleSelectOrder(order.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <StatusIcon className="w-5 h-5 text-gray-400" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{order.orderNumber}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${priorityColors[order.priority]}`}>
                          {order.priority}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{order.customerName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{order.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Due: {new Date(order.dueDate).toLocaleDateString()}</p>
                    <p className="text-xs text-gray-400">Est: {order.estimatedHours}h</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Completed Section */}
        {completedOrders.length > 0 && (
          <>
            <h3 className="font-medium text-gray-700 mt-6 mb-3 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              Completed Today ({completedOrders.length})
            </h3>
            <div className="space-y-2">
              {completedOrders.map((order) => (
                <div
                  key={order.id}
                  className="bg-green-50 rounded-lg border border-green-200 p-4 opacity-75"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <div>
                        <span className="font-medium text-gray-900">{order.orderNumber}</span>
                        <p className="text-sm text-gray-600">{order.customerName}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-green-600 font-medium">{order.actualHours}h logged</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
