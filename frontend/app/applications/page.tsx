"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { resumeDownloadUrl } from "@/lib/api";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  reviewed: "bg-blue-100 text-blue-700",
  sent: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

export default function ApplicationsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://localhost:8000/email/drafts")
      .then(r => r.json())
      .then(data => {
        setJobs(data.drafts || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Applications</h1>
          <p className="text-slate-500 text-sm mt-1">All your job applications</p>
        </div>
        <Link href="/apply" className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors">
          + New Application
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400">Loading applications...</div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-slate-600 font-medium">No applications yet</p>
          <p className="text-slate-400 text-sm mt-1">Start by uploading a job screenshot</p>
          <Link href="/apply" className="inline-block mt-4 bg-indigo-600 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors">
            Start First Application
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job: any) => (
            <div key={job.id} className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center justify-between hover:border-indigo-200 transition-colors">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="font-semibold text-slate-800">{job.job_title}</h3>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[job.send_status] || STATUS_STYLES.pending}`}>
                    {job.send_status}
                  </span>
                </div>
                <p className="text-slate-500 text-sm">{job.company_name}</p>
                <p className="text-slate-400 text-xs mt-1">To: {job.recipient_email}</p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={resumeDownloadUrl(job.job_id)}
                  target="_blank"
                  className="text-indigo-600 text-sm font-medium hover:underline px-3 py-1.5 border border-indigo-200 rounded-lg"
                >
                  Download Resume
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
