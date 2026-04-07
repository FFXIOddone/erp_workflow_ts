import { useState } from 'react';
import { ShieldCheck, FileText, CheckCircle2, LogOut } from 'lucide-react';
import { hasAcceptedEula, EULA_POINTS, EULA_SUMMARY, EULA_TITLE, EULA_VERSION } from '@erp/shared';
import { apiPost } from '../lib/api';
import { useAuthStore } from '../stores/auth';
import toast from 'react-hot-toast';

interface AcceptEulaResponse {
  user: {
    id: string;
    username: string;
    displayName: string;
    role: string;
    allowedStations: string[];
    eulaAcceptedAt: string | null;
    eulaAcceptedVersion: string | null;
  };
  acceptedAt: string;
}

export function EulaGate() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const logout = useAuthStore((state) => state.logout);
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  if (hasAcceptedEula(user)) {
    return null;
  }

  const handleAccept = async () => {
    setLoading(true);
    try {
      const data = await apiPost<AcceptEulaResponse>('/auth/accept-eula');
      setUser(data.user as any);
      toast.success('EULA accepted');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to accept the EULA');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-4 py-6 text-white">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <div className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-emerald-500/15 p-3 text-emerald-300">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.3em] text-white/50">Production Access Gate</p>
              <h1 className="text-2xl font-bold">{EULA_TITLE}</h1>
              <p className="text-sm text-white/75">{EULA_SUMMARY}</p>
              <p className="text-xs uppercase tracking-[0.24em] text-white/50">
                Version {EULA_VERSION}
              </p>
              <a
                href="/agreement"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-white/10"
              >
                <FileText className="h-4 w-4" />
                View full agreement
              </a>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="rounded-3xl border border-white/10 bg-white p-6 text-slate-900 shadow-2xl">
            <div className="mb-4 flex items-center gap-2 text-slate-700">
              <FileText className="h-5 w-5 text-primary-600" />
              <h2 className="text-lg font-semibold">Agreement</h2>
            </div>

            <div className="space-y-4 text-sm leading-7 text-slate-700">
              <p>
                This EULA must be accepted before you can use the shop-floor app in production.
              </p>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <ul className="list-disc space-y-2 pl-5">
                  {EULA_POINTS.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <input
                id="shop-floor-eula"
                type="checkbox"
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="shop-floor-eula" className="text-sm text-slate-700">
                I have read and agree to the EULA and clickwrap requirement.
              </label>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => logout()}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <span className="inline-flex items-center gap-2">
                  <LogOut className="h-4 w-4" />
                  Log out
                </span>
              </button>
              <button
                type="button"
                disabled={!accepted || loading}
                onClick={() => void handleAccept()}
                className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                I Accept
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur">
            <h3 className="mb-3 text-lg font-semibold">Production note</h3>
            <p className="text-sm leading-6 text-white/75">
              Once you accept, this device can continue into the station picker and use the
              production app normally. Until then, data access stays blocked.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
