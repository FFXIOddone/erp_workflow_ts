import { useQuery } from '@tanstack/react-query';
import { Brain, RefreshCw, Route, ShieldCheck, XCircle, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api';
import { Badge } from './Badge';
import { formatRelativeTime } from '../lib/date';
import { DecisionOutcome, PrintingMethod, STATION_DISPLAY_NAMES, type RoutingDecision, type RoutingIntelligenceDashboard } from '@erp/shared';

function formatRoute(route: string[]): string {
  return route.map((station) => STATION_DISPLAY_NAMES[station as PrintingMethod] ?? station).join(' \u2192 ');
}

function percentLabel(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function outcomeVariant(outcome: DecisionOutcome | null): 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  switch (outcome) {
    case DecisionOutcome.SUCCESS:
      return 'success';
    case DecisionOutcome.REVERTED:
      return 'danger';
    case DecisionOutcome.PENDING:
      return 'warning';
    default:
      return 'neutral';
  }
}

export function RoutingIntelligenceCard() {
  const { data, isLoading, isFetching, error, refetch } = useQuery<RoutingIntelligenceDashboard>({
    queryKey: ['routing', 'dashboard'],
    queryFn: async () => {
      const response = await api.get('/routing/dashboard');
      return response.data.data as RoutingIntelligenceDashboard;
    },
    staleTime: 30_000,
  });

  const recentDecisions = (data?.recentDecisions ?? []) as RoutingDecision[];
  const accepted = data?.predictions.accepted ?? 0;
  const total = data?.predictions.total ?? 0;
  const rejected = Math.max(0, total - accepted);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-2">
          <div className="p-2 rounded-lg bg-cyan-50 text-cyan-600">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Routing Intelligence</h2>
            <p className="text-xs text-gray-500">Accepted vs rejected recommendations and actual route outcomes</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10 text-gray-400">
          <div className="animate-spin h-6 w-6 border-2 border-cyan-500 border-t-transparent rounded-full mr-3" />
          Loading routing intelligence...
        </div>
      ) : error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
          <div className="flex items-start gap-2">
            <XCircle className="h-4 w-4 text-rose-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-rose-900">Unable to load routing intelligence</p>
              <p className="text-sm text-rose-700 mt-1">
                The routing capture endpoint is unavailable right now. Try again after the server recovers.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-lg border border-cyan-100 bg-cyan-50/60 p-3">
              <p className="text-xs font-medium text-cyan-700">Total predictions</p>
              <p className="text-2xl font-bold text-cyan-950 mt-1">{total.toLocaleString()}</p>
            </div>
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-3">
              <p className="text-xs font-medium text-emerald-700">Accepted</p>
              <p className="text-2xl font-bold text-emerald-950 mt-1">{accepted.toLocaleString()}</p>
            </div>
            <div className="rounded-lg border border-amber-100 bg-amber-50/60 p-3">
              <p className="text-xs font-medium text-amber-700">Avg confidence</p>
              <p className="text-2xl font-bold text-amber-950 mt-1">{percentLabel(data?.predictions.avgConfidence ?? 0)}</p>
            </div>
            <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-3">
              <p className="text-xs font-medium text-indigo-700">Outcome match</p>
              <p className="text-2xl font-bold text-indigo-950 mt-1">{percentLabel(data?.predictions.avgAccuracy ?? 0)}</p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>Accepted vs rejected</span>
              <span>{accepted} accepted / {rejected} rejected</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${total > 0 ? Math.max(0, Math.min(100, (accepted / total) * 100)) : 0}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-gray-900 mb-2">
              <Route className="h-4 w-4 text-cyan-600" />
              Recent decisions
            </div>
            <div className="space-y-2">
              {recentDecisions.length > 0 ? (
                recentDecisions.slice(0, 5).map((decision) => (
                  <div key={decision.id} className="rounded-lg border border-gray-200 bg-white p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <Badge variant={outcomeVariant(decision.outcomeStatus)} size="sm">
                            {decision.outcomeStatus || DecisionOutcome.PENDING}
                          </Badge>
                          <span className="text-sm font-medium text-gray-900">
                            {decision.workOrderId ? `Order ${decision.workOrderId.slice(0, 8)}` : 'Routing decision'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {decision.trigger} • {formatRelativeTime(decision.createdAt)}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs text-gray-500">Score</div>
                        <div className="text-sm font-semibold text-gray-900">
                          {decision.predictionScore != null ? Math.round(decision.predictionScore) : '—'}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5 text-cyan-600" />
                        {formatRoute(decision.newRoute)}
                      </div>
                      {decision.outcomeNotes && (
                        <p className="mt-1 text-xs text-gray-500">{decision.outcomeNotes}</p>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge variant="neutral" size="sm">
                        {decision.decisionMaker}
                      </Badge>
                      <Badge variant="neutral" size="sm">
                        {decision.trigger}
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                  No routing decisions have been captured yet.
                </div>
              )}
            </div>
          </div>

          {data && data.bottlenecks.length > 0 && (
            <div className="rounded-lg border border-rose-100 bg-rose-50/50 p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-rose-800 mb-2">
                <AlertTriangle className="h-4 w-4" />
                Bottlenecks
              </div>
              <div className="flex flex-wrap gap-2">
                {data.bottlenecks.slice(0, 4).map((station) => (
                  <Badge key={station.station} variant="danger" size="sm">
                    {station.displayName}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
