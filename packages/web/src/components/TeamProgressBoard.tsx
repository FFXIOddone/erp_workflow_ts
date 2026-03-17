import { useQuery } from '@tanstack/react-query';
import { Trophy, Flame, TrendingUp, Users } from 'lucide-react';
import { api } from '../lib/api';

const STATION_LABELS: Record<string, string> = {
  DESIGN: 'Design',
  ROLL_TO_ROLL: 'Roll to Roll',
  FLATBED: 'Flatbed',
  SCREEN_PRINT: 'Screen Print',
  PRODUCTION: 'Production',
  SHIPPING_RECEIVING: 'Shipping',
  INSTALLATION: 'Installation',
  ORDER_ENTRY: 'Order Entry',
};

export function TeamProgressBoard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['gamification', 'team-stats'],
    queryFn: async () => {
      const res = await api.get('/gamification/team-stats');
      return res.data.data;
    },
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading || !stats) {
    return <div className="animate-pulse h-48 bg-gray-100 rounded-xl" />;
  }

  const weeklyGoal = 50; // Configurable weekly goal
  const weeklyProgress = Math.min((stats.weeklyCompletions / weeklyGoal) * 100, 100);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-5 h-5 text-indigo-600" />
        <h3 className="text-lg font-semibold text-gray-900">Team Progress</h3>
      </div>

      {/* Weekly progress bar */}
      <div className="mb-5">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-600">Orders completed this week</span>
          <span className="font-semibold text-gray-900">{stats.weeklyCompletions} / {weeklyGoal}</span>
        </div>
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
            style={{ width: `${weeklyProgress}%` }}
          />
        </div>
      </div>

      {/* Monthly count */}
      <div className="flex items-center gap-3 mb-4 p-3 bg-indigo-50 rounded-lg">
        <TrendingUp className="w-5 h-5 text-indigo-600" />
        <div>
          <p className="text-sm font-medium text-indigo-900">{stats.monthlyCompletions} orders this month</p>
        </div>
      </div>

      {/* Station throughput */}
      {Object.keys(stats.stationThroughput || {}).length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-700 mb-2">Station throughput (this week)</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.stationThroughput as Record<string, number>)
              .sort(([, a], [, b]) => b - a)
              .map(([station, count]) => (
                <span key={station} className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-700">
                  {STATION_LABELS[station] || station}: <strong>{count}</strong>
                </span>
              ))}
          </div>
        </div>
      )}

      {/* Top streaks */}
      {stats.topStreaks?.length > 0 && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
            <Flame className="w-4 h-4 text-orange-500" /> Active Streaks
          </p>
          <div className="space-y-1">
            {stats.topStreaks.filter((s: any) => s.currentStreak > 0).slice(0, 3).map((s: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{s.displayName}</span>
                <span className="font-medium text-orange-600">{s.currentStreak} day streak</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
