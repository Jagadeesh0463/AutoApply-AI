"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Send, Briefcase, UserCheck, Clock } from "lucide-react";
import { getEmailDrafts, getProfile } from "@/lib/api";
import { SkeletonStatCard, SkeletonCard } from "@/components/Skeleton";

function profileCompletion(items: any[]): number {
  if (!items?.length) return 0;
  const types = new Set(items.map((i: any) => i.type?.toLowerCase()));
  let score = 0;
  if (types.has("skill"))                        score += 25;
  if (types.has("experience"))                   score += 25;
  if (types.has("education"))                    score += 25;
  if (types.has("project") || types.has("cert")) score += 25;
  return score;
}

function relativeDate(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function completionColor(pct: number) {
  if (pct >= 75) return { bar: "bg-green-500", text: "text-green-600" };
  if (pct >= 50) return { bar: "bg-yellow-400", text: "text-yellow-600" };
  return { bar: "bg-red-400", text: "text-red-500" };
}

export default function DashboardPage() {
  const [drafts,  setDrafts]  = useState<any[] | null>(null);
  const [profile, setProfile] = useState<any[] | null>(null);
  const [error,   setError]   = useState("");

  useEffect(() => {
    Promise.all([getEmailDrafts(), getProfile()])
      .then(([d, p]) => {
        setDrafts(Array.isArray(d) ? d : d.drafts ?? []);
        setProfile(Array.isArray(p) ? p : p.items ?? []);
      })
      .catch(e => setError(e.message));
  }, []);

  const loading     = drafts === null && !error;
  const sent        = drafts?.filter((d: any) => d.status === "sent") ?? [];
  const totalDrafts = drafts?.length ?? 0;
  const completion  = profileCompletion(profile ?? []);
  const cc          = completionColor(completion);
  const lastDraft   = drafts?.length
    ? [...drafts].sort((a, b) =>
        new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
      )[0]
    : null;

  const missingTypes = ["skill","experience","education","project / cert"].filter((_, i) => {
    const keys = ["skill","experience","education","project"];
    return !new Set((profile ?? []).map((x: any) => x.type?.toLowerCase())).has(keys[i]);
  });

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="mb-7">
        <h1 className="text-3xl font-bold text-slate-900">Welcome back, Jagadeesh 👋</h1>
        <p className="text-slate-500 mt-1">Your AI-powered job application assistant</p>
      </div>

      {error && (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-6 text-sm flex items-center gap-2">
          <span>⚠️</span>
          <span>Could not load dashboard data — make sure your backend is running.</span>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)
        ) : (
          <>
            {/* Emails Sent */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
                  <Send size={15} className="text-indigo-600" />
                </div>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Sent</p>
              </div>
              <p className="text-3xl font-bold text-slate-900">{sent.length}</p>
              <p className="text-xs text-slate-400 mt-1">via Gmail OAuth</p>
            </div>

            {/* Total Apps */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
                  <Briefcase size={15} className="text-purple-600" />
                </div>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Total</p>
              </div>
              <p className="text-3xl font-bold text-slate-900">{totalDrafts}</p>
              <p className="text-xs text-slate-400 mt-1">drafts + sent</p>
            </div>

            {/* Profile Completion */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
                  <UserCheck size={15} className="text-green-600" />
                </div>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Profile</p>
              </div>
              <div className="flex items-end gap-3 mb-2">
                <p className={`text-3xl font-bold ${cc.text}`}>{completion}%</p>
                <p className="text-xs text-slate-400 mb-1 pb-px">
                  {completion < 100 ? `${missingTypes.length} section(s) missing` : "Complete"}
                </p>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-700 ${cc.bar}`}
                  style={{ width: `${completion}%` }}
                  role="progressbar"
                  aria-valuenow={completion}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
              {missingTypes.length > 0 && (
                <p className="text-xs text-slate-400 mt-1.5">
                  Add {missingTypes.join(", ")} items to your profile.
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Recent applications + quick actions */}
      <div className="grid sm:grid-cols-2 gap-6 mb-8">
        {/* Recent applications */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800">Recent Applications</h2>
            <Link href="/applications" className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors">
              View all →
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : drafts && drafts.length > 0 ? (
            <ul className="space-y-3">
              {[...drafts]
                .sort((a, b) =>
                  new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
                )
                .slice(0, 4)
                .map((d: any) => (
                  <li key={d.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800 text-sm truncate">{d.job_title}</p>
                      <p className="text-xs text-slate-500 truncate">{d.company}</p>
                    </div>
                    <div className="flex flex-col items-end flex-shrink-0 gap-1">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        d.status === "sent"
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-100 text-slate-500"
                      }`}>
                        {d.status}
                      </span>
                      {d.created_at && (
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Clock size={10} />
                          {relativeDate(d.created_at)}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
            </ul>
          ) : (
            <div className="text-center py-10">
              <p className="text-3xl mb-2">📭</p>
              <p className="text-slate-700 font-semibold text-sm">No applications yet</p>
              <p className="text-slate-400 text-xs mt-1 mb-4 leading-snug">
                Upload your first job screenshot to generate an<br />ATS-optimised resume and personalised email.
              </p>
              <Link
                href="/apply"
                className="inline-block bg-indigo-600 text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-indigo-700 transition-colors"
              >
                Start First Application →
              </Link>
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="flex flex-col gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h2 className="font-semibold text-slate-800 mb-4">Quick Actions</h2>
            <div className="flex flex-col gap-3">
              <Link
                href="/apply"
                className="flex items-center gap-3 bg-indigo-600 text-white rounded-xl px-4 py-3 hover:bg-indigo-700 transition-colors group"
              >
                <span className="text-xl group-hover:scale-110 transition-transform">🚀</span>
                <div>
                  <p className="font-semibold text-sm">New Application</p>
                  <p className="text-indigo-200 text-xs">Screenshot → ATS resume → Email</p>
                </div>
              </Link>
              <Link
                href="/profile"
                className="flex items-center gap-3 bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-4 py-3 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all group"
              >
                <span className="text-xl group-hover:scale-110 transition-transform">🧠</span>
                <div>
                  <p className="font-semibold text-sm">Manage Profile</p>
                  <p className="text-slate-400 text-xs">Skills, experience &amp; education</p>
                </div>
              </Link>
              <Link
                href="/applications"
                className="flex items-center gap-3 bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-4 py-3 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all group"
              >
                <span className="text-xl group-hover:scale-110 transition-transform">📋</span>
                <div>
                  <p className="font-semibold text-sm">View Applications</p>
                  <p className="text-slate-400 text-xs">All drafts &amp; sent emails</p>
                </div>
              </Link>
            </div>
          </div>

          {lastDraft && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-5 py-4">
              <p className="text-xs text-indigo-500 font-medium mb-0.5">Last activity</p>
              <p className="text-sm text-indigo-800 font-semibold">{lastDraft.job_title} @ {lastDraft.company}</p>
              {lastDraft.created_at && (
                <p className="text-xs text-indigo-400 mt-0.5">{relativeDate(lastDraft.created_at)}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* How it works */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <h2 className="font-semibold text-slate-800 mb-4">How It Works</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { icon: "📸", title: "Capture",  desc: "Screenshot or paste any job posting" },
            { icon: "🤖", title: "Extract",  desc: "Groq Vision parses JD, skills & requirements" },
            { icon: "📄", title: "Tailor",   desc: "ATS-safe resume generated for the role" },
            { icon: "📤", title: "Apply",    desc: "Cold email + resume sent via Gmail" },
          ].map((s, i) => (
            <div key={s.title} className="text-center">
              <div className="text-2xl mb-2">{s.icon}</div>
              <p className="font-semibold text-slate-800 text-sm">{i + 1}. {s.title}</p>
              <p className="text-slate-500 text-xs mt-0.5 leading-snug">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
