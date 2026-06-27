"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { resumeDownloadUrl, getEmailDrafts } from "@/lib/api";
import { SkeletonCard } from "@/components/Skeleton";

const STATUS_STYLES: Record<string, string> = {
  pending:  "bg-yellow-100 text-yellow-700",
  reviewed: "bg-blue-100  text-blue-700",
  sent:     "bg-green-100 text-green-700",
  rejected: "bg-red-100   text-red-700",
  draft:    "bg-slate-100 text-slate-600",
};

function relativeDate(iso: string | undefined) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : `${d}d ago`;
}

function formatDate(iso: string | undefined) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}

export default function ApplicationsPage() {
  const [jobs,    setJobs]    = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    getEmailDrafts()
      .then(data => {
        const list = Array.isArray(data) ? data : data.drafts ?? [];
        setJobs(list.sort((a: any, b: any) =>
          new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
        ));
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="animate-fade-up">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Applications</h1>
          <p className="text-slate-500 text-sm mt-1">All your job applications</p>
        </div>
        <Link
          href="/apply"
          className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          + New Application
        </Link>
      </div>

      {error && (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-4 text-sm flex items-center gap-2">
          <span>❌</span><span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="space-y-3" aria-label="Loading applications">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-slate-700 font-semibold">No applications yet</p>
          <p className="text-slate-400 text-sm mt-1">Start by uploading a job screenshot</p>
          <Link href="/apply" className="inline-block mt-4 bg-indigo-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors">
            Start First Application
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job: any) => {
            const status   = job.status ?? job.send_status ?? "draft";
            const company  = job.company ?? job.company_name;
            const jobId    = job.job_id ?? job.id;
            const ts       = relativeDate(job.created_at);
            const fullDate = formatDate(job.created_at);

            return (
              <div
                key={job.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center justify-between hover:border-indigo-200 hover:shadow-sm transition-all gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-semibold text-slate-800 truncate">{job.job_title}</h3>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_STYLES[status] ?? STATUS_STYLES.draft}`}>
                      {status}
                    </span>
                  </div>
                  <p className="text-slate-500 text-sm truncate">{company}</p>
                  {job.recipient_email && (
                    <p className="text-slate-400 text-xs mt-0.5 truncate">To: {job.recipient_email}</p>
                  )}
                  {ts && (
                    <p className="text-slate-400 text-xs mt-1" title={fullDate ?? undefined}>
                      🕒 {ts}
                    </p>
                  )}
                </div>
                <div className="flex-shrink-0">
                  <a
                    href={resumeDownloadUrl(jobId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-indigo-600 text-sm font-medium hover:text-indigo-800 px-3 py-1.5 border border-indigo-200 rounded-xl hover:bg-indigo-50 transition-all"
                    aria-label={`Download resume for ${job.job_title}`}
                  >
                    <span>📄</span> Resume
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
