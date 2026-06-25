"use client";
import Link from "next/link";

export default function Dashboard() {
  return (
    <div>
      {/* Hero */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Welcome back, Jagadeesh 👋</h1>
        <p className="text-slate-500 mt-1">Your intelligent job application assistant</p>
      </div>

      {/* Quick action */}
      <div className="bg-indigo-600 rounded-2xl p-6 text-white mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Ready to apply?</h2>
          <p className="text-indigo-200 text-sm mt-1">
            Upload a job screenshot and let AutoApply AI do the rest
          </p>
        </div>
        <Link
          href="/apply"
          className="bg-white text-indigo-600 font-semibold px-5 py-2.5 rounded-xl hover:bg-indigo-50 transition-colors text-sm"
        >
          Start New Application →
        </Link>
      </div>

      {/* How it works */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">How it works</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {[
            { step: "1", title: "Upload Screenshot", desc: "Take a photo of any job posting" },
            { step: "2", title: "Extract JD", desc: "AI reads the job description" },
            { step: "3", title: "Match Profile", desc: "Scores your fit for the role" },
            { step: "4", title: "Tailor Resume", desc: "Generates ATS-optimized PDF" },
            { step: "5", title: "Send Email", desc: "Drafts and sends cold email" },
          ].map((item) => (
            <div key={item.step} className="bg-white rounded-xl border border-slate-200 p-4 text-center">
              <div className="w-8 h-8 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold text-sm mx-auto mb-2">
                {item.step}
              </div>
              <p className="font-medium text-slate-800 text-sm">{item.title}</p>
              <p className="text-slate-500 text-xs mt-1">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/applications"
          className="bg-white border border-slate-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-sm transition-all"
        >
          <h3 className="font-semibold text-slate-800">📋 View Applications</h3>
          <p className="text-slate-500 text-sm mt-1">See all your past and pending applications</p>
        </Link>
        <Link
          href="/profile"
          className="bg-white border border-slate-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-sm transition-all"
        >
          <h3 className="font-semibold text-slate-800">👤 Manage Profile</h3>
          <p className="text-slate-500 text-sm mt-1">View and update your parsed profile data</p>
        </Link>
      </div>
    </div>
  );
}
