import { Link } from 'react-router-dom';
import {
  BookOpen,
  ExternalLink,
  FileText,
  Scale,
  ShieldCheck,
  ArrowLeft,
} from 'lucide-react';
import {
  EULA_OWNERSHIP_NOTE,
  EULA_STANDARD_SECTIONS,
  EULA_THIRD_PARTY_NOTICES,
  EULA_SUMMARY,
  EULA_TITLE,
  EULA_VERSION,
} from '@erp/shared';

export function AgreementPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-4 py-10 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-emerald-500/15 p-3 text-emerald-300">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.3em] text-white/50">Agreement Document</p>
                <h1 className="text-3xl font-bold">{EULA_TITLE}</h1>
                <p className="max-w-3xl text-sm leading-6 text-white/75">{EULA_SUMMARY}</p>
                <p className="text-xs uppercase tracking-[0.24em] text-white/50">
                  Version {EULA_VERSION}
                </p>
              </div>
            </div>

            <Link
              to="/eula"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to clickwrap
            </Link>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border border-white/10 bg-white p-6 text-slate-900 shadow-2xl">
            <div className="mb-4 flex items-center gap-2 text-slate-700">
              <FileText className="h-5 w-5 text-primary-600" />
              <h2 className="text-lg font-semibold">Standard terms</h2>
            </div>

            <div className="space-y-4">
              {EULA_STANDARD_SECTIONS.map((section) => (
                <article
                  key={section.title}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <h3 className="text-base font-semibold text-slate-900">{section.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{section.body}</p>
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white p-6 text-slate-900 shadow-2xl">
            <div className="mb-4 flex items-center gap-2 text-slate-700">
              <BookOpen className="h-5 w-5 text-primary-600" />
              <h2 className="text-lg font-semibold">Third-party service terms</h2>
            </div>

            <div className="space-y-4">
              {EULA_THIRD_PARTY_NOTICES.map((notice) => (
                <article
                  key={notice.provider}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">{notice.provider}</h3>
                      <p className="text-sm text-slate-600">{notice.product}</p>
                    </div>
                    <a
                      href={notice.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700 hover:bg-primary-100"
                    >
                      Official source
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-700">{notice.summary}</p>
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
                    {notice.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-500">
                    Workspace copy: {notice.workspaceDoc}
                  </p>
                </article>
              ))}
            </div>
          </section>
        </div>

        <section className="rounded-3xl border border-white/10 bg-white p-6 text-slate-900 shadow-2xl">
          <div className="mb-4 flex items-center gap-2 text-slate-700">
            <Scale className="h-5 w-5 text-primary-600" />
            <h2 className="text-lg font-semibold">Ownership and use note</h2>
          </div>

          <div className="space-y-4 text-sm leading-7 text-slate-700">
            {EULA_OWNERSHIP_NOTE.map((line) => (
              <p key={line}>{line}</p>
            ))}
            <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
              This note is a plain-language summary for the workspace. It is not legal advice, and
              it does not replace a separate written employment, assignment, or IP ownership
              agreement if one is needed.
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/10 p-6 text-white shadow-2xl backdrop-blur">
          <h2 className="mb-3 text-lg font-semibold">Workspace references</h2>
          <p className="text-sm leading-6 text-white/75">
            The saved reference docs for this agreement live under <code>docs/legal/</code> in the
            repository, including the provider-term summaries and ownership note.
          </p>
        </section>
      </div>
    </div>
  );
}
