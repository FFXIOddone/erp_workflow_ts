import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ShieldCheck, FileText, CheckCircle2 } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/auth';
import {
  EULA_POINTS,
  EULA_SUMMARY,
  EULA_TITLE,
  EULA_VERSION,
  hasAcceptedEula,
} from '@erp/shared';

type AcceptEulaResponse = {
  user: {
    id: string;
    username: string;
    displayName: string;
    email: string | null;
    role: string;
    allowedStations: string[];
    eulaAcceptedAt: string | null;
    eulaAcceptedVersion: string | null;
    createdAt: string;
    updatedAt: string;
  };
  acceptedAt: string;
};

export function EulaPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const logout = useAuthStore((state) => state.logout);
  const [accepted, setAccepted] = useState(false);

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post<{ success: boolean; data: AcceptEulaResponse }>(
        '/auth/accept-eula',
      );
      return response.data.data;
    },
    onSuccess: (data) => {
      setUser({ ...(user ?? {}), ...data.user } as any);
      toast.success('EULA accepted');

      if (data.user.role === 'OPERATOR' || data.user.role === 'VIEWER') {
        window.location.href = '/shop-floor/';
      } else {
        navigate('/', { replace: true });
      }
    },
    onError: () => {
      toast.error('Unable to accept the EULA right now');
    },
  });

  if (hasAcceptedEula(user)) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-4 py-10 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <div className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-emerald-500/15 p-3 text-emerald-300">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <div className="space-y-2">
              <p className="text-sm uppercase tracking-[0.3em] text-white/50">Production Access Gate</p>
              <h1 className="text-3xl font-bold">{EULA_TITLE}</h1>
              <p className="max-w-3xl text-sm leading-6 text-white/75">{EULA_SUMMARY}</p>
              <p className="text-xs uppercase tracking-[0.24em] text-white/50">
                Version {EULA_VERSION}
              </p>
              <Link
                to="/agreement"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-white/10"
              >
                <FileText className="h-4 w-4" />
                View full agreement
              </Link>
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
                Before using the ERP in production, each user must acknowledge this agreement.
                The system is intended for authorized Wilde Signs business operations only.
              </p>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <ul className="list-disc space-y-2 pl-5">
                  {EULA_POINTS.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </div>

              <p>
                By clicking <strong>I Accept</strong>, you confirm that you understand and agree
                to the terms above and that your acceptance may be recorded with your account.
              </p>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <input
                id="eula-ack"
                type="checkbox"
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="eula-ack" className="text-sm text-slate-700">
                I have read and agree to the EULA and clickwrap requirement.
              </label>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => logout()}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Log out
              </button>
              <button
                type="button"
                disabled={!accepted || acceptMutation.isPending}
                onClick={() => acceptMutation.mutate()}
                className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {acceptMutation.isPending ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                I Accept
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur">
            <h3 className="mb-3 text-lg font-semibold">What happens next</h3>
            <div className="space-y-3 text-sm leading-6 text-white/75">
              <p>
                Acceptance is stored on your user record. Until you accept, production routes
                and data requests are blocked by the server.
              </p>
              <p>
                After acceptance, admins and managers continue into the ERP, and operators/viewers
                are sent into the shop-floor app as usual.
              </p>
              <p className="rounded-2xl border border-white/10 bg-black/20 p-4 text-white/85">
                Status check: {hasAcceptedEula(user) ? 'accepted' : 'pending'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
