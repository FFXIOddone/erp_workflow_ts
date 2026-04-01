import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Brain, RefreshCw, Route, Sparkles, AlertTriangle, Clock3 } from 'lucide-react';
import { api } from '../lib/api';
import { Badge } from './Badge';
import { PrintingMethod, STATION_DISPLAY_NAMES, type RoutingSuggestion } from '@erp/shared';

interface RankedRoute {
  route: string[];
  score: number;
  estimatedDuration: number;
  reasoning: string[];
  warnings: string[];
  appliedRuleCodes: string[];
}

interface RoutingPreviewResponse {
  suggestion: RoutingSuggestion;
  rankedRoutes: RankedRoute[];
}

interface RoutingRecommendationCardProps {
  workOrderId: string;
  orderNumber: string;
  description: string;
  priority: number;
  dueDate: string | null;
  notes: string | null;
  currentRoute: string[];
}

function formatRoute(route: string[]): string {
  return route.map((station) => STATION_DISPLAY_NAMES[station as PrintingMethod] ?? station).join(' \u2192 ');
}

function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return '0 min';
  }

  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;

  if (hours === 0) {
    return `${mins} min`;
  }

  if (mins === 0) {
    return `${hours} hr`;
  }

  return `${hours} hr ${mins} min`;
}

function confidenceLabel(confidence: number): string {
  return `${Math.round(confidence * 100)}% confidence`;
}

export function RoutingRecommendationCard({
  workOrderId,
  orderNumber,
  description,
  priority,
  dueDate,
  notes,
  currentRoute,
}: RoutingRecommendationCardProps) {
  const queryKey = [
    'routing-preview',
    workOrderId,
    description,
    priority,
    dueDate ?? '',
    notes ?? '',
    currentRoute.join('|'),
  ];

  const { data, isLoading, isFetching, error, refetch } = useQuery<RoutingPreviewResponse>({
    queryKey,
    queryFn: async () => {
      const response = await api.post('/routing/preview', {
        workOrderId,
        currentRoute: currentRoute.length > 0 ? currentRoute : undefined,
      });

      return response.data.data as RoutingPreviewResponse;
    },
    staleTime: 30_000,
  });

  const topRoute = data?.rankedRoutes?.[0];

  return (
    <div className="bg-white rounded-xl shadow-soft border border-gray-100 p-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-2">
          <div className="p-2 rounded-lg bg-primary-50 text-primary-600">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Routing Recommendation</h2>
            <p className="text-xs text-gray-500">Live preview for order #{orderNumber}</p>
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
          <div className="animate-spin h-6 w-6 border-2 border-primary-500 border-t-transparent rounded-full mr-3" />
          Loading routing preview...
        </div>
      ) : error ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-amber-900">Could not load routing preview</p>
              <p className="text-sm text-amber-700 mt-1">
                The routing engine is unavailable right now. Try again once the server recovers.
              </p>
            </div>
          </div>
        </div>
      ) : topRoute ? (
        <div className="space-y-4">
          <div className="rounded-xl bg-gradient-to-br from-primary-50 to-slate-50 border border-primary-100 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-primary-700 mb-1">
                  Recommended route
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {data.suggestion.suggestedRoute.map((station) => (
                    <Badge key={station} variant="neutral" size="sm">
                      {STATION_DISPLAY_NAMES[station as PrintingMethod] ?? station}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="flex flex-col items-end gap-1 shrink-0">
                <Badge variant="info" size="sm" dot>
                  {confidenceLabel(data.suggestion.confidence)}
                </Badge>
                <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                  <Clock3 className="h-3.5 w-3.5" />
                  {formatDuration(data.suggestion.estimatedDuration)}
                </span>
              </div>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span>Confidence</span>
                <span>{Math.round(data.suggestion.confidence * 100)}%</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary-500"
                  style={{ width: `${Math.max(0, Math.min(100, data.suggestion.confidence * 100))}%` }}
                />
              </div>
            </div>
          </div>

          {data.suggestion.reasoning.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                <Sparkles className="h-4 w-4 text-primary-500" />
                Why this route
              </div>
              <ul className="space-y-1.5">
                {data.suggestion.reasoning.map((reason) => (
                  <li key={reason} className="flex items-start gap-2 text-sm text-gray-600">
                    <ArrowRight className="h-3.5 w-3.5 text-primary-500 mt-0.5 shrink-0" />
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.suggestion.warnings.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-medium text-amber-900 mb-1">Warnings</p>
              <ul className="space-y-1">
                {data.suggestion.warnings.map((warning) => (
                  <li key={warning} className="text-sm text-amber-700">
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-gray-900 mb-2">
              <Route className="h-4 w-4 text-primary-500" />
              Ranked options
            </div>
            <div className="space-y-2">
              {data.rankedRoutes.slice(0, 3).map((route, index) => (
                <div
                  key={`${route.route.join('|')}-${index}`}
                  className={`rounded-lg border p-3 ${
                    index === 0 ? 'border-primary-200 bg-primary-50/60' : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={index === 0 ? 'info' : 'neutral'} size="sm">
                          {index === 0 ? 'Top pick' : `#${index + 1}`}
                        </Badge>
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {formatRoute(route.route)}
                        </span>
                      </div>
                      {route.reasoning[0] && (
                        <p className="text-xs text-gray-500">{route.reasoning[0]}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-semibold text-gray-900">
                        {Math.round(route.score)}
                      </div>
                      <div className="text-xs text-gray-500">{formatDuration(route.estimatedDuration)}</div>
                    </div>
                  </div>
                  {route.warnings.length > 0 && (
                    <div className="mt-2 text-xs text-amber-700">
                      {route.warnings[0]}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-sm text-gray-500">
          No routing recommendation is available for this order yet.
        </div>
      )}
    </div>
  );
}
